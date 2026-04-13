document.addEventListener('DOMContentLoaded', () => {
    // --- Constants & Game State ---
    const BOARD_SIZE = 8;
    const EMPTY = 0;
    const RED = 1;
    const BLACK = 2;
    const RED_KING = 3;
    const BLACK_KING = 4;

    let board = [];
    let currentTurn = RED; // Red moves first
    let selectedSquare = null; // {row, col}
    let validMoves = []; // Array of valid move objects for the selected piece
    let mustJumpList = []; // Array of pieces that MUST jump
    let activeJumpDir = null; // If a multi-jump is in progress, restrict selected piece
    let pieceCounts = { red: 12, black: 12 };

    // DOM Elements
    const boardEl = document.getElementById('board');
    const redCountEl = document.getElementById('red-count');
    const blackCountEl = document.getElementById('black-count');
    const turnTextEl = document.getElementById('turn-text');
    const playerRedInfo = document.getElementById('player-red-info');
    const playerBlackInfo = document.getElementById('player-black-info');
    const modal = document.getElementById('game-over-modal');
    const winnerText = document.getElementById('winner-text');
    const winnerSubtext = document.getElementById('winner-subtext');
    const restartBtns = [document.getElementById('restart-btn'), document.getElementById('modal-restart-btn')];

    // --- Initialization ---

    function initGame() {
        board = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            let row = [];
            for (let c = 0; c < BOARD_SIZE; c++) {
                if ((r + c) % 2 === 1) {
                    if (r < 3) row.push(BLACK);
                    else if (r > 4) row.push(RED);
                    else row.push(EMPTY);
                } else {
                    row.push(null); // Unplayable light square
                }
            }
            board.push(row);
        }

        currentTurn = RED;
        selectedSquare = null;
        validMoves = [];
        mustJumpList = [];
        activeJumpDir = null;
        pieceCounts = { red: 12, black: 12 };

        modal.classList.add('hidden');
        
        updateUI();
        detectMandatoryJumps();
        renderBoard();
    }

    // --- Core Logic ---

    function getPieceColor(val) {
        if (val === RED || val === RED_KING) return RED;
        if (val === BLACK || val === BLACK_KING) return BLACK;
        return null;
    }

    function isKing(val) {
        return val === RED_KING || val === BLACK_KING;
    }

    function isValidPos(r, c) {
        return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
    }

    // Identify standard valid moves or jumps for a particular piece
    function getAvailableMoves(r, c) {
        const piece = board[r][c];
        if (!piece) return [];
        
        const pieceColor = getPieceColor(piece);
        const isPieceKing = isKing(piece);
        
        const moves = [];
        
        // Directions: [rowDelta, colDelta]
        // Red moves UP (-1), Black moves DOWN (+1)
        const dirs = [];
        if (pieceColor === RED || isPieceKing) {
            dirs.push([-1, -1], [-1, 1]); // Up-left, Up-right
        }
        if (pieceColor === BLACK || isPieceKing) {
            dirs.push([1, -1], [1, 1]); // Down-left, Down-right
        }

        if (isPieceKing) {
            for (const [dr, dc] of dirs) {
                let nr = r + dr;
                let nc = c + dc;
                let foundOpponent = false;
                let opponentPos = null;

                while (isValidPos(nr, nc)) {
                    const target = board[nr][nc];

                    if (target === EMPTY) {
                        if (!foundOpponent) {
                            moves.push({ type: 'move', toRow: nr, toCol: nc });
                        } else {
                            moves.push({ type: 'jump', toRow: nr, toCol: nc, jumpRow: opponentPos.r, jumpCol: opponentPos.c });
                        }
                    } else if (getPieceColor(target) !== pieceColor && target !== null) {
                        if (!foundOpponent) {
                            // First opponent piece found along diagonal
                            foundOpponent = true;
                            opponentPos = { r: nr, c: nc };
                        } else {
                            // Two consecutive pieces cannot be jumped
                            break;
                        }
                    } else {
                        // Blocked by own piece or unplayable square (though diagonals are always dark)
                        break;
                    }

                    nr += dr;
                    nc += dc;
                }
            }
        } else {
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                
                if (!isValidPos(nr, nc)) continue;

                const target = board[nr][nc];

                // Regular move
                if (target === EMPTY) {
                    moves.push({ type: 'move', toRow: nr, toCol: nc });
                } 
                // Potential jump
                else if (getPieceColor(target) !== pieceColor && target !== null) {
                    const jr = nr + dr;
                    const jc = nc + dc;
                    if (isValidPos(jr, jc) && board[jr][jc] === EMPTY) {
                        moves.push({ type: 'jump', toRow: jr, toCol: jc, jumpRow: nr, jumpCol: nc });
                    }
                }
            }
        }
        return moves;
    }

    // Detect if ANY player pieces have jumps available. Must be recalced each turn.
    function detectMandatoryJumps() {
        mustJumpList = [];
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] && getPieceColor(board[r][c]) === currentTurn) {
                    const moves = getAvailableMoves(r, c);
                    const jumps = moves.filter(m => m.type === 'jump');
                    if (jumps.length > 0) {
                        mustJumpList.push({ r, c });
                    }
                }
            }
        }
    }

    // Check if the current player has any possible moves
    function hasAnyValidMoves() {
        if (mustJumpList.length > 0) return true;
        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                if (board[r][c] && getPieceColor(board[r][c]) === currentTurn) {
                    const moves = getAvailableMoves(r, c);
                    if (moves.length > 0) return true;
                }
            }
        }
        return false;
    }

    function checkWinCondition() {
        if (pieceCounts.red === 0) return showWinner(BLACK, "All red pieces captured.");
        if (pieceCounts.black === 0) return showWinner(RED, "All black pieces captured.");
        
        if (!hasAnyValidMoves()) {
            const winnerUrl = currentTurn === RED ? BLACK : RED;
            const text = currentTurn === RED ? "Red has no valid moves." : "Black has no valid moves.";
            return showWinner(winnerUrl, text);
        }
    }

    function showWinner(winner, reason) {
        winnerText.textContent = winner === RED ? "Red Wins!" : "Black Wins!";
        winnerText.style.color = winner === RED ? "var(--piece-red)" : "white"; // Can visually adjust later
        winnerSubtext.textContent = reason;
        modal.classList.remove('hidden');
    }

    // --- Interaction Logic ---

    function handleSquareClick(r, c) {
        // If square isn't playable
        if (board[r][c] === null) return;

        // If clicking on own piece
        if (board[r][c] && getPieceColor(board[r][c]) === currentTurn) {
            // Cannot select another piece if currently forced to multi-jump
            if (activeJumpDir) return;

            // If mandatory jumps exist, can only select pieces that can jump
            if (mustJumpList.length > 0) {
                const canJump = mustJumpList.some(p => p.r === r && p.c === c);
                if (!canJump) return; // Flash effect could be added here
            }

            selectedSquare = { r, c };
            
            // Filter moves: if jump exists, only allow jumps. 
            // (If mustJumpList > 0, this piece guaranteed has jumps thanks to check above)
            const moves = getAvailableMoves(r, c);
            if (mustJumpList.length > 0) {
                validMoves = moves.filter(m => m.type === 'jump');
            } else {
                validMoves = moves;
            }
            renderBoard();
            return;
        }

        // If a piece is selected, check if clicked square is a valid target
        if (selectedSquare) {
            const move = validMoves.find(m => m.toRow === r && m.toCol === c);
            if (move) {
                executeMove(selectedSquare.r, selectedSquare.c, move);
                // executeMove forces render
                return;
            } else {
                // Cancel selection if clicking empty square or elsewhere (if not in forced jump)
                if (!activeJumpDir) {
                    selectedSquare = null;
                    validMoves = [];
                    renderBoard();
                }
            }
        }
    }

    function executeMove(fromRow, fromCol, move) {
        const piece = board[fromRow][fromCol];
        let val = piece;
        
        // Move piece
        board[fromRow][fromCol] = EMPTY;
        board[move.toRow][move.toCol] = val;
        
        let jumpOccurred = false;

        // Handle capture
        if (move.type === 'jump') {
            const capturedPieceColor = getPieceColor(board[move.jumpRow][move.jumpCol]);
            board[move.jumpRow][move.jumpCol] = EMPTY;
            if (capturedPieceColor === RED) pieceCounts.red--;
            else pieceCounts.black--;
            jumpOccurred = true;
        }

        // Check King Promotion (ends turn immediately even if jump possible - standard US rules)
        let promoted = false;
        if (getPieceColor(val) === RED && move.toRow === 0 && val !== RED_KING) {
            board[move.toRow][move.toCol] = RED_KING;
            promoted = true;
        } else if (getPieceColor(val) === BLACK && move.toRow === BOARD_SIZE - 1 && val !== BLACK_KING) {
            board[move.toRow][move.toCol] = BLACK_KING;
            promoted = true;
        }

        updateUI();

        // Check for multi-jumps
        if (jumpOccurred && !promoted) {
            const nextMoves = getAvailableMoves(move.toRow, move.toCol);
            const nextJumps = nextMoves.filter(m => m.type === 'jump');
            if (nextJumps.length > 0) {
                // Multi-jump must be taken
                selectedSquare = { r: move.toRow, c: move.toCol };
                validMoves = nextJumps;
                activeJumpDir = true;
                renderBoard(); // keep same turn
                return;
            }
        }

        endTurn();
    }

    function endTurn() {
        currentTurn = currentTurn === RED ? BLACK : RED;
        selectedSquare = null;
        validMoves = [];
        activeJumpDir = null;
        
        detectMandatoryJumps();
        updateUI();
        renderBoard();
        checkWinCondition();
    }

    // --- Rendering ---

    function updateUI() {
        redCountEl.textContent = pieceCounts.red;
        blackCountEl.textContent = pieceCounts.black;
        
        if (currentTurn === RED) {
            playerRedInfo.classList.add('active-turn');
            playerBlackInfo.classList.remove('active-turn');
            turnTextEl.textContent = "Red's Turn";
            turnTextEl.className = "turn-text-red";
        } else {
            playerBlackInfo.classList.add('active-turn');
            playerRedInfo.classList.remove('active-turn');
            turnTextEl.textContent = "Black's Turn";
            turnTextEl.className = "turn-text-black";
        }
    }

    function renderBoard() {
        boardEl.innerHTML = ''; // clear

        for (let r = 0; r < BOARD_SIZE; r++) {
            for (let c = 0; c < BOARD_SIZE; c++) {
                const square = document.createElement('div');
                square.className = 'square';
                
                // Color
                if ((r + c) % 2 === 0) {
                    square.classList.add('light');
                } else {
                    square.classList.add('dark');
                    square.classList.add('playable');
                    
                    // Click handler
                    square.addEventListener('mousedown', () => handleSquareClick(r, c));

                    // Highlight Selected
                    if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                        square.classList.add('selected');
                    }

                    // Highlight Valid Moves
                    const move = validMoves.find(m => m.toRow === r && m.toCol === c);
                    if (move) {
                        if (move.type === 'jump') square.classList.add('valid-capture');
                        else square.classList.add('valid-move');
                    }

                    // Render Piece
                    const val = board[r][c];
                    if (val !== EMPTY && val !== null) {
                        const piece = document.createElement('div');
                        piece.className = 'piece';
                        
                        if (val === RED) piece.classList.add('red');
                        if (val === RED_KING) piece.classList.add('red', 'king');
                        if (val === BLACK) piece.classList.add('black');
                        if (val === BLACK_KING) piece.classList.add('black', 'king');
                        
                        square.appendChild(piece);
                    }
                }

                boardEl.appendChild(square);
            }
        }
    }

    // --- Events ---
    restartBtns.forEach(btn => btn.addEventListener('click', initGame));

    // Bootstrap
    initGame();
});
