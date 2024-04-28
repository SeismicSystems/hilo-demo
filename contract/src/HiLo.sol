pragma solidity ^0.8.25;

contract HiLo {
    struct Bet {
        uint128 amount;
        bool direction;
    }

    struct Player {
        address addr;
        uint8 nBetsCommitted;
        uint8 nBetsRevealed;
        uint256 latestBetCommitment;
        Bet latestBet;
        uint128 chips;
    }

    struct Card {
        uint8 suit;
        uint8 rank;
    }

    // values from https://wizardofodds.com/games/draw-hi-lo/
    uint128[13] public MULTIPLIERS = [
        10,
        11,
        12,
        13,
        14,
        15,
        18,
        20,
        30,
        30,
        50,
        120,
        0
    ];
    uint128 public constant MULTIPLIER_SCALE = 10;
    uint8 public constant N_RANKS = 13;
    uint8 public constant N_SUITS = 4;

    uint256 private nRounds;
    uint128 private startingChips;

    Player public A;
    Player public B;
    Card public latestCard;
    uint256 private currentRound;
    bool private activeGame;

    event OpenRound(uint256 roundIndex);
    event CloseRound(uint256 roundIndex);
    event CommitBet(uint256 h);
    event RevealBet(uint128 amount, bool direction);
    event GameEnd(string winner);

    constructor(uint256 _nRounds, uint128 _startingChips) requireMultiplierLen {
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
    // drawn with replacement, typical game not like this
    function draw() public view returns (Card memory) {
        uint256 rand = uint256(blockhash(block.number - 1));
        uint8 cardIdx = uint8(rand % (N_SUITS * N_RANKS));
        return Card({suit: cardIdx / N_RANKS, rank: cardIdx % N_RANKS});
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

    function scaledMuliplierLookup(
        bool direction,
        uint8 rank
    ) public view returns (uint128) {
        return
            direction
                ? MULTIPLIERS[rank]
                : MULTIPLIERS[MULTIPLIERS.length - rank];
    }

    function chipCalculator(
        Player memory player,
        bool outcome
    ) internal view returns (uint128) {
        Bet memory lb = player.latestBet;
        uint128 deltaScaled = outcome == lb.direction
            ? lb.amount * scaledMuliplierLookup(lb.direction, latestCard.rank)
            : 0;
        uint128 delta = deltaScaled / MULTIPLIER_SCALE;
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

    function commitBet(uint256 betCommit) external requireActiveAndUncommitted {
        emit CommitBet(betCommit);
        Player storage pl = getPlayer();
        pl.latestBetCommitment = betCommit;
        pl.nBetsCommitted++;
        attemptCloseRound();
    }

    function revealBet(
        uint128 amount,
        bool direction
    )
        external
        requireRevealOnce
        requireSufficientChips(amount)
        requireValidOpening(amount, direction)
    {
        emit RevealBet(amount, direction);
        Player storage p = getPlayer();
        p.nBetsRevealed++;
        p.latestBet = Bet(amount, direction);
        attemptOpenNewRound();
    }

    modifier requireValidOpening(uint128 amount, bool direction) {
        uint256 betHash = uint256(
            keccak256(abi.encodePacked(amount, direction))
        );
        require(
            betHash == getPlayer().latestBetCommitment,
            "Bet is not a valid opening of latest commitment for this player."
        );
        _;
    }

    modifier requireMultiplierLen() {
        require(
            MULTIPLIERS.length == N_RANKS,
            "Invalid length for multiplier array"
        );
        _;
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
