/*
 * A base client class for HiLo style games. Runs through a few rounds. For each
 * round, presents the user with the current state of the game (how many chips
 * each player has + what the live mark is), asks the user for their bet (amount
 * + direction), then conducts the commit-reveal.
 */
import { encodePacked, keccak256 } from "viem";
import * as readlineSync from "readline-sync";

import { EventABIs, contractInterfaceSetup } from "../lib/utils";

/*
 * <amount> is the number of chips the player wants to bet in this round and 
 * <direction> is whether the player believes the next mark will be higher or
 * lower.
 */
export type Bet = {
    amount: number;
    direction: boolean;
};
protected static BetSolTypes = ["uint128", "bool"];

export abstract class HiLoBaseClient {
    protected publicClient: any;
    protected contract: any;

    protected playerIdx: number;
    protected latestBet!: Bet;

    /*
     * The three relevant events that make up the game loop for a HiLo game.
     */
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

    /*
     * Sets up the contract interface, attaches the game loop, and claims 
     * player slot.
     */
    public async init(privKey: string, modeName: string) {
        [this.publicClient, this.contract] = await contractInterfaceSetup(
            privKey,
            modeName,
        );
        this.attachGameLoop();
        this.broadcastPlayerClaim();
    }

    /*
     * Attach event handlers for each type.
     */
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

    /*
     * Display game status to player, ask for their bet, then commit to it.
     */
    protected async openRoundHandler(log: any) {
        console.log(`== Beginning round ${log.args.roundIndex}`);
        const playerBalance = await this.logChipStatus();
        await this.logMarkInfo();
        console.log("- Bet");
        this.latestBet = await this.askValidBet(playerBalance);
        console.log("- Process");
        await this.broadcastBetCommit();
    }

    /*
     * Reveal the bet once all counterparties have committed.
     */
    protected async closeRoundHandler(log: any) {
        await this.contract.write.revealBet([
            this.latestBet.amount,
            this.latestBet.direction,
        ]);
        console.log("  - Revealed bet");
        console.log("==\n");
    }
     
    /*
     * Log the final game state and say who won.
     */
    protected async gameEndHandler(log: any) {
        console.log("== Game has ended");
        await this.logChipStatus();
        await this.logMarkInfo();
        console.log(`- ${this.playerIdxToLabel(log.args.winnerIdx)} wins`);
        console.log("==\n");
        process.exit(0);
    }

    /*
     * Claims a player slot by signing a transaction for it.
     */    
    protected async broadcastPlayerClaim() {
        console.log(
            `== Claiming ${this.playerIdxToLabel(this.playerIdx)} slot`,
        );
        console.log("- Broadcasting");
        await this.contract.write.claimPlayer([this.playerIdx]);
        console.log("- Done");
        console.log("==\n");
    }

    /*
     * Commits to a bet by publishing the keccak hash of it.
     */
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

    /*
     * Player must enter bet amount and direction.
     */
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

    /*
     * Check if user inputs constitutes a valid bet.
     */    
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

    /*
     * Prints the number of chips owned by each player.
     */
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

    /*
     * Reads contract state for chip balance of each player.
     */    
    protected async getBalances(): Promise<[number, number]> {
        return [
            await this.contract.read.getChips([0]),
            await this.contract.read.getChips([1]),
        ];
    }

    /*
     * Hardcoded to be a two player game for now. We call Player #0 "Alice" and
     * Player #1 "Bob".
     */
    protected playerIdxToLabel(playerIndex: number): string {
        return playerIndex === 0 ? "Alice" : "Bob";
    }

    /*
     * Each HiLo medium has their own way of interpreting marks.
     */
    protected abstract logMarkInfo(): void;
}
