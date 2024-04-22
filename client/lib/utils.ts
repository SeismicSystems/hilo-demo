import {
    parseAbiItem,
} from "viem";

export const EventABIs = {
    StartRound: parseAbiItem("event StartRound(uint256 roundIndex)")
};
