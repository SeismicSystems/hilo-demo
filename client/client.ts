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
    console.log(`== Beginning round ${log.args.roundIndex}`);
    askValidBet();
    console.log("- Committed to bet");
    contract.write.commitBet();
}

function closeRoundHandler(log: any) {
    contract.write.revealBet();
    console.log("- Revealed bet");
    console.log("==\n");
}

function gameEndHandler(log: any) {
    console.log("== Game has ended");
    console.log("==\n");
    process.exit(0);
}

function askValidBet(): BetDirection {
    const direction: BetDirection = readlineSync.question(
        "- Higher (H) or lower (L)? ",
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
                    eventHandlers[name as keyof typeof eventHandlers](log),
                );
            },
        });
    });
}

async function claimPlayer(playerLabel: string) {
    console.log(`== Claiming player ${playerLabel} slot`);
    const claimFunc =
        playerLabel === "A"
            ? contract.write.claimPlayerA
            : contract.write.claimPlayerB;

    console.log("- Broadcasting");
    let [res, err] = await handleAsync(claimFunc());

    if (!res || err) {
        console.error("ERROR. Can't claim player:", err);
        process.exit(1);
    }
    console.log("- Done");
    console.log("==\n");
}

(async () => {
    let playerLabel = process.argv[2];
    let privKey = process.argv[3];
    if (!playerLabel || !privKey) {
        throw new Error(
            "Please specify player label and dev private key in CLI.",
        );
    }

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    claimPlayer(playerLabel);
})();
