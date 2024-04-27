import * as readlineSync from "readline-sync";

import { EventABIs, contractInterfaceSetup, handleAsync } from "./lib/utils";

let publicClient: any, contract: any;
let playerLabel: string;
let latestBet: BetDirection;

enum BetDirection {
    Higher = "H",
    Lower = "L",
}

const eventHandlers = {
    OpenRound: openRoundHandler,
    CloseRound: closeRoundHandler,
    GameEnd: gameEndHandler,
};

async function logChipBalance() {
    const balance = await (playerLabel == "A"
        ? contract.read.getChipsA()
        : contract.read.getChipsB());
    console.log("- Number of chips:", balance.toString());
}

async function openRoundHandler(log: any) {
    console.log(`== Beginning round ${log.args.roundIndex}`);
    await logChipBalance();
    latestBet = askValidBet();
    console.log("- Committed to bet");
    contract.write.commitBet();
}

async function closeRoundHandler(log: any) {
    const encodedBet = latestBet == BetDirection.Higher ? 1 : 0;
    contract.write.revealBet(encodedBet);
    console.log("- Revealed bet");
    console.log("==\n");
}

async function gameEndHandler(log: any) {
    console.log("== Game has ended");
    await logChipBalance();
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
    playerLabel = process.argv[2];
    let privKey = process.argv[3];
    if ((playerLabel != "A" && playerLabel != "B") || !privKey) {
        throw new Error(
            "Please specify valid player label and dev private key in CLI.",
        );
    }

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    claimPlayer(playerLabel);
})();
