import * as readlineSync from "readline-sync";

import { EventABIs, contractInterfaceSetup, handleAsync } from "./lib/utils";

let publicClient: any, contract: any;
enum BetDirection {
    Higher = "H",
    Lower = "L",
}

function askValidBet(): BetDirection {
    const direction: BetDirection = readlineSync.question(
        "- Would you like to bet higher (H) or lower (L)? "
    );
    if (!Object.values(BetDirection).includes(direction)) {
        console.error("ERROR. Invalid input. Enter 'H' or 'L'.");
        return askValidBet();
    }
    return direction;
}

function attachGameLoop() {
    publicClient.watchEvent({
        event: EventABIs["StartRound"],
        strict: true,
        onLogs: (logs: [any]) => {
            logs.forEach(async (log) => {
                askValidBet();
                contract.write.bet();
            });
        },
    });
}

async function claimPlayer(
    playerLabel: string
) {
    const claimFunc =
        playerLabel === "A"
            ? contract.write.claimPlayerA
            : contract.write.claimPlayerB;

    let [res, err] = await handleAsync(claimFunc());
    if (!res || err) {
        console.error("ERROR. Can't claim player:", err);
        process.exit(1);
    }
}

(async () => {
    let playerLabel = process.argv[2];
    let privKey = process.argv[3];
    if (!playerLabel || !privKey) {
        throw new Error(
            "Please specify player label and dev private key in CLI."
        );
    }

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    claimPlayer(playerLabel);
})();
