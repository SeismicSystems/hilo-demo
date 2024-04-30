import { HiLoBaseClient } from "./HiLoBaseClient";

export class HiLoDiceClient extends HiLoBaseClient {
    protected async logMarkInfo() {
        const liveMark = await this.contract.read.latestMark();
        console.log("  - Live dice sum:", liveMark + 2);
    }
}
