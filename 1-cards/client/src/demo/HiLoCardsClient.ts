/*
 * Client for a card-based HiLo game. Uses the rank of a card as the mark.
 */
import { HiLoBaseClient } from "./HiLoBaseClient";

const SUITS = ["Clubs", "Diamonds", "Hearts", "Spades"];
const RANKS = [
    "Ace",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "Jack",
    "Queen",
    "King",
];

export class HiLoCardsClient extends HiLoBaseClient {
    /*
     * Mark is the rank of the live card.
     */
    protected async logMarkInfo() {
        const liveCard = await this.contract.read.latestCard();
        console.log("  - Live card:", this.formatCard(liveCard));
    }

    /*
     * Converts numerical representation of a card into its string.
     */
    private formatCard(card: [number, number]): string {
        const suit = SUITS[card[0]];
        const rank = RANKS[card[1]];
        return `${suit}-${rank}`;
    }
}
