pragma solidity ^0.8.25;

contract HiLo {
    struct Player {
        address addr;
        uint8 nBetsCommitted;
        uint8 nBetsRevealed;
        uint256 chips;
    }

    Player public A;
    Player public B;
    uint256 private nRounds;
    uint256 private currentRound;
    bool private activeGame;

    event OpenRound(uint256 roundIndex);
    event CloseRound(uint256 roundIndex);
    event GameEnd();

    constructor(uint256 _nRounds) {
        nRounds = _nRounds;
    }

    function attemptStartGame() internal {
        if (A.addr != address(0) && B.addr != address(0)) {
            activeGame = true;
            emit OpenRound(currentRound);
        }
    }

    function claimPlayer(
        Player storage player
    ) internal playerNotClaimed(player) {
        player.addr = msg.sender;
        attemptStartGame();
    }

    function claimPlayerA() external {
        claimPlayer(A);
    }

    function claimPlayerB() external {
        claimPlayer(B);
    }

    function attemptCloseRound() internal {
        if (
            A.nBetsCommitted > currentRound && B.nBetsCommitted > currentRound
        ) {
            emit CloseRound(currentRound);
            currentRound++;
            if (currentRound == nRounds) {
                activeGame = false;
                emit GameEnd();
            }
        }
    }

    function attemptAlertNewRound() internal {
        if (
            A.nBetsRevealed == currentRound && B.nBetsRevealed == currentRound
        ) {
            emit OpenRound(currentRound);
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

    // caution, doesn't block new commitments before claiming
    function revealBet() external requireRevealOnce {
        getPlayer().nBetsRevealed++;
        attemptAlertNewRound();
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
