import * as path from "path";

const CONTRACTS_OUT_DIR = path.join("..", "..", "contract", "out");
export const HILO_ABI_PATH = path.join(
    CONTRACTS_OUT_DIR,
    "HiLo.sol",
    "HiLo.json"
);
export const DEPLOY_PATH = path.join(CONTRACTS_OUT_DIR, "deployment.json");
