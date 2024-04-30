import { encodePacked, keccak256 } from "viem";
import * as readlineSync from "readline-sync";

import { EventABIs, contractInterfaceSetup } from "./utils";

export type Bet = {
    amount: number;
    direction: boolean;
};

export abstract class HiLoBaseClient {
    protected publicClient: any;
    protected contract: any;
    protected playerIdx: number;
    protected latestBet!: Bet;
    protected static BetSolTypes = ["uint128", "bool"];

    protected eventHandlers = {
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

    public async initializeClient(privKey: string, modeName: string) {
        [this.publicClient, this.contract] = await contractInterfaceSetup(
            privKey,
            modeName,
        );
        this.attachGameLoop();
        this.broadcastPlayerClaim();
    }

    protected attachGameLoop() {
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

    protected async openRoundHandler(log: any) {
        console.log(`== Beginning round ${log.args.roundIndex}`);
        const playerBalance = await this.logChipStatus();
        await this.logMarkInfo();
        console.log("- Bet");
        this.latestBet = await this.askValidBet(playerBalance);
        console.log("- Process");
        await this.broadcastBetCommit();
    }

    protected async closeRoundHandler(log: any) {
        await this.contract.write.revealBet([
            this.latestBet.amount,
            this.latestBet.direction,
        ]);
        console.log("  - Revealed bet");
        console.log("==\n");
    }

    protected async gameEndHandler(log: any) {
        console.log("== Game has ended");
        await this.logChipStatus();
        await this.logMarkInfo();
        console.log(`- ${this.playerIdxToLabel(log.args.winnerIdx)} wins`);
        console.log("==\n");
        process.exit(0);
    }

    protected async broadcastPlayerClaim() {
        console.log(
            `== Claiming ${this.playerIdxToLabel(this.playerIdx)} slot`,
        );
        console.log("- Broadcasting");
        await this.contract.write.claimPlayer([this.playerIdx]);
        console.log("- Done");
        console.log("==\n");
    }

    protected async broadcastBetCommit() {
        const betCommit = BigInt(
            keccak256(
                encodePacked(HiLoBaseClient.BetSolTypes, [
                    this.latestBet.amount,
                    this.latestBet.direction,
                ]),
            ),
        );
        await this.contract.write.commitBet([betCommit]);
        console.log("  - Committed to bet");
    }

    protected async askValidBet(playerBalance: number): Promise<Bet> {
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

    protected validBet(
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

    protected async logChipStatus(): Promise<number> {
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
        return balances[this.playerIdx];
    }

    protected async getBalances(): Promise<[number, number]> {
        return [
            await this.contract.read.getChips([0]),
            await this.contract.read.getChips([1]),
        ];
    }

    protected playerIdxToLabel(playerIndex: number): string {
        return playerIndex === 0 ? "Alice" : "Bob";
    }

    protected abstract logMarkInfo(): void;
}
