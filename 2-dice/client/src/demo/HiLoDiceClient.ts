/*
 * Client for a dice-based HiLo game. Uses the sum of two rolls as the mark.
 */
import { HiLoBaseClient } from "./HiLoBaseClient";

export class HiLoDiceClient extends HiLoBaseClient {
    /*
     * Mark is the sum of two rolls, subtracted by two since the sum starts at
     * 2 with snake eyes. No need to keep additional information.
     */
    protected async logMarkInfo() {
        const liveMark = await this.contract.read.latestMark();
        console.log("  - Live dice sum:", liveMark + 2);
    }
}
