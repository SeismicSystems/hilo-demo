import * as path from "path";

const CONTRACTS_OUT_DIR = path.join("..", "..", "contract", "out");
export const HILO_ABI_PATH = path.join(
    CONTRACTS_OUT_DIR,
    "HiLo.sol",
    "HiLo.json"
);
export const DEPLOY_PATH = path.join(CONTRACTS_OUT_DIR, "deployment.json");

export const SUITS = ["Clubs", "Diamonds", "Hearts", "Spades"];
export const RANKS = [
    "Ace",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "Jack",
    "Queen",
    "King",
];
