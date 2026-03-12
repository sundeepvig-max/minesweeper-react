// DOM Elements
const boardEl = document.getElementById('board');
const difficultySelect = document.getElementById('difficulty');
const flagsCountEl = document.getElementById('flags-count');
const timerDisplayEl = document.getElementById('timer-display');
const restartBtn = document.getElementById('restart-btn');
const restartIcon = restartBtn.querySelector('.icon');

// Audio Elements
const clickSound = document.getElementById('click-sound');
const flagSound = document.getElementById('flag-sound');
const winSound = document.getElementById('win-sound');
const loseSound = document.getElementById('lose-sound');

// Game Settings
const DIFFICULTIES = {
    easy: { rows: 8, cols: 10, mines: 10 },
    medium: { rows: 14, cols: 18, mines: 40 },
    hard: { rows: 20, cols: 24, mines: 99 }
};

// State
let currentDiff = 'easy';
let rows, cols, totalMines;
let board = [];
let mines = [];
let flags = 0;
let revealedCount = 0;
let timer = null;
let seconds = 0;
let gameOver = false;
let firstClick = true;

// Emojis
const EMOJI_SMILE = '😊';
const EMOJI_OOH = '😮';
const EMOJI_DEAD = '😵';
const EMOJI_WIN = '😎';

// Icons
const ICON_MINE = '💣';
const ICON_FLAG = '🚩';

// Initialize events
function init() {
    difficultySelect.addEventListener('change', (e) => {
        currentDiff = e.target.value;
        startGame();
    });
    
    restartBtn.addEventListener('mousedown', () => !gameOver && setFace(EMOJI_OOH));
    restartBtn.addEventListener('mouseup', () => setFace(gameOver ? (board.length && revealedCount === (rows*cols-totalMines) ? EMOJI_WIN : EMOJI_DEAD) : EMOJI_SMILE));
    restartBtn.addEventListener('click', startGame);
    
    // Prevent context menu globally on the board
    boardEl.addEventListener('contextmenu', e => e.preventDefault());
    
    // Setup audio volume
    clickSound.volume = 0.5;
    flagSound.volume = 0.5;
    winSound.volume = 0.6;
    loseSound.volume = 0.6;
    
    startGame();
}

function startGame() {
    // Reset state
    clearInterval(timer);
    timer = null;
    seconds = 0;
    gameOver = false;
    firstClick = true;
    revealedCount = 0;
    board = [];
    mines = [];
    
    // Get settings
    const settings = DIFFICULTIES[currentDiff];
    rows = settings.rows;
    cols = settings.cols;
    totalMines = settings.mines;
    flags = totalMines;
    
    // Update UI
    updateFlagsUI();
    updateTimerUI();
    setFace(EMOJI_SMILE);
    
    // Build grid
    buildGrid();
}

function buildGrid() {
    boardEl.innerHTML = '';
    boardEl.style.gridTemplateColumns = `repeat(${cols}, 30px)`;
    boardEl.style.gridTemplateRows = `repeat(${rows}, 30px)`;
    
    // Create elements
    for (let r = 0; r < rows; r++) {
        let rowArray = [];
        for (let c = 0; c < cols; c++) {
            const cellState = {
                r, c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0,
                el: document.createElement('div')
            };
            
            const cellEl = cellState.el;
            cellEl.classList.add('cell');
            // Checkerboard pattern
            const isLightColor = (r % 2 === 0 && c % 2 === 0) || (r % 2 !== 0 && c % 2 !== 0);
            cellEl.classList.add(isLightColor ? 'light' : 'dark');
            cellEl.dataset.r = r;
            cellEl.dataset.c = c;
            
            // Events
            cellEl.addEventListener('mousedown', (e) => handleMouseDown(e, r, c));
            cellEl.addEventListener('mouseup', (e) => handleMouseUp(e, r, c));
            cellEl.addEventListener('contextmenu', (e) => { e.preventDefault(); handleRightClick(r, c); });
            // For mobile long-press
            let touchTimer;
            cellEl.addEventListener('touchstart', (e) => {
                if (gameOver) return;
                setFace(EMOJI_OOH);
                touchTimer = setTimeout(() => {
                    handleRightClick(r, c);
                    touchTimer = null;
                }, 400); // 400ms for long press
            });
            cellEl.addEventListener('touchend', (e) => {
                if(touchTimer) {
                    clearTimeout(touchTimer);
                    // treat as left click if not long press
                    handleClick(r, c);
                }
                if (!gameOver) setFace(EMOJI_SMILE);
            });
            
            boardEl.appendChild(cellEl);
            rowArray.push(cellState);
        }
        board.push(rowArray);
    }
}

