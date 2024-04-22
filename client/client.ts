import * as readlineSync from "readline-sync";

import { EventABIs, contractInterfaceSetup, handleAsync } from "./lib/utils";

let publicClient: any, contract: any;
enum BetDirection {
    Higher = "H",
    Lower = "L",
}

const eventHandlers = {
    OpenRound: openRoundHandler,
    CloseRound: closeRoundHandler,
    GameEnd: gameEndHandler,
};

function openRoundHandler(log: any) {
    askValidBet();
    contract.write.commitBet();
}

function closeRoundHandler(log: any) {
    console.log("revealing bet");
    contract.write.revealBet();
}

function gameEndHandler(log: any) {
    console.log("LOG IN GAME END HANDLER:", log);
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
    Object.entries(EventABIs).forEach(([name, abi]) => {
        publicClient.watchEvent({
            address: contract.address,
            event: abi,
            strict: true,
            onLogs: (logs: [any]) => {
                logs.forEach((log: any) =>
                    eventHandlers[name as keyof typeof eventHandlers](log)
                );
            },
        });
    });
}

async function claimPlayer(playerLabel: string) {
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
