/*
 * Game contract for dice-based HiLo.
 */
pragma solidity ^0.8.25;

import {HiLoBase} from "./HiLoBase.sol";

contract HiLoDice is HiLoBase {

    /*
     * Rewards for betting in the higher direction. As expected, the rewards are
     * greater when you bet high on a large sum. Increases based on dice roll
     * CDF.
     */
    uint128[] public DICE_MULTIPLIERS = [
        100,
        106,
        117,
        135,
        167,
        233,
        350,
        583,
        1117,
        3500,
        0
    ];
    uint128 public constant DICE_MULTIPLIER_SCALE = 100;

    constructor(
        uint256 _nRounds,
        uint128 _startingChips
    )
        HiLoBase(
            _nRounds,
            _startingChips,
            DICE_MULTIPLIERS,
            DICE_MULTIPLIER_SCALE
        )
    {}

    /*
     * Rolls two dice. Mark is the sum of both rolls, indexed by 0 (eg snake
     * eyes results in a mark of 0).
     */
    function sampleNextMark() public view override returns (uint8) {
        uint256 rand1 = uint256(blockhash(block.number - 1));
        uint256 rand2 = uint256(blockhash(block.number - 1)) + 1;

        uint8 die1 = uint8(rand1 % 6);
        uint8 die2 = uint8(rand2 / 6 % 6);
        return die1 + die2;
    }
}