function plantMines(safeR, safeC) {
    let minesPlaced = 0;
    while (minesPlaced < totalMines) {
        const r = Math.floor(Math.random() * rows);
        const c = Math.floor(Math.random() * cols);
        
        // Don't place mine on the first clicked cell or its immediate neighbors
        // (to guarantee an opening of zero)
        const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
        
        if (!board[r][c].isMine && !isSafeZone) {
            board[r][c].isMine = true;
            mines.push({r, c});
            minesPlaced++;
        }
    }
    
    // Calculate neighbors
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (!board[r][c].isMine) {
                let count = 0;
                for (let nr = r - 1; nr <= r + 1; nr++) {
                    for (let nc = c - 1; nc <= c + 1; nc++) {
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && board[nr][nc].isMine) {
                            count++;
                        }
                    }
                }
                board[r][c].neighborMines = count;
            }
        }
    }
}

function handleMouseDown(e, r, c) {
    if (gameOver) return;
    if (e.button === 0 && !board[r][c].isRevealed && !board[r][c].isFlagged) {
        setFace(EMOJI_OOH);
    }
}

function handleMouseUp(e, r, c) {
    if (gameOver) return;
    if (e.button === 0) {
        setFace(EMOJI_SMILE);
        handleClick(r, c);
    }
}

function handleClick(r, c) {
    if (gameOver) return;
    const cell = board[r][c];
    
    if (cell.isRevealed || cell.isFlagged) return;
    
    if (firstClick) {
        plantMines(r, c);
        startTimer();
        firstClick = false;
    }
    
    playSound(clickSound);
    revealCell(r, c);
    checkWinCondition();
}

function handleRightClick(r, c) {
    if (gameOver || firstClick) return;
    
    const cell = board[r][c];
    if (cell.isRevealed) return;
    
    playSound(flagSound);
    
    if (cell.isFlagged) {
        cell.isFlagged = false;
        cell.el.innerHTML = '';
        flags++;
    } else {
        if (flags > 0) {
            cell.isFlagged = true;
            cell.el.innerHTML = `<span class="flag-icon">${ICON_FLAG}</span>`;
            flags--;
        }
    }
    
    updateFlagsUI();
}

function revealCell(r, c) {
    const cell = board[r][c];
    if (cell.isRevealed || cell.isFlagged) return;
    
    cell.isRevealed = true;
    cell.el.classList.add('revealed');
    revealedCount++;
    
    if (cell.isMine) {
        handleLoss(r, c);
        return;
    }
    
    if (cell.neighborMines > 0) {
        cell.el.innerText = cell.neighborMines;
        cell.el.dataset.value = cell.neighborMines;
    } else {
        // Flood fill
        for (let nr = r - 1; nr <= r + 1; nr++) {
            for (let nc = c - 1; nc <= c + 1; nc++) {
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
                    revealCell(nr, nc);
                }
            }
        }
    }
}

function handleLoss(clickedR, clickedC) {
    gameOver = true;
    clearInterval(timer);
    setFace(EMOJI_DEAD);
    playSound(loseSound);
    
    // Reveal all mines and flags
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = board[r][c];
            if (cell.isMine) {
                cell.el.classList.add('revealed');
                if (!cell.isFlagged) {
                    cell.el.innerHTML = `<span class="mine-icon">${ICON_MINE}</span>`;
                }
                // Highlight the one that triggered loss
                if (r === clickedR && c === clickedC) {
                    cell.el.classList.add('exploded');
                    cell.el.innerHTML = `<span class="mine-icon">${ICON_MINE}</span>`;
                }
            } else if (cell.isFlagged) {
                // Wrong flag
                cell.el.classList.add('flag-wrong');
            }
        }
    }
}

function checkWinCondition() {
    if (revealedCount === (rows * cols) - totalMines) {
        gameOver = true;
        clearInterval(timer);
        setFace(EMOJI_WIN);
        flags = 0;
        updateFlagsUI();
        playSound(winSound);
        
        // Flag all unflagged mines to look nice
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = board[r][c];
                if (cell.isMine && !cell.isFlagged) {
                    cell.isFlagged = true;
                    cell.el.innerHTML = `<span class="flag-icon">${ICON_FLAG}</span>`;
                }
            }
        }
    }
}

function startTimer() {
    timer = setInterval(() => {
        seconds++;
        if (seconds > 999) seconds = 999;
        updateTimerUI();
    }, 1000);
}

function updateTimerUI() {
    timerDisplayEl.innerText = String(seconds).padStart(3, '0');
}

function updateFlagsUI() {
    // Handling negative safely just in case, though capped in right click
    const displayVal = flags >= 0 ? flags : 0;
    flagsCountEl.innerText = String(displayVal).padStart(3, '0');
}

function setFace(emoji) {
    restartIcon.innerText = emoji;
}

function playSound(audioEl) {
    if (!audioEl) return;
    audioEl.currentTime = 0;
    audioEl.play().catch(e => console.log('Audio error:', e));
}

window.onload = init;
