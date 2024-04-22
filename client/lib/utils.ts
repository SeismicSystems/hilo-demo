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

import { DEPLOY_PATH, HILO_ABI_PATH } from "./constants";

export const EventABIs = {
    OpenRound: parseAbiItem("event OpenRound(uint256 roundIndex)"),
    CloseRound: parseAbiItem("event CloseRound(uint256 roundIndex)"),
    GameEnd: parseAbiItem("event GameEnd()"),
};

export async function contractInterfaceSetup(
    privKey: string
): Promise<[any, any]> {
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
            wallet: walletClient,
        },
    });
    return [publicClient, contract];
}

export async function handleAsync<T>(
    promise: Promise<T>
): Promise<[T, null] | [null, any]> {
    try {
        const data = await promise;
        return [data, null];
    } catch (error) {
        return [null, error];
    }
}
