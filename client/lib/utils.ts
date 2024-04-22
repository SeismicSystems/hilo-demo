import {
    Address,
    parseAbiItem,
    createWalletClient,
    createPublicClient,
    getContract,
    http
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

import { DEPLOY_PATH, HILO_ABI_PATH } from "./constants";

export const EventABIs = {
    StartRound: parseAbiItem("event StartRound(uint256 roundIndex)")
};

export async function contractInterfaceSetup(privKey: string): Promise<[any, any]> {
    const hiloJSON = await import(HILO_ABI_PATH, { assert: { type: "json" } });
    const deployJSON = await import(DEPLOY_PATH, { assert: { type: "json" } });

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
            wallet: walletClient
        },
    });
    return [publicClient, contract];
}
