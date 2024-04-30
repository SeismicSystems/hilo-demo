import { HiLoDiceClient } from "./lib/HiLoDiceClient";

(async () => {
    const playerIdx = parseInt(process.argv[2]);
    let privKey = process.argv[3];
    if (playerIdx < 0 || playerIdx >= 2 || !privKey) {
        throw new Error(
            "Please specify valid player index and dev private key in CLI.",
        );
    }

    const client = new HiLoDiceClient(playerIdx);
    await client.initializeClient(privKey, "HiLoDice");
})();
