(() => {
    const canvas = document.getElementById("game");
    const ctx = canvas.getContext("2d");
    const scoreEl = document.getElementById("score");
    const bestEl = document.getElementById("best");
    const statusEl = document.getElementById("status");
    const restartBtn = document.getElementById("btn-restart");
    const flapBtn = document.getElementById("btn-flap");
    const challengeCountEl = document.getElementById("challengeCount");
    const challengeBarEl = document.getElementById("challengeBar");

    const W = canvas.width;
    const H = canvas.height;

    const GRAVITY = 1500;
    const FLAP_VELOCITY = -430;
    const PIPE_SPEED = 190;
    const PIPE_GAP = 170;
    const PIPE_WIDTH = 62;
    const PIPE_INTERVAL = 1.35;
    const BIRD_RADIUS = 15;
    const BIRD_X = 100;
    const CHALLENGE_GOAL = 500;

    let best = 0;
    try { best = parseInt(localStorage.getItem("arcadeBest") || "0", 10) || 0; } catch (e) {}

    function freshState() {
        return {
            birdY: H / 2,
            birdV: 0,
            pipes: [],
            spawnTimer: 0,
            score: 0,
            status: "ready", // ready | playing | over
        };
    }

    let state = freshState();

    function spawnPipe() {
        const margin = 70;
        const gapCenter = margin + Math.random() * (H - margin * 2 - PIPE_GAP) + PIPE_GAP / 2;
        state.pipes.push({ x: W + PIPE_WIDTH, gapCenter, passed: false });
    }

    async function recordPlay(score) {
        if (typeof supabaseClient === "undefined" || !supabaseClient) return;
        try {
            await supabaseClient.from("game_plays").insert({ game: "arcade", score });
        } catch (e) {
            // Pas grave si ça échoue (hors ligne, Supabase indisponible) : le jeu continue.
        }
        refreshChallengeCount();
    }

    async function refreshChallengeCount() {
        if (typeof supabaseClient === "undefined" || !supabaseClient || !challengeCountEl) return;
        try {
            const { count, error } = await supabaseClient
                .from("game_plays")
                .select("*", { count: "exact", head: true });
            if (error || count == null) return;
            challengeCountEl.textContent = String(count);
            if (challengeBarEl) {
                const pct = Math.min(100, (count / CHALLENGE_GOAL) * 100);
                challengeBarEl.style.width = pct + "%";
            }
        } catch (e) {
            // silencieux : le compteur reste tel quel si Supabase est injoignable
        }
    }

    function endGame() {
        state.status = "over";
        if (state.score > best) {
            best = state.score;
            try { localStorage.setItem("arcadeBest", String(best)); } catch (e) {}
        }
        recordPlay(state.score);
    }

    function handleInput() {
        if (state.status === "ready") {
            state.status = "playing";
            state.birdV = FLAP_VELOCITY;
            return;
        }
        if (state.status === "over") {
            state = freshState();
            state.status = "playing";
            state.birdV = FLAP_VELOCITY;
            return;
        }
        state.birdV = FLAP_VELOCITY;
    }

    function resetGame() {
        state = freshState();
    }

    function update(dt) {
        if (state.status !== "playing") return;

        state.birdV += GRAVITY * dt;
        state.birdY += state.birdV * dt;

        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
            spawnPipe();
            state.spawnTimer = PIPE_INTERVAL;
        }

        state.pipes.forEach((p) => { p.x -= PIPE_SPEED * dt; });
        state.pipes = state.pipes.filter((p) => p.x > -PIPE_WIDTH);

        state.pipes.forEach((p) => {
            if (!p.passed && p.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
                p.passed = true;
                state.score += 1;
            }
        });

        if (state.birdY - BIRD_RADIUS < 0 || state.birdY + BIRD_RADIUS > H) {
            endGame();
            return;
        }

        for (const p of state.pipes) {
            const withinX = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + PIPE_WIDTH;
            if (!withinX) continue;
            const gapTop = p.gapCenter - PIPE_GAP / 2;
            const gapBottom = p.gapCenter + PIPE_GAP / 2;
            if (state.birdY - BIRD_RADIUS < gapTop || state.birdY + BIRD_RADIUS > gapBottom) {
                endGame();
                return;
            }
        }
    }

    function drawOverlayText(lines) {
        ctx.fillStyle = "rgba(28, 26, 23, 0.72)";
        ctx.fillRect(0, H / 2 - 46, W, 92);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "700 17px Inter, sans-serif";
        ctx.fillText(lines[0], W / 2, H / 2 - 2);
        if (lines[1]) {
            ctx.font = "400 13px Inter, sans-serif";
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.fillText(lines[1], W / 2, H / 2 + 20);
        }
    }

    function render() {
        ctx.fillStyle = "#efece5";
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = "#e7e1d6";
        for (let i = 0; i < 6; i += 1) {
            ctx.fillRect((i * 90 - (Date.now() / 40) % 90), H - 40, 50, 40);
        }

        state.pipes.forEach((p) => {
            const gapTop = p.gapCenter - PIPE_GAP / 2;
            const gapBottom = p.gapCenter + PIPE_GAP / 2;
            ctx.fillStyle = "#1c1a17";
            ctx.fillRect(p.x, 0, PIPE_WIDTH, gapTop);
            ctx.fillRect(p.x, gapBottom, PIPE_WIDTH, H - gapBottom);
            ctx.fillStyle = "#c9a24b";
            ctx.fillRect(p.x - 3, gapTop - 8, PIPE_WIDTH + 6, 8);
            ctx.fillRect(p.x - 3, gapBottom, PIPE_WIDTH + 6, 8);
        });

        ctx.beginPath();
        ctx.fillStyle = "#c9a24b";
        ctx.arc(BIRD_X, state.birdY, BIRD_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#1c1a17";
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = "#1c1a17";
        ctx.arc(BIRD_X + 5, state.birdY - 4, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (state.status === "ready") {
            drawOverlayText(["Cliquez, touchez ou Espace", "pour décoller"]);
        } else if (state.status === "over") {
            drawOverlayText(["Partie terminée — Score : " + state.score, "Cliquez pour rejouer"]);
        }
    }

    function updateUI() {
        scoreEl.textContent = String(state.score);
        bestEl.textContent = String(best);
        statusEl.textContent =
            state.status === "playing" ? "En cours" :
            state.status === "over" ? "Partie terminée" : "Prêt";
    }

    let lastTime = null;
    function loop(ts) {
        if (lastTime == null) lastTime = ts;
        let dt = (ts - lastTime) / 1000;
        lastTime = ts;
        dt = Math.min(dt, 0.05);
        update(dt);
        render();
        updateUI();
        requestAnimationFrame(loop);
    }

    canvas.addEventListener("click", handleInput);
    if (flapBtn) flapBtn.addEventListener("click", handleInput);
    restartBtn.addEventListener("click", resetGame);

    document.addEventListener("keydown", (e) => {
        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            handleInput();
        }
        if (e.key.toLowerCase() === "r") resetGame();
    });

    updateUI();
    refreshChallengeCount();
    requestAnimationFrame(loop);
})();
