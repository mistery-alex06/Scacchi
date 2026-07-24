// Initialize Chess instance
const game = new Chess();

const boardElement = document.getElementById('board');
const statusElement = document.getElementById('turn-text');
const turnDotElement = document.getElementById('turn-dot');
const checkStatusElement = document.getElementById('check-status');
const moveHistoryElement = document.getElementById('move-history');
const resetBtn = document.getElementById('reset-btn');
const flipBtn = document.getElementById('flip-btn');
const themeSelect = document.getElementById('theme-select');
const difficultySelect = document.getElementById('difficulty-select');
const difficultyGroup = document.getElementById('difficulty-group');
const modeSelect = document.getElementById('mode-select');

let selectedSquare = null;
let orientation = 'white';
let gameMode = 'pvp'; // pvp, pvc
let aiDelay = 800; // Increased delay for better pacing
let aiLevel = 1;
let isAiThinking = false; // Flag to explicitly block input

// Theme Handling
themeSelect.addEventListener('change', (e) => {
    // Remove old theme
    document.body.classList.forEach(cls => {
        if (cls.startsWith('theme-')) {
            document.body.classList.remove(cls);
        }
    });
    // Add new theme
    document.body.classList.add(`theme-${e.target.value}`);
});
// Set default
document.body.classList.add('theme-glass');


// Game Mode Handling
modeSelect.addEventListener('change', (e) => {
    gameMode = e.target.value;
    if (gameMode === 'pvc') {
        difficultyGroup.classList.remove('hidden');
        if (game.turn() === 'b') {
            triggerAiMove();
        }
    } else {
        difficultyGroup.classList.add('hidden');
    }
});

difficultySelect.addEventListener('change', (e) => {
    aiLevel = parseInt(e.target.value);
});

// Helper for piece icons
function getPieceIcon(piece) {
    if (!piece) return null;
    const color = piece.color === 'w' ? 'white' : 'black';
    const type = piece.type;
    const baseUrl = 'https://upload.wikimedia.org/wikipedia/commons';
    const map = {
        'p': { w: `${baseUrl}/4/45/Chess_plt45.svg`, b: `${baseUrl}/c/c7/Chess_pdt45.svg` },
        'r': { w: `${baseUrl}/7/72/Chess_rlt45.svg`, b: `${baseUrl}/f/ff/Chess_rdt45.svg` },
        'n': { w: `${baseUrl}/7/70/Chess_nlt45.svg`, b: `${baseUrl}/e/ef/Chess_ndt45.svg` },
        'b': { w: `${baseUrl}/b/b1/Chess_blt45.svg`, b: `${baseUrl}/9/98/Chess_bdt45.svg` },
        'q': { w: `${baseUrl}/1/15/Chess_qlt45.svg`, b: `${baseUrl}/4/47/Chess_qdt45.svg` },
        'k': { w: `${baseUrl}/4/42/Chess_klt45.svg`, b: `${baseUrl}/f/f0/Chess_kdt45.svg` },
    };
    return map[type][piece.color];
}

function renderBoard() {
    boardElement.innerHTML = '';
    const board = game.board();
    const rows = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    rows.forEach(rowIndex => {
        cols.forEach(colIndex => {
            const squareColor = (rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark';
            const squareId = String.fromCharCode(97 + colIndex) + (8 - rowIndex);
            const piece = board[rowIndex][colIndex];

            const squareDiv = document.createElement('div');
            squareDiv.classList.add('square', squareColor);
            squareDiv.dataset.square = squareId;

            // Highlight last move (optional, but good for feedback)
            // ...

            if (selectedSquare === squareId) squareDiv.classList.add('selected');

            if (selectedSquare) {
                const moves = game.moves({ square: selectedSquare, verbose: true });
                const move = moves.find(m => m.to === squareId);
                if (move) {
                    squareDiv.classList.add(move.flags.includes('c') || move.flags.includes('e') ? 'capture-move' : 'possible-move');
                }
            }

            if (piece) {
                const img = document.createElement('img');
                img.src = getPieceIcon(piece);
                img.classList.add('piece');
                squareDiv.appendChild(img);
                if (piece.type === 'k' && piece.color === game.turn() && game.in_check()) {
                    squareDiv.classList.add('in-check');
                }
            }

            squareDiv.addEventListener('click', () => onSquareClick(squareId));
            boardElement.appendChild(squareDiv);
        });
    });

    updateStatus();
    updateHistory();
    updateCapturedPieces();
}

// Improved Animation using Floating Clone
function animateMove(from, to, callback) {
    const fromSquare = document.querySelector(`[data-square="${from}"]`);
    const fromPiece = fromSquare ? fromSquare.querySelector('.piece') : null;
    const toSquare = document.querySelector(`[data-square="${to}"]`);

    if (!fromPiece || !toSquare) {
        callback();
        return;
    }

    // Create a clone
    const clone = fromPiece.cloneNode(true);
    const fromRect = fromPiece.getBoundingClientRect();
    const toRect = toSquare.getBoundingClientRect();

    // Set initial position of clone
    clone.style.position = 'fixed';
    clone.style.left = `${fromRect.left}px`;
    clone.style.top = `${fromRect.top}px`;
    clone.style.width = `${fromRect.width}px`;
    clone.style.height = `${fromRect.height}px`;
    clone.style.zIndex = '1000';
    clone.style.pointerEvents = 'none';
    clone.style.transition = 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)'; // Smooth ease-out

    document.body.appendChild(clone);

    // Hide original
    fromPiece.style.opacity = '0';

    // Force reflow
    void clone.offsetWidth;

    // Move clone to new position
    clone.style.left = `${toRect.left}px`;
    clone.style.top = `${toRect.top}px`;

    // Wait for transition
    clone.addEventListener('transitionend', () => {
        clone.remove();
        callback(); // Execute actual move and render
    }, { once: true });

    // Safety fallback
    setTimeout(() => {
        if (clone.parentNode) {
            clone.remove();
            callback();
        }
    }, 450);
}

