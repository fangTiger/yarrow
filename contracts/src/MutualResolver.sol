// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IResolver} from "./interfaces/IResolver.sol";

/// @title 双边确认 resolver
/// @notice 双方不一致或任一方在块高截止前未声明，结果即为未决之卦。
contract MutualResolver is IResolver {
    bytes32 public constant PREDICATE_ID = keccak256("MUTUAL_OUTCOME");

    struct CaseData {
        address partyA;
        address partyB;
        uint64 deadline;
        bool partyADeclared;
        bool partyBDeclared;
        bool partyAOutcome;
        bool partyBOutcome;
        bool exists;
    }

    address public immutable registrar;
    mapping(bytes32 => CaseData) private _cases;

    error AlreadyDeclared();
    error CaseAlreadyExists();
    error DeclarationClosed();
    error InvalidAddress();
    error InvalidCase();
    error InvalidDeadline();
    error InvalidPredicate();
    error NotParty();
    error NotRegistrar();
    error TooEarly();

    event CaseRegistered(bytes32 indexed caseId, address indexed partyA, address indexed partyB, uint64 deadline);
    event OutcomeDeclared(bytes32 indexed caseId, address indexed party, bool outcome);

    constructor(address registrar_) {
        if (registrar_ == address(0)) revert InvalidAddress();
        registrar = registrar_;
    }

    function registerCase(bytes32 caseId, address partyA, address partyB, uint64 deadline) external {
        if (msg.sender != registrar) revert NotRegistrar();
        if (partyA == address(0) || partyB == address(0) || partyA == partyB) revert InvalidAddress();
        if (deadline <= block.number) revert InvalidDeadline();
        if (_cases[caseId].exists) revert CaseAlreadyExists();
        _cases[caseId] = CaseData({
            partyA: partyA,
            partyB: partyB,
            deadline: deadline,
            partyADeclared: false,
            partyBDeclared: false,
            partyAOutcome: false,
            partyBOutcome: false,
            exists: true
        });
        emit CaseRegistered(caseId, partyA, partyB, deadline);
    }

    function declareOutcome(bytes32 caseId, bool outcome) external {
        CaseData storage caseData = _cases[caseId];
        if (!caseData.exists) revert InvalidCase();
        if (block.number > caseData.deadline) revert DeclarationClosed();
        if (msg.sender == caseData.partyA) {
            if (caseData.partyADeclared) revert AlreadyDeclared();
            caseData.partyADeclared = true;
            caseData.partyAOutcome = outcome;
        } else if (msg.sender == caseData.partyB) {
            if (caseData.partyBDeclared) revert AlreadyDeclared();
            caseData.partyBDeclared = true;
            caseData.partyBOutcome = outcome;
        } else {
            revert NotParty();
        }
        emit OutcomeDeclared(caseId, msg.sender, outcome);
    }

    function resolvable(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        view
        override
        returns (bool)
    {
        if (predicateId != PREDICATE_ID || params.length != 32) return false;
        CaseData storage caseData = _cases[abi.decode(params, (bytes32))];
        return caseData.exists && caseData.deadline == deadline && block.number > deadline;
    }

    function resolve(bytes32 predicateId, bytes calldata params, uint64 deadline)
        external
        view
        override
        returns (bool outcome, bool decided)
    {
        if (predicateId != PREDICATE_ID || params.length != 32) revert InvalidPredicate();
        CaseData storage caseData = _cases[abi.decode(params, (bytes32))];
        if (!caseData.exists || caseData.deadline != deadline) revert InvalidCase();
        if (block.number <= deadline) revert TooEarly();
        if (!caseData.partyADeclared || !caseData.partyBDeclared) return (false, false);
        if (caseData.partyAOutcome != caseData.partyBOutcome) return (false, false);
        return (caseData.partyAOutcome, true);
    }

    function getCase(bytes32 caseId) external view returns (CaseData memory) {
        return _cases[caseId];
    }
}
