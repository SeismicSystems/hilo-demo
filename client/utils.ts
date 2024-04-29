import {
    Address,
    parseAbiItem,
    createWalletClient,
    createPublicClient,
    getContract,
    http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import * as path from "path";

import { DEPLOY_PATH, HILO_ABI_PATH } from "./constants";

export const EventABIs = {
    OpenRound: parseAbiItem("event OpenRound(uint256 roundIndex)"),
    CloseRound: parseAbiItem("event CloseRound(uint256 roundIndex)"),
    GameEnd: parseAbiItem("event GameEnd(uint8 winnerIdx)"),
    CommitBet: parseAbiItem("event CommitBet(uint256 betHash)"),
    RevealBet: parseAbiItem("event RevealBet(uint128 amount, bool direction)"),
};

export async function contractInterfaceSetup(
    privKey: string,
    modeName: string
): Promise<[any, any]> {
    const contractsOutDir = path.join("..", "contract", "out");
    const abiPath = path.join(
        contractsOutDir,
        modeName + ".sol",
        modeName + ".json"
    );
    const deployPath = path.join(contractsOutDir, "deployment.json");

    const hiloJSON = await import(abiPath, { assert: { type: "json" } });
    const deployJSON = await import(deployPath, { assert: { type: "json" } });

    const account = privateKeyToAccount(`0x${privKey}`);
    const walletClient = createWalletClient({
        account,
        chain: foundry,
        transport: http(),
    });
    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(),
    });

    const contract = getContract({
        address: deployJSON.gameAddress as Address,
        abi: hiloJSON.abi,
        client: {
            public: publicClient,
            wallet: walletClient,
        },
    });
    return [publicClient, contract];
}
