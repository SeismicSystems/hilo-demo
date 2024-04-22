import {
    EventABIs,
    contractInterfaceSetup
} from "./lib/utils";

let publicClient: any, contract: any;

function attachGameLoop() {
    publicClient.watchEvent({
        event: EventABIs["StartRound"],
        strict: true,
        onLogs: (logs: [any]) => {
            logs.forEach(async (log) => {
                console.log("LOG:", log);
            });
        },
    });
}

(async () => {
    let privKey = process.argv[2];

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    contract.write.bet();
})();
