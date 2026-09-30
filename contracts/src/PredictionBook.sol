// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {IResolver} from "./interfaces/IResolver.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {SettlementMath} from "./lib/SettlementMath.sol";
import {DivinationRegistry} from "./DivinationRegistry.sol";
import {PredicateRegistry} from "./PredicateRegistry.sol";
import {ScoreBook} from "./ScoreBook.sol";
import {DivinerVault} from "./DivinerVault.sol";

/// @title 预测预注册与结算编排
contract PredictionBook {
    using SafeERC20 for IERC20;

    enum PredictionState {
        NONE,
        ACTIVE,
        SETTLED,
        UNRESOLVED,
        CANCELLED
    }

    struct Prediction {
        uint256 roundId;
        address diviner;
        bool direction;
        uint16 probabilityBps;
        uint16 multiplier;
        uint256 reserved;
        bytes32 predicateId;
        bytes params;
        uint64 deadline;
        bytes32 modelId;
        bytes32 promptHash;
        bytes32 schemaHash;
        bytes32 providerConfigHash;
        uint16 attemptCount;
    }

    struct PredictionRequest {
        uint256 roundId;
        bool direction;
        uint16 probabilityBps;
        bytes32 predicateId;
        bytes params;
        uint64 deadline;
        bytes32 modelId;
        bytes32 promptHash;
        bytes32 schemaHash;
        bytes32 providerConfigHash;
        uint16 attemptCount;
    }

    struct Position {
        address querent;
        address vault;
        address resolver;
        uint256 rewardCollateral;
        PredictionState state;
    }

    struct RoundTerms {
        bytes32 predicateId;
        bytes32 paramsHash;
        uint64 deadline;
        uint32 predictionCount;
        uint32 finalizedCount;
        bool initialized;
        bool unresolved;
    }

    IERC20 public immutable token;
    DivinationRegistry public immutable roundRegistry;
    PredicateRegistry public immutable predicateRegistry;
    ScoreBook public immutable scoreBook;
    address public immutable owner;

    uint256 public nextPredictionId = 1;
    uint256 public permanentlyLockedCollateral;
    mapping(address => address) public vaultOf;
    mapping(address => bool) public isRegisteredDiviner;
    mapping(uint256 => Prediction) private _predictions;
    mapping(uint256 => Position) private _positions;
    mapping(uint256 => RoundTerms) private _roundTerms;
    mapping(uint256 => address[]) private _roundDiviners;
    mapping(uint256 => uint256[]) private _roundPredictionIds;
    mapping(uint256 => mapping(address => bool)) public hasPredicted;
    address[] private _registeredDiviners;

    uint256 private _entered = 1;

    error AlreadyPredicted();
    error CancellationTooEarly();
    error DirectionMismatch();
    error DivinerAlreadyRegistered();
    error InvalidAddress();
    error InvalidMetadata();
    error InvalidProbability();
    error InvalidRoundState();
    error InvalidVault();
    error NotDiviner();
    error NotOwner();
    error NotResolvable();
    error QuorumNotReached(uint256 roundId, uint32 submitted, uint32 required);
    error QuorumAlreadyReached();
    error Reentrancy();
    error RoundTermsMismatch();
    error UnknownPrediction();

    event DivinerRegistered(address indexed diviner, address indexed vault);
    event PredictionSubmitted(uint256 indexed predictionId, uint256 indexed roundId, address indexed diviner);
    event PredictionRefused(uint256 indexed roundId, address indexed diviner);
    event PredictionSettled(uint256 indexed predictionId, bool outcome, int256 delta);
    event PredictionUnresolved(uint256 indexed predictionId);
    event RoundCancelled(uint256 indexed roundId, uint32 submitted, uint32 required);

    constructor(address token_, address roundRegistry_, address predicateRegistry_, address scoreBook_) {
        if (
            token_ == address(0) || roundRegistry_ == address(0) || predicateRegistry_ == address(0)
                || scoreBook_ == address(0)
        ) revert InvalidAddress();
        token = IERC20(token_);
        roundRegistry = DivinationRegistry(roundRegistry_);
        predicateRegistry = PredicateRegistry(predicateRegistry_);
        scoreBook = ScoreBook(scoreBook_);
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    function registerDiviner(address diviner, address vault) external onlyOwner {
        if (diviner == address(0) || vault == address(0)) revert InvalidAddress();
        if (isRegisteredDiviner[diviner]) revert DivinerAlreadyRegistered();
        DivinerVault candidate = DivinerVault(vault);
        if (
            candidate.controller() != address(this) || candidate.diviner() != diviner
                || address(candidate.token()) != address(token)
        ) revert InvalidVault();
        isRegisteredDiviner[diviner] = true;
        _registeredDiviners.push(diviner);
        vaultOf[diviner] = vault;
        emit DivinerRegistered(diviner, vault);
    }

    /// @notice probabilityBps 表示 YES 概率；direction 仅作为公开结论与胜率统计字段。
    function submitPrediction(PredictionRequest calldata request)
        external
        nonReentrant
        returns (uint256 predictionId, bool accepted)
    {
        if (request.probabilityBps < 100 || request.probabilityBps > 9_900) revert InvalidProbability();
        if (
            (request.probabilityBps > 5_000 && !request.direction)
                || (request.probabilityBps < 5_000 && request.direction)
        ) revert DirectionMismatch();
        if (request.deadline <= block.number) revert NotResolvable();
        if (
            request.modelId == bytes32(0) || request.promptHash == bytes32(0) || request.schemaHash == bytes32(0)
                || request.providerConfigHash == bytes32(0) || request.attemptCount == 0
        ) {
            revert InvalidMetadata();
        }
        address vaultAddress = vaultOf[msg.sender];
        if (vaultAddress == address(0)) revert NotDiviner();
        if (hasPredicted[request.roundId][msg.sender]) revert AlreadyPredicted();

        DivinationRegistry.Round memory round = roundRegistry.getRound(request.roundId);
        if (
            round.state != DivinationRegistry.RoundState.REVEALED
                && round.state != DivinationRegistry.RoundState.PREDICTED
        ) revert InvalidRoundState();
        address resolver = predicateRegistry.requireBettable(request.predicateId);
        bytes32 paramsHash = keccak256(request.params);
        _validateRoundTerms(request.roundId, request.predicateId, paramsHash, request.deadline);

        ScoreBook.Stats memory stats = scoreBook.getStats(msg.sender);
        DivinerVault vault = DivinerVault(vaultAddress);
        uint16 multiplier = vault.calculateMultiplier(round.fee, stats.sampleCount, stats.totalBrier);
        predictionId = nextPredictionId;
        if (!vault.reserve(predictionId, round.fee, multiplier)) {
            emit PredictionRefused(request.roundId, msg.sender);
            return (0, false);
        }

        uint256 rewardCollateral = uint256(multiplier) * round.fee;
        roundRegistry.consumeBond(request.roundId, address(this), rewardCollateral);
        uint256 reserved = SettlementMath.reserveAmount(round.fee, multiplier);
        _predictions[predictionId] = Prediction({
            roundId: request.roundId,
            diviner: msg.sender,
            direction: request.direction,
            probabilityBps: request.probabilityBps,
            multiplier: multiplier,
            reserved: reserved,
            predicateId: request.predicateId,
            params: request.params,
            deadline: request.deadline,
            modelId: request.modelId,
            promptHash: request.promptHash,
            schemaHash: request.schemaHash,
            providerConfigHash: request.providerConfigHash,
            attemptCount: request.attemptCount
        });
        _positions[predictionId] = Position({
            querent: round.querent,
            vault: vaultAddress,
            resolver: resolver,
            rewardCollateral: rewardCollateral,
            state: PredictionState.ACTIVE
        });
        hasPredicted[request.roundId][msg.sender] = true;
        _roundPredictionIds[request.roundId].push(predictionId);
        ++nextPredictionId;
        RoundTerms storage terms = _roundTerms[request.roundId];
        if (!terms.initialized) {
            terms.predicateId = request.predicateId;
            terms.paramsHash = paramsHash;
            terms.deadline = request.deadline;
            terms.initialized = true;
            _snapshotRoundDiviners(request.roundId);
        }
        ++terms.predictionCount;
        roundRegistry.markPredicted(request.roundId);
        emit PredictionSubmitted(predictionId, request.roundId, msg.sender);
        return (predictionId, true);
    }

    /// @notice 任何人均可在 resolver 允许后触发结算。
    function settle(uint256 predictionId) external nonReentrant returns (int256 delta) {
        Position storage position = _positions[predictionId];
        if (position.state != PredictionState.ACTIVE) revert UnknownPrediction();
        Prediction storage prediction = _predictions[predictionId];
        if (block.number <= prediction.deadline) revert NotResolvable();
        (uint32 submitted, uint32 required) = quorumStatus(prediction.roundId);
        if (submitted != required) revert QuorumNotReached(prediction.roundId, submitted, required);
        IResolver resolver = IResolver(position.resolver);
        if (!resolver.resolvable(prediction.predicateId, prediction.params, prediction.deadline)) {
            revert NotResolvable();
        }
        (bool outcome, bool decided) = resolver.resolve(prediction.predicateId, prediction.params, prediction.deadline);
        RoundTerms storage terms = _roundTerms[prediction.roundId];

        if (!decided) {
            position.state = PredictionState.UNRESOLVED;
            permanentlyLockedCollateral += position.rewardCollateral;
            ++terms.finalizedCount;
            scoreBook.recordUnresolvedPrediction(
                predictionId, prediction.roundId, prediction.diviner, prediction.probabilityBps
            );
            if (!terms.unresolved) {
                terms.unresolved = true;
                roundRegistry.markUnresolved(prediction.roundId);
            }
            emit PredictionUnresolved(predictionId);
            return 0;
        }

        delta = SettlementMath.scoreDelta(
            roundRegistry.getRound(prediction.roundId).fee, prediction.multiplier, prediction.probabilityBps, outcome
        );
        position.state = PredictionState.SETTLED;
        uint256 usedCollateral;
        if (delta > 0) {
            usedCollateral = uint256(delta);
            token.forceApprove(position.vault, usedCollateral);
        }
        DivinerVault(position.vault).settle(predictionId, delta, position.querent);
        if (delta > 0) token.forceApprove(position.vault, 0);

        uint256 refund = position.rewardCollateral - usedCollateral;
        if (refund != 0) token.safeTransfer(position.querent, refund);
        scoreBook.recordPrediction(
            predictionId,
            prediction.roundId,
            prediction.diviner,
            prediction.probabilityBps,
            prediction.direction,
            outcome
        );
        ++terms.finalizedCount;
        if (terms.finalizedCount == terms.predictionCount && !terms.unresolved) {
            roundRegistry.finalizeSettled(prediction.roundId);
        }
        emit PredictionSettled(predictionId, outcome, delta);
    }

    /// @notice 截止后法定人数仍不足时，任何人都可作废整轮并原路释放双方预留。
    function cancelIncompleteRound(uint256 roundId) external nonReentrant {
        RoundTerms storage terms = _roundTerms[roundId];
        if (!terms.initialized) {
            DivinationRegistry.Round memory round = roundRegistry.getRound(roundId);
            if (round.state != DivinationRegistry.RoundState.REVEALED) revert InvalidRoundState();
            if (block.number <= round.revealDeadline) revert CancellationTooEarly();
            roundRegistry.cancelIncomplete(roundId);
            emit RoundCancelled(roundId, 0, _activeRegisteredDivinerCount());
            return;
        }
        if (block.number <= terms.deadline) revert CancellationTooEarly();
        (uint32 submitted, uint32 required) = quorumStatus(roundId);
        if (submitted == required) revert QuorumAlreadyReached();

        uint256[] storage predictionIds = _roundPredictionIds[roundId];
        for (uint256 index = 0; index < predictionIds.length; ++index) {
            uint256 predictionId = predictionIds[index];
            Position storage position = _positions[predictionId];
            if (position.state != PredictionState.ACTIVE) revert InvalidRoundState();
            position.state = PredictionState.CANCELLED;
            DivinerVault(position.vault).cancelReservation(predictionId);
            token.safeTransfer(position.querent, position.rewardCollateral);
            ++terms.finalizedCount;
        }
        roundRegistry.cancelIncomplete(roundId);
        emit RoundCancelled(roundId, submitted, required);
    }

    function getPrediction(uint256 predictionId) external view returns (Prediction memory) {
        if (_positions[predictionId].state == PredictionState.NONE) revert UnknownPrediction();
        return _predictions[predictionId];
    }

    function stateOf(uint256 predictionId) external view returns (PredictionState) {
        return _positions[predictionId].state;
    }

    function getRoundTerms(uint256 roundId) external view returns (RoundTerms memory) {
        return _roundTerms[roundId];
    }

    function registeredDivinerCount() external view returns (uint256) {
        return _registeredDiviners.length;
    }

    function getRoundDiviners(uint256 roundId) external view returns (address[] memory) {
        return _roundDiviners[roundId];
    }

    /// @notice 已提交者始终计入；仅未提交且已永久封存的易者免除本轮义务。
    function quorumStatus(uint256 roundId) public view returns (uint32 submitted, uint32 required) {
        address[] storage diviners = _roundDiviners[roundId];
        for (uint256 index = 0; index < diviners.length; ++index) {
            address diviner = diviners[index];
            if (hasPredicted[roundId][diviner]) {
                ++submitted;
                ++required;
            } else if (DivinerVault(vaultOf[diviner]).state() != DivinerVault.DivinerState.SEALED) {
                ++required;
            }
        }
    }

    function _validateRoundTerms(uint256 roundId, bytes32 predicateId, bytes32 paramsHash, uint64 deadline)
        private
        view
    {
        RoundTerms storage terms = _roundTerms[roundId];
        if (
            terms.initialized
                && (terms.predicateId != predicateId || terms.paramsHash != paramsHash || terms.deadline != deadline)
        ) revert RoundTermsMismatch();
    }

    function _snapshotRoundDiviners(uint256 roundId) private {
        address[] storage diviners = _roundDiviners[roundId];
        for (uint256 index = 0; index < _registeredDiviners.length; ++index) {
            address diviner = _registeredDiviners[index];
            if (DivinerVault(vaultOf[diviner]).state() == DivinerVault.DivinerState.ACTIVE) {
                diviners.push(diviner);
            }
        }
    }

    function _activeRegisteredDivinerCount() private view returns (uint32 count) {
        for (uint256 index = 0; index < _registeredDiviners.length; ++index) {
            if (DivinerVault(vaultOf[_registeredDiviners[index]]).state() == DivinerVault.DivinerState.ACTIVE) {
                ++count;
            }
        }
    }
}
