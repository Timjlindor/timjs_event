(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const statusEl = document.getElementById("status");
    const pauseBtn = document.getElementById("btn-pause");
    const restartBtn = document.getElementById("btn-restart");

    const GRID_SIZE = 20;
    const CELL = 20;
    const TICK_MS = 140;

    const DIRS = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
    };

    function createInitialState(randomFn = Math.random) {
        const mid = Math.floor(GRID_SIZE / 2);
        const snake = [
            { x: mid + 1, y: mid },
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
        ];
        const food = spawnFood(snake, randomFn);
        return {
            snake,
            direction: "right",
            nextDirection: "right",
            food,
            score: 0,
            gameOver: false,
            paused: false,
        };
    }

    function spawnFood(snake, randomFn = Math.random) {
        const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
        const empty = [];
        for (let y = 0; y < GRID_SIZE; y += 1) {
            for (let x = 0; x < GRID_SIZE; x += 1) {
                const key = `${x},${y}`;
                if (!occupied.has(key)) empty.push({ x, y });
            }
        }
        if (empty.length === 0) return null;
        const idx = Math.floor(randomFn() * empty.length);
        return empty[idx];
    }

    function isOpposite(a, b) {
        return (
            (a === "up" && b === "down") ||
            (a === "down" && b === "up") ||
            (a === "left" && b === "right") ||
            (a === "right" && b === "left")
        );
    }

    function step(state, randomFn = Math.random) {
        if (state.gameOver || state.paused) return state;

        const dir = isOpposite(state.direction, state.nextDirection)
            ? state.direction
            : state.nextDirection;
        const head = state.snake[0];
        const next = {
            x: head.x + DIRS[dir].x,
            y: head.y + DIRS[dir].y,
        };

        if (
            next.x < 0 ||
            next.y < 0 ||
            next.x >= GRID_SIZE ||
            next.y >= GRID_SIZE
        ) {
            return { ...state, gameOver: true, direction: dir };
        }

        const hitSelf = state.snake.some(
            (p) => p.x === next.x && p.y === next.y
        );
        if (hitSelf) {
            return { ...state, gameOver: true, direction: dir };
        }

        const ate = state.food && next.x === state.food.x && next.y === state.food.y;
        const newSnake = [next, ...state.snake];
        if (!ate) newSnake.pop();

        const newFood = ate ? spawnFood(newSnake, randomFn) : state.food;
        const newScore = ate ? state.score + 1 : state.score;

        return {
            ...state,
            snake: newSnake,
            direction: dir,
            food: newFood,
            score: newScore,
        };
    }

    function render(state) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#f3f3f3";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "#ddd";
        for (let i = 0; i <= GRID_SIZE; i += 1) {
            ctx.beginPath();
            ctx.moveTo(i * CELL, 0);
            ctx.lineTo(i * CELL, GRID_SIZE * CELL);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * CELL);
            ctx.lineTo(GRID_SIZE * CELL, i * CELL);
            ctx.stroke();
        }

        if (state.food) {
            ctx.fillStyle = "#c0392b";
            ctx.fillRect(
                state.food.x * CELL + 2,
                state.food.y * CELL + 2,
                CELL - 4,
                CELL - 4
            );
        }

        ctx.fillStyle = "#2e7d32";
        state.snake.forEach((part, idx) => {
            const inset = idx === 0 ? 1 : 2;
            ctx.fillRect(
                part.x * CELL + inset,
                part.y * CELL + inset,
                CELL - inset * 2,
                CELL - inset * 2
            );
        });
    }

    function updateUI(state) {
        scoreEl.textContent = String(state.score);
        if (state.gameOver) {
            statusEl.textContent = "Game Over";
        } else if (state.paused) {
            statusEl.textContent = "Pause";
        } else {
            statusEl.textContent = "En cours";
        }
        pauseBtn.textContent = state.paused ? "Reprendre" : "Pause";
    }

    let gameState = createInitialState();
    let timer = null;

    function loop() {
        gameState = step(gameState);
        render(gameState);
        updateUI(gameState);
    }

    function startLoop() {
        if (timer) return;
        timer = setInterval(loop, TICK_MS);
    }

    function stopLoop() {
        if (!timer) return;
        clearInterval(timer);
        timer = null;
    }

    function setDirection(dir) {
        if (DIRS[dir]) {
            gameState = { ...gameState, nextDirection: dir };
        }
    }

    document.addEventListener("keydown", (e) => {
        const key = e.key.toLowerCase();
        if (key === "arrowup" || key === "w") setDirection("up");
        if (key === "arrowdown" || key === "s") setDirection("down");
        if (key === "arrowleft" || key === "a") setDirection("left");
        if (key === "arrowright" || key === "d") setDirection("right");
        if (key === " " || key === "p") {
            gameState = { ...gameState, paused: !gameState.paused };
            updateUI(gameState);
        }
        if (key === "r") resetGame();
    });

    document.getElementById("btn-up").addEventListener("click", () => setDirection("up"));
    document.getElementById("btn-down").addEventListener("click", () => setDirection("down"));
    document.getElementById("btn-left").addEventListener("click", () => setDirection("left"));
    document.getElementById("btn-right").addEventListener("click", () => setDirection("right"));

    pauseBtn.addEventListener("click", () => {
        gameState = { ...gameState, paused: !gameState.paused };
        updateUI(gameState);
    });

    function resetGame() {
        gameState = createInitialState();
        render(gameState);
        updateUI(gameState);
    }

    restartBtn.addEventListener("click", resetGame);

    render(gameState);
    updateUI(gameState);
    startLoop();

    window.addEventListener("blur", () => {
        if (!gameState.gameOver) {
            gameState = { ...gameState, paused: true };
            updateUI(gameState);
        }
    });
})();
