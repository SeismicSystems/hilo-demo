pragma solidity ^0.8.25;

contract HiLo {
    struct Bet {
        bool direction;
        uint128 amount;
    }

    struct Player {
        address addr;
        uint8 nBetsCommitted;
        uint8 nBetsRevealed;
        Bet latestBet;
        uint128 chips;
    }

    struct Card {
        uint8 suit;
        uint8 rank;
    }

    uint256 private nRounds;
    uint128 private startingChips;

    Player public A;
    Player public B;
    Card public latestCard;
    uint256 private currentRound;
    bool private activeGame;

    event OpenRound(uint256 roundIndex);
    event CloseRound(uint256 roundIndex);
    event GameEnd(string winner);

    constructor(uint256 _nRounds, uint128 _startingChips) {
        nRounds = _nRounds;
        startingChips = _startingChips;
    }

    function attemptStartGame() internal {
        if (A.addr != address(0) && B.addr != address(0)) {
            activeGame = true;
            emit OpenRound(currentRound);
            latestCard = draw();
        }
    }

    function claimPlayer(
        Player storage player
    ) internal playerNotClaimed(player) {
        player.addr = msg.sender;
        player.chips = startingChips;
        attemptStartGame();
    }

    function claimPlayerA() external {
        claimPlayer(A);
    }

    function claimPlayerB() external {
        claimPlayer(B);
    }

    function getChipsA() external view returns (uint128) {
        return A.chips;
    }

    function getChipsB() external view returns (uint128) {
        return B.chips;
    }

    // uses last block hash in place of VRF, do not use in production
    function draw() public view returns (Card memory) {
        uint256 rand = uint256(blockhash(block.number - 1));
        uint8 cardIdx = uint8(rand % 52);
        return Card({suit: cardIdx / 13, rank: cardIdx % 13});
    }

    function attemptCloseRound() internal {
        if (
            A.nBetsCommitted > currentRound && B.nBetsCommitted > currentRound
        ) {
            emit CloseRound(currentRound);
            currentRound++;
            if (currentRound == nRounds) {
                activeGame = false;
            }
        }
    }

    function chipCalculator(
        Player memory player,
        bool outcome
    ) internal pure returns (uint128) {
        Bet memory lb = player.latestBet;
        uint128 delta = outcome == lb.direction ? lb.amount * 2 : 0;
        return player.chips - lb.amount + delta;
    }

    function distributeWinnings() internal {
        Card memory nextCard = draw();
        if (nextCard.rank != latestCard.rank) {
            bool isHigher = nextCard.rank > latestCard.rank;
            A.chips = chipCalculator(A, isHigher);
            B.chips = chipCalculator(B, isHigher);
        }
        latestCard = nextCard;
    }

    function attemptOpenNewRound() internal {
        if (
            A.nBetsRevealed == currentRound && B.nBetsRevealed == currentRound
        ) {
            distributeWinnings();
            if (!activeGame) {
                emit GameEnd(A.chips > B.chips ? "A" : "B");
            } else {
                emit OpenRound(currentRound);
            }
        }
    }

    function getPlayer() internal view returns (Player storage) {
        if (msg.sender == A.addr) {
            return A;
        }
        if (msg.sender == B.addr) {
            return B;
        }
        revert("Sender is not registered for this game.");
    }

    function commitBet() external requireActiveAndUncommitted {
        getPlayer().nBetsCommitted++;
        attemptCloseRound();
    }

    function revealBet(
        bool bet,
        uint128 amount
    ) external requireRevealOnce requireSufficientChips(amount) {
        Player storage p = getPlayer();
        p.nBetsRevealed++;
        p.latestBet = Bet(bet, amount);
        attemptOpenNewRound();
    }

    modifier requireSufficientChips(uint128 amount) {
        require(
            getPlayer().chips >= amount,
            "Cannot bet more chips that you own"
        );
        _;
    }

    modifier requireActiveAndUncommitted() {
        require(activeGame, "Game is currently not active.");
        require(
            getPlayer().nBetsCommitted == currentRound,
            "Already made a move this round."
        );
        _;
    }

    modifier requireRevealOnce() {
        require(
            getPlayer().nBetsRevealed == currentRound - 1,
            "Can only reveal bet once for previous round."
        );
        _;
    }

    modifier playerNotClaimed(Player storage player) {
        require(player.addr == address(0), "Player has already been claimed.");
        _;
    }
}
