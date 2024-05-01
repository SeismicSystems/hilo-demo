/*
 * A base contract for HiLo style games. Contains logic for running rounds, 
 * accepting bets, and distributing winnings.
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
    uint8 public latestMark;
    bool private activeGame;

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

    /*
     * Claim a player slot.
     */
    function claimPlayer(
        uint8 index
    ) external requireValidPlayerIndex(index) requirePlayerNotClaimed(index) {
        Player storage player = players[index];
        player.addr = msg.sender;
        player.chips = startingChips;
        attemptStartGame();
    }

    /*
     * Game can begin once both player slots are claimed.
     */
    function attemptStartGame() internal {
        if (isAllClaimed()) {
            activeGame = true;
            latestMark = sampleNextMark();
            attemptOpenRound();
        }
    }

    /*
     * New round can begin when both players have revealed their bets for the 
     * current round.
     */
    function attemptOpenRound() internal {
        if (isAllRevealed()) {
            if (!activeGame) {
                emit GameEnd(getWinner());
            } else {
                emit OpenRound(currentRound);
            }
        }
    }

    /*
     * Round closes when both players have committed to their bets. 
     */
    function attemptCloseRound() internal {
        if (isAllCommitted()) {
            emit CloseRound(currentRound);
            currentRound++;
            if (currentRound == nRounds) {
                activeGame = false;
            }
        }
    }

    /*
     * Check whether both player slots are claimed. Only supports 1v1 for now.
     */
    function isAllClaimed() internal view returns (bool) {
        return (players[0].addr != address(0) && players[1].addr != address(0));
    }

    /*
     * Check whether both players have committed to their bets for this round.
     */
    function isAllCommitted() internal view returns (bool) {
        return (players[0].crTracker.nCommitted > currentRound &&
            players[1].crTracker.nCommitted > currentRound);
    }

    /*
     * Check whether both players have revealed their bets for this round.
     */
    function isAllRevealed() internal view returns (bool) {
        return (players[0].crTracker.nRevealed == currentRound &&
            players[1].crTracker.nRevealed == currentRound);
    }

    /*
     * Player with more chips at the end of the game wins. Currently doesn't 
     * handle ties. In the event of both players having the same number of 
     * chips, Player #1 is given the victory.
     */
    function getWinner() internal view returns (uint8) {
        return players[0].chips > players[1].chips ? 0 : 1;
    }

    /*
     * Method of sampling the next round's mark varies per instantiation. Could 
     * be a draw form a deck of cards or a roll with two dice.
     */
    function sampleNextMark() public virtual returns (uint8);

    /*
     * Updates chips for both players depending on round outcome. Pushes if new 
     * mark is the same as the current (so not higher or lower).
     */
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

    /*
     * Player bets N chips in a round. At the end of the round. These N chips
     * turn into 0 if the player is wrong, or N*multiplier if the player is
     * correct. 
     */
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

    /*
     * Multipliers are laid out during contract init. Done to reward riskier
     * bets with more upside.
     */
    function scaledMultiplierLookup(
        bool direction,
        uint8 mark
    ) public view returns (uint128) {
        return
            direction
                ? multipliers[mark]
                : multipliers[multipliers.length - mark - 1];
    }

    /*
     * Accepts keccak hash of bet as commitment.
     */
    function commitBet(uint256 betCommit) external requireActiveAndUncommitted {
        emit CommitBet(betCommit);
        Player storage pl = getPlayer();
        pl.crTracker.latestCommit = betCommit;
        pl.crTracker.nCommitted++;
        attemptCloseRound();
    }

    /*
     * The revealed bet must match the keccak hash submitted during the commit
     * phase. If it is indeed a valid opening, then this function distributes 
     * chip winnings and opens a new round if appropriate.
     */
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

    /*
     * Returns player object of current transaction signer.
     */
    function getPlayer() internal view returns (Player storage) {
        return msg.sender == players[0].addr ? players[0] : players[1];
    }

    /*
     * Returns the number of chips owned by the player at a given index.
     */
    function getChips(
        uint8 index
    ) external view requireValidPlayerIndex(index) returns (uint128) {
        return players[index].chips;
    }

    /*
     * Checks whether a bet is the opening to a previous commitment.
     */
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

    /*
     * Checks whether a player went over their chip balance in their last bet.
     */
    modifier requireSufficientChips(uint128 amount) {
        require(
            getPlayer().chips >= amount,
            "Cannot bet more chips that you own"
        );
        _;
    }

    /*
     * Players can only bet once per open round.
     */
    modifier requireActiveAndUncommitted() {
        require(activeGame, "Game is currently not active.");
        require(
            getPlayer().crTracker.nCommitted == currentRound,
            "Already made a move this round."
        );
        _;
    }

    /*
     * Players can only reveal bets and claim winnings once per closed round.
     */
    modifier requireRevealOnce() {
        require(
            getPlayer().crTracker.nRevealed == currentRound - 1,
            "Can only reveal bet once for previous round."
        );
        _;
    }

    /*
     * Can't claim a slot that's already taken. 
     */
    modifier requirePlayerNotClaimed(uint8 index) {
        require(
            players[index].addr == address(0),
            "Player has already been claimed."
        );
        _;
    }

    /*
     * Demo only supports two players for now.
     */
    modifier requireValidPlayerIndex(uint8 index) {
        require(index < 2, "Invalid player index.");
        _;
    }
}
