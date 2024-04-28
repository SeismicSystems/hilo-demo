import * as readlineSync from "readline-sync";
import { encodePacked, keccak256 } from "viem";

import { EventABIs, contractInterfaceSetup, formatCard } from "./lib/utils";

type Bet = {
    amount: number;
    direction: boolean;
};
const BetSolTypes = ["uint128", "bool"];

let publicClient: any, contract: any;
let playerLabel: string;
let latestBet: Bet;

const eventHandlers = {
    OpenRound: openRoundHandler,
    CloseRound: closeRoundHandler,
    GameEnd: gameEndHandler,
};

async function logGameStatus(): Promise<number> {
    const liveCard = await contract.read.latestCard();
    const balanceA = await contract.read.getChipsA();
    const balanceB = await contract.read.getChipsB();
    console.log("- Status");
    console.log("  - Number of chips (Player A):", balanceA.toString());
    console.log("  - Number of chips (Player B):", balanceB.toString());
    console.log("  - Live card:", formatCard(liveCard));
    return playerLabel == "A" ? balanceA : balanceB;
}

async function broadcastBetCommit() {
    const betCommit = BigInt(keccak256(
        encodePacked(BetSolTypes, [latestBet.amount, latestBet.direction])
    ));
    await contract.write.commitBet([betCommit]);
    console.log("  - Committed to bet");
}

async function openRoundHandler(log: any) {
    console.log(`== Beginning round ${log.args.roundIndex}`);
    const playerBalance = await logGameStatus();
    console.log("- Bet");
    latestBet = await askValidBet(playerBalance);
    console.log("- Process");
    await broadcastBetCommit();
}

async function closeRoundHandler(log: any) {
    await contract.write.revealBet([latestBet.amount, latestBet.direction]);
    console.log("  - Revealed bet");
    console.log("==\n");
}

async function gameEndHandler(log: any) {
    console.log("== Game has ended");
    await logGameStatus();
    console.log(`- Player ${log.args.winner} wins`);
    console.log("==\n");
    process.exit(0);
}

function validBet(amount: number, directionStr: string, playerBalance: number) {
    return (
        ["H", "L"].includes(directionStr) &&
        amount >= 0 &&
        amount <= playerBalance
    );
}

async function askValidBet(playerBalance: number): Promise<Bet> {
    const amount = parseInt(readlineSync.question("  - How many chips? "));
    const directionStr = readlineSync.question("  - Higher (H) or lower (L)? ");
    if (!validBet(amount, directionStr, playerBalance)) {
        console.error("ERROR. Invalid input. Try again.");
        return askValidBet(playerBalance);
    }
    const bet: Bet = {
        amount: amount,
        direction: directionStr == "H",
    };
    return bet;
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
    console.log(`== Claiming player ${playerLabel} slot`);
    const claimFunc =
        playerLabel === "A"
            ? contract.write.claimPlayerA
            : contract.write.claimPlayerB;

    console.log("- Broadcasting");
    await claimFunc();
    console.log("- Done");
    console.log("==\n");
}

(async () => {
    playerLabel = process.argv[2];
    let privKey = process.argv[3];
    if ((playerLabel != "A" && playerLabel != "B") || !privKey) {
        throw new Error(
            "Please specify valid player label and dev private key in CLI."
        );
    }

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    claimPlayer(playerLabel);
})();
