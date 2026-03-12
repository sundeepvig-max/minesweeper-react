const { useState, useEffect, useRef } = React;

const DIFFICULTIES = {
    easy: { rows: 8, cols: 10, mines: 10 },
    medium: { rows: 14, cols: 18, mines: 40 },
    hard: { rows: 20, cols: 24, mines: 99 }
};

const EMOJI_SMILE = '😊';
const EMOJI_OOH = '😮';
const EMOJI_DEAD = '😵';
const EMOJI_WIN = '😎';
const ICON_MINE = '💣';
const ICON_FLAG = '🚩';

function App() {
    const [difficulty, setDifficulty] = useState('easy');
    const [board, setBoard] = useState([]);
    const [mines, setMines] = useState([]);
    const [flags, setFlags] = useState(0);
    const [revealedCount, setRevealedCount] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [win, setWin] = useState(false);
    const [face, setFace] = useState(EMOJI_SMILE);
    const [time, setTime] = useState(0);
    const [isFirstClick, setIsFirstClick] = useState(true);

    const [bestScores, setBestScores] = useState({
        easy: localStorage.getItem('minesweeper_best_easy') || null,
        medium: localStorage.getItem('minesweeper_best_medium') || null,
        hard: localStorage.getItem('minesweeper_best_hard') || null,
    });

    const timerRef = useRef(null);
    const timeRef = useRef(0);

    const playSound = (id) => {
        const audio = document.getElementById(id);
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    };

    const initBoard = () => {
        const { rows, cols, mines: totalMines } = DIFFICULTIES[difficulty];
        const newBoard = [];
        for (let r = 0; r < rows; r++) {
            const row = [];
            for (let c = 0; c < cols; c++) {
                row.push({
                    r, c,
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    neighborMines: 0,
                    exploded: false,
                    wrongFlag: false
                });
            }
            newBoard.push(row);
        }
        setBoard(newBoard);
        setMines([]);
        setFlags(totalMines);
        setRevealedCount(0);
        setGameOver(false);
        setWin(false);
        setFace(EMOJI_SMILE);
        setIsFirstClick(true);
        setTime(0);
        timeRef.current = 0;
        if (timerRef.current) clearInterval(timerRef.current);
    };

    useEffect(() => {
        initBoard();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [difficulty]);

    useEffect(() => {
        if (!isFirstClick && !gameOver && !win) {
            timerRef.current = setInterval(() => {
                setTime(t => {
                    const next = t < 999 ? t + 1 : 999;
                    timeRef.current = next;
                    return next;
                });
            }, 1000);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isFirstClick, gameOver, win]);

    const plantMines = (safeR, safeC, currentBoard) => {
        const { rows, cols, mines: totalMines } = DIFFICULTIES[difficulty];
        let minesPlaced = 0;
        const newMines = [];
        
        while (minesPlaced < totalMines) {
            const r = Math.floor(Math.random() * rows);
            const c = Math.floor(Math.random() * cols);
            
            const isSafeZone = Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1;
            
            if (!currentBoard[r][c].isMine && !isSafeZone) {
                currentBoard[r][c].isMine = true;
                newMines.push({r, c});
                minesPlaced++;
            }
        }
        
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!currentBoard[r][c].isMine) {
                    let count = 0;
                    for (let nr = r - 1; nr <= r + 1; nr++) {
                        for (let nc = c - 1; nc <= c + 1; nc++) {
                            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && currentBoard[nr][nc].isMine) {
                                count++;
                            }
                        }
                    }
                    currentBoard[r][c].neighborMines = count;
                }
            }
        }
        setMines(newMines);
    };

    const handleLeftClick = (r, c) => {
        if (gameOver || win || board[r][c].isRevealed || board[r][c].isFlagged) return;

        let currentBoard = [...board.map(row => [...row])];

        if (isFirstClick) {
            plantMines(r, c, currentBoard);
            setIsFirstClick(false);
        }

        playSound('click-sound');
        
        let newRevealedCount = revealedCount;
        
        const reveal = (nr, nc) => {
            if (currentBoard[nr][nc].isRevealed || currentBoard[nr][nc].isFlagged) return;
            currentBoard[nr][nc].isRevealed = true;
            newRevealedCount++;
            
            if (currentBoard[nr][nc].isMine) {
                handleLoss(nr, nc, currentBoard);
                return true;
            }
            
            if (currentBoard[nr][nc].neighborMines === 0) {
                const { rows, cols } = DIFFICULTIES[difficulty];
                for (let r2 = nr - 1; r2 <= nr + 1; r2++) {
                    for (let c2 = nc - 1; c2 <= nc + 1; c2++) {
                        if (r2 >= 0 && r2 < rows && c2 >= 0 && c2 < cols) {
                            reveal(r2, c2);
                        }
                    }
                }
            }
            return false;
        };

        const isLoss = reveal(r, c);
        
        if (!isLoss) {
            setBoard(currentBoard);
            setRevealedCount(newRevealedCount);
            checkWin(newRevealedCount, currentBoard);
        }
    };

    const handleRightClick = (e, r, c) => {
        if (e) e.preventDefault();
        
        if (gameOver || win || isFirstClick || board[r][c].isRevealed) return;

        playSound('flag-sound');
        let currentBoard = [...board.map(row => [...row])];
        const cell = currentBoard[r][c];

        if (cell.isFlagged) {
            cell.isFlagged = false;
            setFlags(flags + 1);
        } else if (flags > 0) {
            cell.isFlagged = true;
            setFlags(flags - 1);
        }
        setBoard(currentBoard);
    };

    const handleLoss = (clickedR, clickedC, currentBoard) => {
        setGameOver(true);
        setFace(EMOJI_DEAD);
        playSound('lose-sound');
        
        const { rows, cols } = DIFFICULTIES[difficulty];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = currentBoard[r][c];
                if (cell.isMine) {
                    cell.isRevealed = true;
                    if (r === clickedR && c === clickedC) {
                        cell.exploded = true;
                    }
                } else if (cell.isFlagged) {
                    cell.wrongFlag = true;
                    cell.isRevealed = true;
                }
            }
        }
        setBoard(currentBoard);
    };

    const checkWin = (currentRevealedCount, currentBoard) => {
        const { rows, cols, mines: totalMines } = DIFFICULTIES[difficulty];
        if (currentRevealedCount === (rows * cols) - totalMines) {
            setWin(true);
            setFace(EMOJI_WIN);
            playSound('win-sound');
            setFlags(0);
            
            const finalTime = timeRef.current;
            const currentBestTime = localStorage.getItem(`minesweeper_best_${difficulty}`);
            
            if (!currentBestTime || finalTime < parseInt(currentBestTime)) {
                localStorage.setItem(`minesweeper_best_${difficulty}`, finalTime);
                setBestScores(prev => ({...prev, [difficulty]: finalTime}));
            }
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (currentBoard[r][c].isMine && !currentBoard[r][c].isFlagged) {
                        currentBoard[r][c].isFlagged = true;
                    }
                }
            }
            setBoard(currentBoard);
        }
    };

    const touchTimer = useRef(null);
    const onTouchStart = (e, r, c) => {
        if(gameOver || win || board[r][c].isRevealed || board[r][c].isFlagged) return;
        setFace(EMOJI_OOH);
        touchTimer.current = setTimeout(() => {
            handleRightClick(null, r, c); // Null event so we don't try to standard preventDefault if not right
            touchTimer.current = null;
        }, 400);
    };
    
    const onTouchEnd = (e, r, c) => {
        if(touchTimer.current) {
            clearTimeout(touchTimer.current);
            handleLeftClick(r, c);
        }
        if (!gameOver && !win) setFace(EMOJI_SMILE);
    };

    const { rows, cols } = DIFFICULTIES[difficulty];
    const gridStyle = {
        gridTemplateColumns: `repeat(${cols}, min(30px, calc((100vw - 32px) / ${cols})))`,
        gridTemplateRows: `repeat(${rows}, min(30px, calc((100vw - 32px) / ${cols})))`
    };

    const currentBestStr = bestScores[difficulty] ? String(bestScores[difficulty]).padStart(3, '0') + 's' : '--';

    return (
        <div className="game-container">
            <div className="header">
                <div className="difficulty-selector">
                    <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                    </select>
                </div>
                <div className="stats-bar">
                    <div className="stat-container flags">
                        <span className="icon">{ICON_FLAG}</span>
                        <span>{String(flags).padStart(3, '0')}</span>
                    </div>
                    <button 
                        className="restart-btn"
                        onMouseDown={() => !gameOver && !win && setFace(EMOJI_OOH)}
                        onMouseUp={() => !gameOver && !win && setFace(EMOJI_SMILE)}
                        onClick={initBoard}
                    >
                        <span className="icon">{face}</span>
                    </button>
                    <div className="stat-container timer">
                        <span className="icon">⏱️</span>
                        <span>{String(time).padStart(3, '0')}</span>
                    </div>
                </div>
            </div>
            
            <div className="board-container">
                <div className="board" style={gridStyle} onContextMenu={e => e.preventDefault()}>
                    {board.map((row, r) => row.map((cell, c) => {
                        const isLightColor = (r % 2 === 0 && c % 2 === 0) || (r % 2 !== 0 && c % 2 !== 0);
                        const cellClasses = ['cell'];
                        cellClasses.push(isLightColor ? 'light' : 'dark');
                        if (cell.isRevealed) cellClasses.push('revealed');
                        if (cell.exploded) cellClasses.push('exploded');
                        if (cell.wrongFlag) cellClasses.push('flag-wrong');
                        
                        let content = '';
                        if (cell.isRevealed) {
                            if (cell.isMine) content = <span className="mine-icon">{ICON_MINE}</span>;
                            else if (cell.neighborMines > 0) content = cell.neighborMines;
                        } else if (cell.isFlagged) {
                            content = <span className="flag-icon">{ICON_FLAG}</span>;
                        } else if (cell.wrongFlag) {
                            content = <span className="mine-icon">{ICON_MINE}</span>;
                        }

                        return (
                            <div 
                                key={`${r}-${c}`}
                                className={cellClasses.join(' ')}
                                data-value={cell.neighborMines}
                                onMouseDown={(e) => {
                                    if(e.button === 0 && !gameOver && !win && !cell.isRevealed && !cell.isFlagged) setFace(EMOJI_OOH);
                                }}
                                onMouseUp={(e) => {
                                    if(e.button === 0 && !gameOver && !win && !cell.isRevealed && !cell.isFlagged) {
                                        setFace(EMOJI_SMILE);
                                        handleLeftClick(r, c);
                                    }
                                }}
                                onContextMenu={(e) => handleRightClick(e, r, c)}
                                onTouchStart={(e) => {
                                    e.preventDefault(); 
                                    onTouchStart(e, r, c);
                                }}
                                onTouchEnd={(e) => {
                                    e.preventDefault(); 
                                    onTouchEnd(e, r, c);
                                }}
                            >
                                {content}
                            </div>
                        );
                    }))}
                </div>
            </div>

            <div className="controls-footer">
                <div className="high-score">
                    <span>BEST TIME</span>
                    {currentBestStr}
                </div>
                <button className="action-btn restart-action" onClick={initBoard}>
                    Restart
                </button>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
