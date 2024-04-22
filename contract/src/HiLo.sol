pragma solidity ^0.8.25;

contract HiLo {
    struct Player {
        address addr;
        uint8 nBetsPlaced;
    }

    Player public A;
    Player public B;
    uint256 private nRounds;
    uint256 private currentRound;
    bool private activeGame;

    event StartRound(uint256 roundIndex);
    event GameEnd();

    constructor(uint256 _nRounds) {
        nRounds = _nRounds;
    }

    function attemptStartGame() internal {
        if (A.addr != address(0) && B.addr != address(0)) {
            activeGame = true;
            emit StartRound(currentRound);
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

    function attemptIncrementRound() internal {
        if (A.nBetsPlaced > currentRound && B.nBetsPlaced > currentRound) {
            currentRound++;
            emit StartRound(currentRound);
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

    function bet() external openTurn {
        getPlayer().nBetsPlaced++;
        attemptIncrementRound();
        attemptEndGame();
    }

    function attemptEndGame() internal {
        if (currentRound == nRounds) {
            activeGame = false;
            emit GameEnd();
        }
    }

    modifier openTurn() {
        require(activeGame, "Game is currently not active.");
        require(
            getPlayer().nBetsPlaced == currentRound,
            "Already made a move this round."
        );
        _;
    }

    modifier playerNotClaimed(Player storage player) {
        require(player.addr == address(0), "Player has already been claimed.");
        _;
    }
}
