/*
 * Logs all HiLo events. Easy way to see what's happening on-chain.
 */
import { EventABIs, contractInterfaceSetup } from "./lib/utils";

async function attachListener(publicClient: any, contract: any) {
    Object.values(EventABIs).forEach((abi) => {
        publicClient.watchEvent({
            address: contract.address,
            event: abi,
            strict: true,
            onLogs: (logs: [any]) => {
                logs.forEach((log) =>
                    console.log({
                        eventName: log["eventName"],
                        args: log["args"],
                    })
                );
            },
        });
    });
}

(async () => {
    let privKey = process.argv[2];
    if (!privKey) {
        throw new Error("Please specify valid dev private key in CLI.");
    }

    let [publicClient, contract] = await contractInterfaceSetup(privKey, "HiLoDice");
    await attachListener(publicClient, contract);
})();
