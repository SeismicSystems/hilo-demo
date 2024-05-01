# A fully on-chain HiLo casino game

## The player places bets on whether the next mark is higher or lower than the current
Alice and Bob sit at the same HiLo table. Each are given 50 chips. The dealer draws a card. The round begins. Alice and Bob must put down bets for whether they believe the next draw is going to be `Hi`[gher] or `Lo`[wer] than the current card. Rewards at the end of the round- when the dealer draws the next card- are based on amount bet and risk taken. For instance, suppose the current card is the *4-of-Clubs*. Alice putting down 4 chips on `Lo` has a higher earnings potential than Bob putting down 8 chips on `Hi` since the former case has slimmer odds of happening. Alice and Bob place bets based on this payout structure. This proceeds for 10 rounds. Whoever has more chips at the end of the game takes the pot.

That's the core game loop for any multiplayer HiLo-style game. In general, this game can proceed with any `N` players and `M` rounds on top of any medium. In this example, the medium was a deck of cards and the mark was the rank of the drawn card, regardless of suit. Other mediums include a pair of dice- where the mark is the sum of the roll- or a set of coins- where the mark is the number of heads. See [here](https://neogames.com/games/hi-lo/) for more background on HiLo games.

## You can try this out on your local machine with six commands
This repository holds a generic implementation of fully on-chain HiLo. The implementation includes both a base contract and client. Rounds proceed via a commit-reveal workflow. We demo the generic implementation with two mediums, cards and dice. The instructions for how to run the demo follow.

You must first start a local anvil instance. We'll use `1-cards/` to demonstrate how to go from here. Steps for `2-dice/` are analogous.
```
anvil
```

Now deploy the contract. You'll need to do this step to begin every new game.
```
# directory: ./1-cards/contract/
bash script/HiLo.sh
```

Next, you need to spawn three terminal pages to properly run the demo. One terminal will be Bob's screen. Another will be Alice's. The last one is a listener that lets you view all events happening during the game. Before you do any of this, you'll need to install node modules.
```
# directory: ./1-cards/client/
pnpm install
```

Start with the listener page. Leave this open.
```
# directory: ./1-cards/client/
pnpm listen
```

Now, on a different page, connect Alice.
```
# directory: ./1-cards/client/
pnpm devA
```

Now, on a different page, connect Bob.
```
# directory: ./1-cards/client/
pnpm devB
```

Done. Happy playing!
