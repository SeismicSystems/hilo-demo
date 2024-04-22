import {
    EventABIs
} from "./lib/utils";

let publicClient;

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
    attachGameLoop();
})();
