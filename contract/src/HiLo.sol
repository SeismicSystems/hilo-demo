pragma solidity ^0.8.25;

contract HiLo {
    uint256 private nRounds;
    uint256 private currentRound;

    event StartRound(uint256 roundIndex);

    constructor(uint256 _nRounds) {
        nRounds = _nRounds;
        emit StartRound(currentRound);
    }

    function bet() external {
        currentRound++;
        emit StartRound(currentRound);
    }
}
