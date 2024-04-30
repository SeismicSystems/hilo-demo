/*
 * A base contract for HiLo style games. 
 */
pragma solidity ^0.8.25;

abstract contract HiLoBase {
    struct Bet {
        uint128 amount;
        bool direction;
    }

    struct CommitRevealTracker {
        uint8 nCommitted;
        uint8 nRevealed;
        uint256 latestCommit;
        Bet latestReveal;
    }

    struct Player {
        address addr;
        uint128 chips;
        CommitRevealTracker crTracker;
    }

    uint256 private nRounds;
    uint128 private startingChips;

    uint128[] public multipliers;
    uint128 public multiplierScale;

    Player[2] public players;
    uint256 private currentRound;
    bool private activeGame;
    uint8 public latestMark;

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

    function claimPlayer(
        uint8 index
    ) external requireValidPlayerIndex(index) requirePlayerNotClaimed(index) {
        Player storage player = players[index];
        player.addr = msg.sender;
        player.chips = startingChips;
        attemptStartGame();
    }

    function attemptStartGame() internal {
        if (isAllClaimed()) {
            activeGame = true;
            latestMark = sampleNextMark();
            attemptOpenRound();
        }
    }

    function attemptOpenRound() internal {
        if (isAllRevealed()) {
            if (!activeGame) {
                // doesn't handle ties at the moment
                emit GameEnd(getWinner());
            } else {
                emit OpenRound(currentRound);
            }
        }
    }

    function attemptCloseRound() internal {
        if (isAllCommitted()) {
            emit CloseRound(currentRound);
            currentRound++;
            if (currentRound == nRounds) {
                activeGame = false;
            }
        }
    }

    // only supports two players for now
    function isAllClaimed() internal view returns (bool) {
        return (players[0].addr != address(0) && players[1].addr != address(0));
    }

    function isAllCommitted() internal view returns (bool) {
        return (players[0].crTracker.nCommitted > currentRound &&
            players[1].crTracker.nCommitted > currentRound);
    }

    function isAllRevealed() internal view returns (bool) {
        return (players[0].crTracker.nRevealed == currentRound &&
            players[1].crTracker.nRevealed == currentRound);
    }

    function getWinner() internal view returns (uint8) {
        return players[0].chips > players[1].chips ? 0 : 1;
    }

    function sampleNextMark() public virtual returns (uint8);

    function sampleNextAndDistributeWinnings() internal {
        if (isAllRevealed()) {
            uint8 nextMark = sampleNextMark();
            if (nextMark != latestMark) {
                bool isHigher = nextMark > latestMark;
                players[0].chips = chipCalculator(players[0], isHigher);
                players[1].chips = chipCalculator(players[1], isHigher);
            }
            latestMark = nextMark;
        }
    }

    function chipCalculator(
        Player memory player,
        bool outcome
    ) internal view returns (uint128) {
        Bet memory lb = player.crTracker.latestReveal;
        uint128 deltaScaled = outcome == lb.direction
            ? lb.amount * scaledMultiplierLookup(lb.direction, latestMark)
            : 0;
        uint128 delta = deltaScaled / multiplierScale;
        return player.chips - lb.amount + delta;
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

    function commitBet(uint256 betCommit) external requireActiveAndUncommitted {
        emit CommitBet(betCommit);
        Player storage pl = getPlayer();
        pl.crTracker.latestCommit = betCommit;
        pl.crTracker.nCommitted++;
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
        p.crTracker.nRevealed++;
        p.crTracker.latestReveal = Bet(amount, direction);
        sampleNextAndDistributeWinnings();
        attemptOpenRound();
    }

    function getPlayer() internal view returns (Player storage) {
        return msg.sender == players[0].addr ? players[0] : players[1];
    }

    function getChips(
        uint8 index
    ) external view requireValidPlayerIndex(index) returns (uint128) {
        return players[index].chips;
    }

    modifier requireValidOpening(uint128 amount, bool direction) {
        uint256 betHash = uint256(
            keccak256(abi.encodePacked(amount, direction))
        );
        require(
            betHash == getPlayer().crTracker.latestCommit,
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
            getPlayer().crTracker.nCommitted == currentRound,
            "Already made a move this round."
        );
        _;
    }

    modifier requireRevealOnce() {
        require(
            getPlayer().crTracker.nRevealed == currentRound - 1,
            "Can only reveal bet once for previous round."
        );
        _;
    }

    modifier requirePlayerNotClaimed(uint8 index) {
        require(
            players[index].addr == address(0),
            "Player has already been claimed."
        );
        _;
    }

    modifier requireValidPlayerIndex(uint8 index) {
        require(index < 2, "Invalid player index.");
        _;
    }
}