function onSquareClick(squareId) {
    // Strictly block if AI is thinking
    if (isAiThinking) return;
    if (gameMode === 'pvc' && game.turn() === 'b') return;

    const piece = game.get(squareId);

    if (selectedSquare === null) {
        if (piece && piece.color === game.turn()) {
            selectedSquare = squareId;
            renderBoard();
        }
    } else {
        if (selectedSquare === squareId) {
            selectedSquare = null;
            renderBoard();
            return;
        }

        const moves = game.moves({ verbose: true });
        const move = moves.find(m => m.from === selectedSquare && m.to === squareId);

        if (move) {
            // Player Move
            animateMove(selectedSquare, squareId, () => {
                game.move({ from: selectedSquare, to: squareId, promotion: 'q' });
                selectedSquare = null;
                renderBoard();

                // Trigger AI if PvC
                if (gameMode === 'pvc' && !game.game_over()) {
                    triggerAiMove();
                }
            });
        } else {
            // If clicked on own piece, switch selection
            if (piece && piece.color === game.turn()) {
                selectedSquare = squareId;
                renderBoard();
            } else {
                selectedSquare = null;
                renderBoard();
            }
        }
    }
}

// Simplified AI Logic
function makeComputerMove() {
    if (game.game_over()) return;

    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return;

    let chosenMove = null;

    // Difficulty Logic
    // Level 1: Pure Random
    if (aiLevel === 1) {
        const randomIndex = Math.floor(Math.random() * moves.length);
        chosenMove = moves[randomIndex];
    }
    // Level 2: Random + Prioritize Captures
    else if (aiLevel === 2) {
        // Filter for captures
        const captures = moves.filter(m => m.flags.includes('c') || m.flags.includes('e'));
        if (captures.length > 0) {
            // Pick a random capture
            chosenMove = captures[Math.floor(Math.random() * captures.length)];
        } else {
            chosenMove = moves[Math.floor(Math.random() * moves.length)];
        }
    }
    // Level 3: Simple Evasion & Capture (Aggressive Random)
    else if (aiLevel >= 3) {
        // Score moves roughly
        // 1. Checkmate (if immediate)
        // 2. Promotion
        // 3. Captures
        // 4. Random

        const scoredMoves = moves.map(move => {
            let score = Math.random() * 10; // Base random score 0-10

            // Try the move to see if it checks/mates
            game.move(move);
            if (game.in_checkmate()) score += 1000;
            if (game.in_check()) score += 50;
            game.undo();

            if (move.flags.includes('c') || move.flags.includes('e')) score += 20;
            if (move.promotion) score += 30;

            // Basic safety: don't move piece to where it can be captured easily? (Too complex for simple random req, skipping)

            return { move, score };
        });

        // Sort by score desc
        scoredMoves.sort((a, b) => b.score - a.score);

        // Pick top 1 (or top 3 for variation if level < 5)
        if (aiLevel < 5) {
            // Pick from top 3 to keep some randomness
            const topCandidates = scoredMoves.slice(0, 3);
            chosenMove = topCandidates[Math.floor(Math.random() * topCandidates.length)].move;
        } else {
            chosenMove = scoredMoves[0].move;
        }
    }

    // Fallback
    if (!chosenMove) {
        chosenMove = moves[Math.floor(Math.random() * moves.length)];
    }

    // Execute Move with Animation
    animateMove(chosenMove.from, chosenMove.to, () => {
        game.move(chosenMove);
        renderBoard();
        isAiThinking = false; // Release lock

        // Check game over here
        if (game.game_over()) {
            updateStatus();
        }
    });
}

