// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeERC20} from "./lib/SafeERC20.sol";
import {Hexagram} from "./lib/Hexagram.sol";

/// @title 起卦登记与提问者资金托管
contract DivinationRegistry {
    using SafeERC20 for IERC20;

    enum RoundState {
        COMMITTED,
        REVEALED,
        PREDICTED,
        SETTLED,
        FORFEITED,
        UNRESOLVED,
        CANCELLED
    }

    struct Round {
        bytes32 commitment;
        address querent;
        uint64 commitBlock;
        uint64 revealDeadline;
        uint256 fee;
        uint256 bond;
        bytes32 seed;
        uint8[6] lines;
        uint8 primaryHex;
        uint8 derivedHex;
        RoundState state;
    }

    address public constant HISTORY_STORAGE = 0x0000F90827F1C53a10cb7A02335B175320002935;
    uint64 public constant MAX_TOTAL_WINDOW = 8_000;
    uint64 public constant MAX_WAIT_BLOCKS = 128;

    IERC20 public immutable token;
    address public immutable treasury;
    uint64 public immutable waitBlocks;
    uint64 public immutable revealWindow;
    address public immutable owner;

    address public escrowOperator;
    uint256 public nextRoundId;

    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => bool) private _exists;

    uint256 private _entered = 1;

    error CommitmentMismatch();
    error EscrowUnavailable(uint256 requested, uint256 available);
    error EscrowOperatorAlreadySet();
    error ForfeitTooEarly();
    error InvalidAddress();
    error InvalidBlockWindows();
    error InvalidFunding();
    error InvalidRoundId(uint256 expected, uint256 actual);
    error InvalidState(RoundState actual);
    error MissingBlockhash(uint256 targetBlock);
    error NotEscrowOperator();
    error NotOwner();
    error NotQuerent();
    error Reentrancy();
    error RevealExpired();
    error RevealTooEarly();
    error UnknownRound(uint256 roundId);

    event Committed(
        uint256 indexed roundId,
        address indexed querent,
        bytes32 commitment,
        uint64 commitBlock,
        uint64 revealDeadline,
        uint256 fee,
        uint256 bond
    );
    event Revealed(uint256 indexed roundId, bytes32 seed, string question);
    event Forfeited(uint256 indexed roundId, uint256 amount);
    event EscrowOperatorSet(address indexed operator);
    event RoundStateChanged(uint256 indexed roundId, RoundState state);

    constructor(address token_, address treasury_, uint64 waitBlocks_, uint64 revealWindow_) {
        if (token_ == address(0) || treasury_ == address(0)) revert InvalidAddress();
        if (
            waitBlocks_ == 0 || waitBlocks_ > MAX_WAIT_BLOCKS || revealWindow_ == 0
                || uint256(waitBlocks_) + uint256(revealWindow_) > MAX_TOTAL_WINDOW
        ) revert InvalidBlockWindows();
        token = IERC20(token_);
        treasury = treasury_;
        waitBlocks = waitBlocks_;
        revealWindow = revealWindow_;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyEscrowOperator() {
        if (msg.sender != escrowOperator) revert NotEscrowOperator();
        _;
    }

    modifier nonReentrant() {
        if (_entered != 1) revert Reentrancy();
        _entered = 2;
        _;
        _entered = 1;
    }

    function setEscrowOperator(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidAddress();
        if (escrowOperator != address(0)) revert EscrowOperatorAlreadySet();
        escrowOperator = operator;
        emit EscrowOperatorSet(operator);
    }

    function computeCommitment(string memory question, bytes32 salt, address sender, uint256 roundId)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(question, salt, sender, roundId, block.chainid, address(this)));
    }

    function commit(bytes32 commitment, uint256 fee, uint256 bond, uint256 expectedRoundId)
        external
        nonReentrant
        returns (uint256 roundId)
    {
        if (fee == 0 || bond == 0) revert InvalidFunding();
        roundId = nextRoundId;
        if (expectedRoundId != roundId) revert InvalidRoundId(expectedRoundId, roundId);
        nextRoundId = roundId + 1;

        uint64 commitBlock = uint64(block.number);
        uint64 revealDeadline = commitBlock + waitBlocks + revealWindow;
        Round storage round = _rounds[roundId];
        round.commitment = commitment;
        round.querent = msg.sender;
        round.commitBlock = commitBlock;
        round.revealDeadline = revealDeadline;
        round.fee = fee;
        round.bond = bond;
        round.state = RoundState.COMMITTED;
        _exists[roundId] = true;

        token.safeTransferFrom(msg.sender, address(this), fee + bond);
        emit Committed(roundId, msg.sender, commitment, commitBlock, revealDeadline, fee, bond);
    }

    function reveal(uint256 roundId, string calldata question, bytes32 salt) external {
        Round storage round = _round(roundId);
        if (round.state != RoundState.COMMITTED) revert InvalidState(round.state);
        if (msg.sender != round.querent) revert NotQuerent();
        uint256 targetBlock = uint256(round.commitBlock) + waitBlocks;
        // 当前块的哈希尚不可读，所以必须严格晚于目标块。
        if (block.number <= targetBlock) revert RevealTooEarly();
        if (block.number > round.revealDeadline) revert RevealExpired();
        if (computeCommitment(question, salt, msg.sender, roundId) != round.commitment) {
            revert CommitmentMismatch();
        }

        bytes32 targetHash = _historicalBlockhash(targetBlock);
        bytes32 seed = keccak256(abi.encode(salt, targetHash));
        (uint8[6] memory lines, uint8 primaryHex, uint8 derivedHex,,) = Hexagram.derive(seed);
        round.seed = seed;
        round.lines = lines;
        round.primaryHex = primaryHex;
        round.derivedHex = derivedHex;
        round.state = RoundState.REVEALED;

        // 卦索引已写入轮次；文王序可由纯函数查表，无需在事件中重复编码。
        emit Revealed(roundId, seed, question);
    }

    function forfeit(uint256 roundId) external nonReentrant {
        Round storage round = _round(roundId);
        if (round.state != RoundState.COMMITTED) revert InvalidState(round.state);
        if (block.number <= round.revealDeadline) revert ForfeitTooEarly();
        uint256 forfeited = round.fee + round.bond;
        round.fee = 0;
        round.bond = 0;
        round.state = RoundState.FORFEITED;
        token.safeTransfer(treasury, forfeited);
        emit Forfeited(roundId, forfeited);
    }

    /// @notice 由 PredictionBook 从保证金中提取单条预测的最大正收益抵押。
    function consumeBond(uint256 roundId, address recipient, uint256 amount) external onlyEscrowOperator nonReentrant {
        if (recipient == address(0)) revert InvalidAddress();
        Round storage round = _round(roundId);
        if (round.state != RoundState.REVEALED && round.state != RoundState.PREDICTED) {
            revert InvalidState(round.state);
        }
        if (amount > round.bond) revert EscrowUnavailable(amount, round.bond);
        round.bond -= amount;
        token.safeTransfer(recipient, amount);
    }

    function markPredicted(uint256 roundId) external onlyEscrowOperator {
        Round storage round = _round(roundId);
        if (round.state != RoundState.REVEALED && round.state != RoundState.PREDICTED) {
            revert InvalidState(round.state);
        }
        round.state = RoundState.PREDICTED;
        emit RoundStateChanged(roundId, RoundState.PREDICTED);
    }

    function finalizeSettled(uint256 roundId) external onlyEscrowOperator nonReentrant {
        Round storage round = _round(roundId);
        if (round.state != RoundState.PREDICTED) revert InvalidState(round.state);
        uint256 fee = round.fee;
        uint256 refund = round.bond;
        round.fee = 0;
        round.bond = 0;
        round.state = RoundState.SETTLED;
        if (fee != 0) token.safeTransfer(treasury, fee);
        if (refund != 0) token.safeTransfer(round.querent, refund);
        emit RoundStateChanged(roundId, RoundState.SETTLED);
    }

    /// @notice 未决状态永久保留全部尚未释放的卦金与保证金。
    function markUnresolved(uint256 roundId) external onlyEscrowOperator {
        Round storage round = _round(roundId);
        if (round.state != RoundState.PREDICTED) revert InvalidState(round.state);
        round.state = RoundState.UNRESOLVED;
        emit RoundStateChanged(roundId, RoundState.UNRESOLVED);
    }

    /// @notice 预测法定人数超时未满足时，退回全部尚存卦金与保证金。
    function cancelIncomplete(uint256 roundId) external onlyEscrowOperator nonReentrant {
        Round storage round = _round(roundId);
        if (round.state != RoundState.REVEALED && round.state != RoundState.PREDICTED) {
            revert InvalidState(round.state);
        }
        uint256 refund = round.fee + round.bond;
        round.fee = 0;
        round.bond = 0;
        round.state = RoundState.CANCELLED;
        if (refund != 0) token.safeTransfer(round.querent, refund);
        emit RoundStateChanged(roundId, RoundState.CANCELLED);
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        return _round(roundId);
    }

    function availableBond(uint256 roundId) external view returns (uint256) {
        return _round(roundId).bond;
    }

    /// @notice 供前端按二进制卦索引查询文王序号。
    function kingWenNumber(uint8 binaryIndex) external pure returns (uint8) {
        return Hexagram.kingWenNumber(binaryIndex);
    }

    function _round(uint256 roundId) private view returns (Round storage round) {
        if (!_exists[roundId]) revert UnknownRound(roundId);
        round = _rounds[roundId];
    }

    function _historicalBlockhash(uint256 targetBlock) private view returns (bytes32 result) {
        result = blockhash(targetBlock);
        if (result != bytes32(0)) return result;

        (bool success, bytes memory returnData) = HISTORY_STORAGE.staticcall(abi.encode(targetBlock));
        if (success && returnData.length >= 32) result = abi.decode(returnData, (bytes32));
        if (result == bytes32(0)) revert MissingBlockhash(targetBlock);
    }
}
