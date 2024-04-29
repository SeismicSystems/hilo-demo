pragma solidity ^0.8.25;

abstract contract HiLoBase {
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

    uint256 private nRounds;
    uint128 private startingChips;

    uint128[] public multipliers;
    uint128 public multiplierScale;

    Player[2] public players;
    uint256 private currentRound;
    bool private activeGame;
    uint8 latestMark;

    event OpenRound(uint256 roundIndex);
    event CloseRound(uint256 roundIndex);
    event CommitBet(uint256 h);
    event RevealBet(uint128 amount, bool direction);
    event GameEnd(uint8 winnerIndex);

    constructor(
        uint256 _nRounds,
        uint128 _startingChips,
        uint128[] storage _multipliers,
        uint128 _multiplierScale
    ) {
        nRounds = _nRounds;
        startingChips = _startingChips;
        multipliers = _multipliers;
        multiplierScale = _multiplierScale;
    }

    function attemptStartGame() internal {
        if (players[0].addr != address(0) && players[1].addr != address(0)) {
            activeGame = true;
            emit OpenRound(currentRound);
        }
    }

    function scaledMultiplierLookup(
        bool direction,
        uint8 mark
    ) public view returns (uint128) {
        return
            direction
                ? multipliers[mark]
                : multipliers[multipliers.length - mark - 1];
    }

    function claimPlayer(uint8 index) external validPlayerIndex(index) playerNotClaimed(index) {
        Player storage player = players[index];
        player.addr = msg.sender;
        player.chips = startingChips;
        attemptStartGame();
    }

    function getChips(uint8 index) external view validPlayerIndex(index) returns (uint128) {
        return players[index].chips;
    }

    function attemptCloseRound() internal {
        if (
            players[0].nBetsCommitted > currentRound && players[1].nBetsCommitted > currentRound
        ) {
            emit CloseRound(currentRound);
            currentRound++;
            if (currentRound == nRounds) {
                activeGame = false;
            }
        }
    }

    function attemptOpenNewRound() internal {
        if (
            players[0].nBetsRevealed == currentRound && players[1].nBetsRevealed == currentRound
        ) {
            distributeWinnings();
            if (!activeGame) {
                // doesn't handle ties at the moment
                emit GameEnd(players[0].chips > players[1].chips ? 0 : 1);
            } else {
                emit OpenRound(currentRound);
            }
        }
    }

    function getNextMark() public virtual returns (uint8);

    function distributeWinnings() internal {
        uint8 nextMark = getNextMark();
        if (nextMark != latestMark) {
            bool isHigher = nextMark > latestMark;
            players[0].chips = chipCalculator(players[0], isHigher);
            players[1].chips = chipCalculator(players[1], isHigher);
        }
        latestMark = nextMark;
    }

    function chipCalculator(
        Player memory player,
        bool outcome
    ) internal view returns (uint128) {
        Bet memory lb = player.latestBet;
        uint128 deltaScaled = outcome == lb.direction
            ? lb.amount * scaledMultiplierLookup(lb.direction, latestMark)
            : 0;
        uint128 delta = deltaScaled / multiplierScale;
        return player.chips - lb.amount + delta;
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

    function getPlayer() internal view returns (Player storage) {
        return msg.sender == players[0].addr ? players[0] : players[1];
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

    modifier playerNotClaimed(uint8 index) {
        require(players[index].addr == address(0), "Player has already been claimed.");
        _;
    }

    modifier validPlayerIndex(uint8 index) {
        require(index < 2, "Invalid player index.");
        _;
    }
}
