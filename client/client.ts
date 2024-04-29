import * as readlineSync from "readline-sync";
import { encodePacked, keccak256 } from "viem";

import { EventABIs, contractInterfaceSetup, formatCard } from "./lib/utils";

type Bet = {
    amount: number;
    direction: boolean;
};

class GameClient {
    private publicClient: any;
    private contract: any;
    private playerIdx: number;
    private latestBet!: Bet;
    private static BetSolTypes = ["uint128", "bool"];

    private eventHandlers = {
        OpenRound: this.openRoundHandler,
        CloseRound: this.closeRoundHandler,
        GameEnd: this.gameEndHandler,
    };

    constructor(playerIdx: number) {
        this.eventHandlers = {
            OpenRound: this.openRoundHandler.bind(this),
            CloseRound: this.closeRoundHandler.bind(this),
            GameEnd: this.gameEndHandler.bind(this),
        };

        this.playerIdx = playerIdx;
    }

    public async initializeClient(privKey: string) {
        [this.publicClient, this.contract] =
            await contractInterfaceSetup(privKey);
        this.attachGameLoop();
        this.broadcastPlayerClaim();
    }

    private async getBalances(): Promise<[number, number]> {
        return [
            await this.contract.read.getChips([0]),
            await this.contract.read.getChips([1]),
        ];
    }

    private async logGameStatus(): Promise<number> {
        const liveCard = await this.contract.read.latestCard();
        const balances = await this.getBalances();
        console.log("- Status");
        console.log(
            `  - Number of chips (${this.playerIdxToLabel(0)}):`,
            balances[0].toString(),
        );
        console.log(
            `  - Number of chips (${this.playerIdxToLabel(1)}):`,
            balances[1].toString(),
        );
        console.log("  - Live card:", formatCard(liveCard));
        return balances[this.playerIdx];
    }

    private async broadcastBetCommit() {
        const betCommit = BigInt(
            keccak256(
                encodePacked(GameClient.BetSolTypes, [
                    this.latestBet.amount,
                    this.latestBet.direction,
                ]),
            ),
        );
        await this.contract.write.commitBet([betCommit]);
        console.log("  - Committed to bet");
    }

    private async openRoundHandler(log: any) {
        console.log(`== Beginning round ${log.args.roundIndex}`);
        const playerBalance = await this.logGameStatus();
        console.log("- Bet");
        this.latestBet = await this.askValidBet(playerBalance);
        console.log("- Process");
        await this.broadcastBetCommit();
    }

    private async closeRoundHandler(log: any) {
        await this.contract.write.revealBet([
            this.latestBet.amount,
            this.latestBet.direction,
        ]);
        console.log("  - Revealed bet");
        console.log("==\n");
    }

    private async gameEndHandler(log: any) {
        console.log("== Game has ended");
        await this.logGameStatus();
        console.log(`- ${this.playerIdxToLabel(log.args.winnerIdx)} wins`);
        console.log("==\n");
        process.exit(0);
    }

    private validBet(
        amount: number,
        directionStr: string,
        playerBalance: number,
    ): boolean {
        return (
            ["H", "L"].includes(directionStr) &&
            amount >= 0 &&
            amount <= playerBalance
        );
    }

    private async askValidBet(playerBalance: number): Promise<Bet> {
        const amount = parseInt(readlineSync.question("  - How many chips? "));
        const directionStr = readlineSync.question(
            "  - Higher (H) or lower (L)? ",
        );
        if (!this.validBet(amount, directionStr, playerBalance)) {
            console.error("ERROR. Invalid input. Try again.");
            return this.askValidBet(playerBalance);
        }
        return {
            amount: amount,
            direction: directionStr == "H",
        };
    }

    private attachGameLoop() {
        Object.entries(EventABIs).forEach(([name, abi]) => {
            this.publicClient.watchEvent({
                address: this.contract.address,
                event: abi,
                strict: true,
                onLogs: (logs: [any]) => {
                    logs.forEach((log: any) =>
                        this.eventHandlers[
                            name as keyof typeof this.eventHandlers
                        ](log),
                    );
                },
            });
        });
    }

    private playerIdxToLabel(playerIndex: number): string {
        return playerIndex === 0 ? "Alice" : "Bob";
    }

    private async broadcastPlayerClaim() {
        console.log(
            `== Claiming ${this.playerIdxToLabel(this.playerIdx)} slot`,
        );
        console.log("- Broadcasting");
        await this.contract.write.claimPlayer([this.playerIdx]);
        console.log("- Done");
        console.log("==\n");
    }
}

(async () => {
    const playerIdx = parseInt(process.argv[2]);
    let privKey = process.argv[3];
    if (playerIdx < 0 || playerIdx >= 2 || !privKey) {
        throw new Error(
            "Please specify valid player index and dev private key in CLI.",
        );
    }

    const client = new GameClient(playerIdx);
    await client.initializeClient(privKey);
})();