function triggerAiMove() {
    if (isAiThinking) return; // Prevent double triggers
    isAiThinking = true;

    // UI Feedback: maybe dim board or show spinner?
    // For now just delay
    setTimeout(() => {
        try {
            makeComputerMove();
        } catch (e) {
            console.error("AI Error:", e);
            isAiThinking = false; // Release lock on error
        }
    }, aiDelay);
}

// ... existing update functions ...
// Keep updateStatus, updateCapturedPieces from previous

function updateStatus() {
    let status = '';
    const turn = game.turn() === 'w' ? 'White' : 'Black';
    if (game.in_checkmate()) {
        status = `Game over, ${turn} is in checkmate.`;
        checkStatusElement.textContent = 'CHECKMATE!';
        checkStatusElement.classList.remove('hidden');
    } else if (game.in_draw()) {
        status = 'Game over, drawn position';
        checkStatusElement.textContent = 'DRAW!';
        checkStatusElement.classList.remove('hidden');
    } else {
        status = `${turn} to move`;
        if (game.in_check()) {
            checkStatusElement.textContent = 'CHECK!';
            checkStatusElement.classList.remove('hidden');
        } else {
            checkStatusElement.classList.add('hidden');
        }
    }
    statusElement.textContent = status;
    turnDotElement.className = `dot ${game.turn() === 'w' ? 'white' : 'black'}`;
}

function updateHistory() {
    moveHistoryElement.innerHTML = '';
    const history = game.history();
    history.forEach((move, index) => {
        const span = document.createElement('span');
        span.classList.add('move-entry');
        if (index % 2 === 0) {
            const num = document.createElement('span');
            num.textContent = `${Math.floor(index / 2) + 1}.`;
            num.style.color = '#64748b';
            num.style.marginRight = '4px';
            moveHistoryElement.appendChild(num);
        }
        span.textContent = move;
        moveHistoryElement.appendChild(span);
    });
    moveHistoryElement.parentElement.scrollTop = moveHistoryElement.parentElement.scrollHeight;
}

function updateCapturedPieces() {
    const board = game.board();
    const currentCounts = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };

    board.flat().forEach(piece => {
        if (piece && piece.type !== 'k') currentCounts[piece.color][piece.type]++;
    });

    const startingCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const capturedByWhite = [];
    const capturedByBlack = [];
    const pieceValues = { p: 1, n: 3, b: 3, r: 5, q: 9 };
    let whiteMaterial = 0;
    let blackMaterial = 0;

    Object.keys(startingCounts).forEach(type => {
        const whiteLost = startingCounts[type] - currentCounts['w'][type];
        const blackLost = startingCounts[type] - currentCounts['b'][type];

        for (let i = 0; i < whiteLost; i++) capturedByBlack.push({ type, color: 'w' });
        for (let i = 0; i < blackLost; i++) capturedByWhite.push({ type, color: 'b' });

        whiteMaterial += currentCounts['w'][type] * pieceValues[type];
        blackMaterial += currentCounts['b'][type] * pieceValues[type];
    });

    const wContainer = document.getElementById('captured-white');
    const bContainer = document.getElementById('captured-black');
    wContainer.innerHTML = '';
    bContainer.innerHTML = '';

    capturedByWhite.forEach(p => {
        const img = document.createElement('img');
        img.src = getPieceIcon(p);
        wContainer.appendChild(img);
    });

    capturedByBlack.forEach(p => {
        const img = document.createElement('img');
        img.src = getPieceIcon(p);
        bContainer.appendChild(img);
    });

    const wScore = document.getElementById('score-white');
    const bScore = document.getElementById('score-black');
    let diff = whiteMaterial - blackMaterial;

    wScore.textContent = diff > 0 ? `+${diff}` : '';
    bScore.textContent = diff < 0 ? `+${Math.abs(diff)}` : '';
}

resetBtn.addEventListener('click', () => {
    game.reset();
    selectedSquare = null;
    gameMode = modeSelect.value; // ensure mode is respected
    renderBoard();
});

flipBtn.addEventListener('click', () => {
    orientation = orientation === 'white' ? 'black' : 'white';
    renderBoard();
});

// Initial Render
// Initial Render
renderBoard();

// Device Detection
function detectDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 900;
    if (isMobile) {
        document.body.classList.add('is-mobile');
        document.body.classList.remove('is-desktop');
    } else {
        document.body.classList.add('is-desktop');
        document.body.classList.remove('is-mobile');
    }
}

window.addEventListener('resize', detectDevice);
detectDevice(); // Run on load
