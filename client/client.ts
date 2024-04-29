import * as readlineSync from "readline-sync";
import { encodePacked, keccak256 } from "viem";

import { EventABIs, contractInterfaceSetup, formatCard } from "./lib/utils";

type Bet = {
    amount: number;
    direction: boolean;
};
const BetSolTypes = ["uint128", "bool"];

enum PlayerLabel {
    A = "A",
    B = "B",
}

let publicClient: any, contract: any;
let playerIdx: number;
let latestBet: Bet;

const eventHandlers = {
    OpenRound: openRoundHandler,
    CloseRound: closeRoundHandler,
    GameEnd: gameEndHandler,
};

async function getBalances(): Promise<[number, number]> {
    return [
        await contract.read.getChips([0]),
        await contract.read.getChips([1]),
    ];
}

async function logGameStatus(): Promise<number> {
    const liveCard = await contract.read.latestCard();
    const balances = await getBalances();
    console.log("- Status");
    console.log(
        `  - Number of chips (${playerIdxToLabel(0)}):`,
        balances[0].toString()
    );
    console.log(
        `  - Number of chips (${playerIdxToLabel(1)}):`,
        balances[1].toString()
    );
    console.log("  - Live card:", formatCard(liveCard));
    return balances[playerIdx];
}

async function broadcastBetCommit() {
    const betCommit = BigInt(
        keccak256(
            encodePacked(BetSolTypes, [latestBet.amount, latestBet.direction])
        )
    );
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
    console.log(`- ${playerIdxToLabel(log.args.winnerIdx)} wins`);
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

function playerIdxToLabel(playerIndex: number): string {
    return playerIndex === 0 ? "Alice" : "Bob";
}

async function broadcastPlayerClaim() {
    console.log(`== Claiming ${playerIdxToLabel(playerIdx)} slot`);
    console.log("- Broadcasting");
    await contract.write.claimPlayer([playerIdx]);
    console.log("- Done");
    console.log("==\n");
}

(async () => {
    playerIdx = parseInt(process.argv[2]);
    let privKey = process.argv[3];
    if (playerIdx < 0 || playerIdx >= 2 || !privKey) {
        throw new Error(
            "Please specify valid player index and dev private key in CLI."
        );
    }

    [publicClient, contract] = await contractInterfaceSetup(privKey);
    attachGameLoop();
    broadcastPlayerClaim();
})();
