// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IResolver} from "./interfaces/IResolver.sol";
import {IValidationRegistry} from "./interfaces/IValidationRegistry.sol";

/// @title ERC-8004 人层判定 resolver
/// @notice agent 所有者先向标准 Registry 请求本合约验证；固定人类判定者再由本合约回写 0/100 响应。
contract AttestedResolver is IResolver {
    bytes32 public constant PREDICATE_ID = keccak256("ATTESTED_OUTCOME");
    string public constant RESPONSE_TAG = "yijing-outcome-v1";

    struct CaseData {
        uint256 agentId;
        uint64 deadline;
        bool responded;
        bool exists;
    }

    IValidationRegistry public immutable validationRegistry;
    address public immutable attestor;
    mapping(bytes32 => CaseData) private _cases;

    error AlreadyResponded();
    error AttestationClosed();
    error CaseAlreadyExists();
    error InvalidAddress();
    error InvalidCase();
    error InvalidDeadline();
    error InvalidPredicate();
    error InvalidValidationRequest();
    error NotAttestor();
    error TooEarly();

    event CaseOpened(bytes32 indexed requestHash, uint256 indexed agentId, uint64 deadline);
    event OutcomeAttested(bytes32 indexed requestHash, bool outcome, bytes32 indexed responseHash, string responseURI);

    constructor(address validationRegistry_, address attestor_) {
        if (validationRegistry_ == address(0) || attestor_ == address(0)) revert InvalidAddress();
        validationRegistry = IValidationRegistry(validationRegistry_);
        attestor = attestor_;
    }

    /// @notice Registry 请求必须已存在、明确指向本 resolver，且尚未被其他流程响应。
    function openCase(bytes32 requestHash, uint256 agentId, uint64 deadline) external {
        if (deadline <= block.number) revert InvalidDeadline();
        if (_cases[requestHash].exists) revert CaseAlreadyExists();
        (
            address validatorAddress,
            uint256 registeredAgentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
        ) = validationRegistry.getValidationStatus(requestHash);
        if (
            validatorAddress != address(this) || registeredAgentId != agentId || response != 0
                || responseHash != bytes32(0) || bytes(tag).length != 0
        ) revert InvalidValidationRequest();
        _cases[requestHash] = CaseData({agentId: agentId, deadline: deadline, responded: false, exists: true});
        emit CaseOpened(requestHash, agentId, deadline);
    }

    function submitOutcome(bytes32 requestHash, bool outcome, string calldata responseURI, bytes32 responseHash)
        external
    {
        if (msg.sender != attestor) revert NotAttestor();
        CaseData storage caseData = _cases[requestHash];
        if (!caseData.exists) revert InvalidCase();
        if (caseData.responded) revert AlreadyResponded();
        if (block.number > caseData.deadline) revert AttestationClosed();
        caseData.responded = true;
        validationRegistry.validationResponse(
            requestHash, outcome ? uint8(100) : uint8(0), responseURI, responseHash, RESPONSE_TAG
        );
        emit OutcomeAttested(requestHash, outcome, responseHash, responseURI);
    }

    function resolvable(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        view
        override
        returns (bool)
    {
        if (predicateId != PREDICATE_ID || params.length != 64) return false;
        (bytes32 requestHash, uint256 agentId) = abi.decode(params, (bytes32, uint256));
        CaseData storage caseData = _cases[requestHash];
        return
            caseData.exists && caseData.agentId == agentId && caseData.deadline == deadline && block.number > deadline;
    }

    function resolve(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        view
        override
        returns (bool outcome, bool decided)
    {
        if (predicateId != PREDICATE_ID || params.length != 64) revert InvalidPredicate();
        (bytes32 requestHash, uint256 agentId) = abi.decode(params, (bytes32, uint256));
        CaseData storage caseData = _cases[requestHash];
        if (!caseData.exists || caseData.agentId != agentId || caseData.deadline != deadline) revert InvalidCase();
        if (block.number <= deadline) revert TooEarly();
        if (!caseData.responded) return (false, false);

        (address validatorAddress, uint256 registeredAgentId, uint8 response,, string memory tag, uint256 lastUpdate) =
            validationRegistry.getValidationStatus(requestHash);
        if (
            validatorAddress != address(this) || registeredAgentId != agentId || lastUpdate == 0
                || keccak256(bytes(tag)) != keccak256(bytes(RESPONSE_TAG))
        ) return (false, false);
        if (response == 100) return (true, true);
        if (response == 0) return (false, true);
        return (false, false);
    }

    function getCase(bytes32 requestHash) external view returns (CaseData memory) {
        return _cases[requestHash];
    }
}
