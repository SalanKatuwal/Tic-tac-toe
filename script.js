"use strict";

const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

const CPU_DELAY = 550;
const RESULT_DELAY = 1000;
const PREFS_KEY = "ttt-prefs";

const $ = (sel) => document.querySelector(sel);

const screens = document.querySelectorAll(".screen");
const form = $("#setupForm");
const boardEl = $("#board");
const gridEl = $("#gridLines");
const statusEl = $("#status");
const winLine = $("#winLine");
const resultEl = $("#result");
const scoreEls = { X: $("#scoreX"), O: $("#scoreO") };
const ptsEls = { X: $("#ptsX"), O: $("#ptsO"), draw: $("#ptsDraw") };

const state = {
    mode: "cpu",          // "cpu" | "pvp"
    difficulty: "medium", // "easy" | "medium" | "hard"
    human: "X",           // the human's mark in cpu mode
    names: { X: "Player 1", O: "Player 2" },
    board: Array(9).fill(null),
    turn: "X",
    starter: "X",         // alternates every round
    over: false,
    scores: { X: 0, O: 0, draw: 0 },
    timer: null,
};

const other = (mark) => (mark === "X" ? "O" : "X");
const isCpuTurn = () => state.mode === "cpu" && state.turn !== state.human;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- Hand-drawn strokes ---------- */

// Every stroke gets a little random wobble so no two marks look the same.
const wobble = (n) => (Math.random() - 0.5) * 2 * n;
const fmt = (n) => n.toFixed(1);

function sketchLine(x1, y1, x2, y2, shake = 3, bend = 5) {
    const mx = (x1 + x2) / 2 + wobble(bend);
    const my = (y1 + y2) / 2 + wobble(bend);
    return `M${fmt(x1 + wobble(shake))} ${fmt(y1 + wobble(shake))} `
        + `Q${fmt(mx)} ${fmt(my)} ${fmt(x2 + wobble(shake))} ${fmt(y2 + wobble(shake))}`;
}

// A slightly tilted loop that overshoots its start, like an O drawn in one go.
function sketchLoop() {
    const start = -Math.PI / 2 + wobble(0.8);
    const sweep = -Math.PI * 2 * (1.06 + Math.random() * 0.08);
    const rx = 28 + wobble(2);
    const ry = 26 + wobble(2);
    const drift = 2 + Math.random() * 4;
    const tilt = wobble(0.4);
    const steps = 48;
    let d = "";
    for (let k = 0; k <= steps; k++) {
        const p = k / steps;
        const t = start + sweep * p;
        const px = (rx - drift * p) * Math.cos(t);
        const py = (ry - drift * p) * Math.sin(t);
        const x = 50 + px * Math.cos(tilt) - py * Math.sin(tilt);
        const y = 50 + px * Math.sin(tilt) + py * Math.cos(tilt);
        d += `${k ? "L" : "M"}${fmt(x)} ${fmt(y)}`;
    }
    return d;
}

function markSvg(mark) {
    const paths = mark === "X"
        ? [sketchLine(24, 22, 77, 78, 4, 7), sketchLine(77, 23, 23, 77, 4, 7)]
        : [sketchLoop()];
    return `<svg class="mark ${mark.toLowerCase()}" viewBox="0 0 100 100" aria-hidden="true">`
        + paths.map((d) => `<path pathLength="1" d="${d}"/>`).join("")
        + "</svg>";
}

function drawGrid() {
    gridEl.innerHTML = [
        sketchLine(100, 8, 100, 292),
        sketchLine(200, 8, 200, 292),
        sketchLine(8, 100, 292, 100),
        sketchLine(8, 200, 292, 200),
    ].map((d) => `<path pathLength="1" d="${d}"/>`).join("");
}

// Tally marks: groups of four strokes with a fifth slashed across.
function renderTally(el, count, animateLast) {
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", String(count));
    if (count === 0) {
        el.textContent = "–";
        return;
    }
    // Deterministic wobble so existing strokes don't jump on re-render.
    const seeded = (n) => Math.sin(n * 12.9898) * 0.5;
    const groups = Math.ceil(count / 5);
    let html = "";
    for (let g = 0; g < groups; g++) {
        const inGroup = Math.min(5, count - g * 5);
        const fresh = animateLast && g === groups - 1 ? inGroup - 1 : -1;
        let strokes = "";
        for (let k = 0; k < inGroup; k++) {
            const s = g * 10 + k;
            const cls = k === fresh ? ' class="fresh"' : "";
            const d = k < 4
                ? `M${fmt(6 + k * 7 + seeded(s) * 2)} ${fmt(3 + seeded(s + 1))} L${fmt(6 + k * 7 + seeded(s + 2) * 2)} ${fmt(23 + seeded(s + 3))}`
                : "M1 19 L33 6";
            strokes += `<path pathLength="1"${cls} d="${d}"/>`;
        }
        html += `<svg viewBox="0 0 34 26" aria-hidden="true">${strokes}</svg>`;
    }
    el.innerHTML = html;
}

/* ---------- Board cells ---------- */

const cells = Array.from({ length: 9 }, (_, i) => {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.dataset.index = i;
    boardEl.append(cell);
    return cell;
});

function cellLabel(i) {
    const where = `Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}`;
    return `${where}, ${state.board[i] || "empty"}`;
}

/* ---------- Screens & preferences ---------- */

function showScreen(id) {
    screens.forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo(0, 0);
}

function loadPrefs() {
    try {
        return JSON.parse(localStorage.getItem(PREFS_KEY)) || {};
    } catch {
        return {};
    }
}

function savePrefs(prefs) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        /* storage unavailable — preferences just won't persist */
    }
}

function openSetup(mode) {
    state.mode = mode;
    const prefs = loadPrefs();
    const f = form.elements;

    $("#setupTitle").textContent = mode === "cpu" ? "vs Computer" : "vs a Friend";
    document.querySelectorAll(".cpu-only").forEach((el) => (el.hidden = mode !== "cpu"));
    document.querySelectorAll(".pvp-only").forEach((el) => (el.hidden = mode !== "pvp"));

    f.cpuName.value = prefs.cpuName || "";
    f.symbol.value = prefs.symbol || "X";
    f.difficulty.value = prefs.difficulty || "medium";
    f.nameX.value = prefs.nameX || "";
    f.nameO.value = prefs.nameO || "";

    showScreen("setup");
    (mode === "cpu" ? f.cpuName : f.nameX).focus({ preventScroll: true });
}

function startMatch(e) {
    e.preventDefault();
    const f = form.elements;
    const prefs = loadPrefs();

    if (state.mode === "cpu") {
        const name = f.cpuName.value.trim();
        state.human = f.symbol.value;
        state.difficulty = f.difficulty.value;
        state.names = { [state.human]: name || "You", [other(state.human)]: "Computer" };
        Object.assign(prefs, { cpuName: name, symbol: state.human, difficulty: state.difficulty });
        $("#modePill").textContent = `vs computer · ${state.difficulty}`;
    } else {
        const nameX = f.nameX.value.trim();
        const nameO = f.nameO.value.trim();
        state.names = { X: nameX || "Player 1", O: nameO || "Player 2" };
        Object.assign(prefs, { nameX, nameO });
        $("#modePill").textContent = "vs a friend";
    }
    savePrefs(prefs);

    $("#nameXLabel").textContent = state.names.X;
    $("#nameOLabel").textContent = state.names.O;
    state.scores = { X: 0, O: 0, draw: 0 };
    state.starter = "X";
    renderScores();
    showScreen("game");
    newRound();
}

/* ---------- Round flow ---------- */

function newRound() {
    clearTimeout(state.timer);
    hideResult();
    state.board.fill(null);
    state.turn = state.starter;
    state.over = false;

    cells.forEach((cell, i) => {
        cell.className = "cell";
        cell.innerHTML = "";
        cell.setAttribute("aria-disabled", "false");
        cell.setAttribute("aria-label", cellLabel(i));
    });
    boardEl.classList.remove("over");
    winLine.setAttribute("class", "");
    drawGrid();
    updateTurn();
}

function updateTurn() {
    const cpu = isCpuTurn();
    boardEl.dataset.turn = state.turn;
    boardEl.classList.toggle("locked", cpu || state.over);
    scoreEls.X.classList.toggle("active", state.turn === "X");
    scoreEls.O.classList.toggle("active", state.turn === "O");

    if (cpu) {
        setStatus(state.turn, "computer is thinking", true);
        state.timer = setTimeout(cpuMove, CPU_DELAY + Math.random() * 350);
    } else if (state.mode === "cpu") {
        setStatus(state.turn, "your turn");
    } else {
        setStatus(state.turn, `${state.names[state.turn]}'s turn`);
    }
}

function setStatus(mark, text, thinking = false) {
    statusEl.innerHTML = mark ? markSvg(mark) : "";
    const span = document.createElement("span");
    span.textContent = text;
    if (thinking) span.className = "dots";
    statusEl.append(span);
}

function handleCellClick(e) {
    const cell = e.target.closest(".cell");
    if (!cell) return;
    const i = Number(cell.dataset.index);
    if (state.over || isCpuTurn() || state.board[i]) return;
    place(i);
}

function place(i) {
    const mark = state.turn;
    const cell = cells[i];
    state.board[i] = mark;
    cell.innerHTML = markSvg(mark);
    cell.classList.add("filled", mark.toLowerCase());
    cell.setAttribute("aria-disabled", "true");
    cell.setAttribute("aria-label", cellLabel(i));

    const win = findWin(state.board);
    if (win) return endRound(win.mark, win.line);
    if (state.board.every(Boolean)) return endRound(null);

    state.turn = other(mark);
    updateTurn();
}

function endRound(winner, line) {
    state.over = true;
    state.starter = other(state.starter);
    boardEl.classList.add("over", "locked");
    scoreEls.X.classList.remove("active");
    scoreEls.O.classList.remove("active");

    if (winner) {
        line.forEach((i) => cells[i].classList.add("win"));
        drawWinLine(line);
        state.scores[winner]++;
        setStatus(winner, state.mode === "cpu" && winner === state.human ? "you win!" : `${state.names[winner]} wins!`);
    } else {
        state.scores.draw++;
        setStatus(null, "it's a draw");
    }
    renderScores(winner || "draw");
    state.timer = setTimeout(() => showResult(winner), RESULT_DELAY);
}

function renderScores(changed) {
    for (const key of ["X", "O", "draw"]) {
        renderTally(ptsEls[key], state.scores[key], key === changed);
    }
}

// Cell centres in the 300×300 overlay.
const CENTERS = [50, 150, 250];

function drawWinLine(line) {
    const a = line[0];
    const b = line[2];
    let x1 = CENTERS[a % 3], y1 = CENTERS[Math.floor(a / 3)];
    let x2 = CENTERS[b % 3], y2 = CENTERS[Math.floor(b / 3)];
    const dx = (x2 - x1) * 0.2;
    const dy = (y2 - y1) * 0.2;
    winLine.setAttribute("d", sketchLine(x1 - dx, y1 - dy, x2 + dx, y2 + dy, 4, 8));
    winLine.setAttribute("class", "show");
}

/* ---------- Result note ---------- */

function showResult(winner) {
    let title;
    let text;

    if (!winner) {
        title = "It's a draw!";
        text = state.mode === "cpu" && state.difficulty === "hard"
            ? "Honestly, a draw against hard mode is a win."
            : "Nobody blinked. Go again?";
    } else if (state.mode === "cpu") {
        const youWon = winner === state.human;
        title = youWon ? "You win!" : "Computer wins";
        text = youWon
            ? `You beat the computer on ${state.difficulty}.`
            : "It got you this time. Rematch?";
    } else {
        title = `${state.names[winner]} wins!`;
        text = `Three in a row for ${state.names[winner]}.`;
    }

    const marks = winner ? [winner] : ["X", "O"];
    $("#resultMark").innerHTML = marks.map(markSvg).join("");
    $("#resultNote").className = `result-note ${winner ? winner.toLowerCase() : "draw"}`;
    $("#resultTitle").textContent = title;
    $("#resultText").textContent = text;
    resultEl.hidden = false;
    $("#playAgain").focus();
}

function hideResult() {
    resultEl.hidden = true;
}

function goToMenu() {
    clearTimeout(state.timer);
    hideResult();
    showScreen("home");
}

/* ---------- Computer player ---------- */

function findWin(board) {
    for (const line of LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { mark: board[a], line };
        }
    }
    return null;
}

function emptyCells(board) {
    const empty = [];
    board.forEach((v, i) => !v && empty.push(i));
    return empty;
}

function winningMove(board, mark) {
    for (const i of emptyCells(board)) {
        board[i] = mark;
        const win = findWin(board);
        board[i] = null;
        if (win) return i;
    }
    return -1;
}

// Score from the AI's point of view; faster wins and slower losses score higher.
function minimax(board, turn, ai, depth) {
    const win = findWin(board);
    if (win) return win.mark === ai ? 10 - depth : depth - 10;
    if (board.every(Boolean)) return 0;

    let best = turn === ai ? -Infinity : Infinity;
    for (const i of emptyCells(board)) {
        board[i] = turn;
        const score = minimax(board, other(turn), ai, depth + 1);
        board[i] = null;
        best = turn === ai ? Math.max(best, score) : Math.min(best, score);
    }
    return best;
}

function bestMove(board, ai) {
    let best = -Infinity;
    let moves = [];
    for (const i of emptyCells(board)) {
        board[i] = ai;
        const score = minimax(board, other(ai), ai, 1);
        board[i] = null;
        if (score > best) {
            best = score;
            moves = [i];
        } else if (score === best) {
            moves.push(i);
        }
    }
    return pick(moves);
}

function chooseMove() {
    const board = [...state.board];
    const ai = state.turn;

    if (state.difficulty === "easy") {
        // Mostly random, occasionally notices a winning move.
        const win = Math.random() < 0.35 ? winningMove(board, ai) : -1;
        return win >= 0 ? win : pick(emptyCells(board));
    }

    if (state.difficulty === "medium") {
        const win = winningMove(board, ai);
        if (win >= 0) return win;
        const block = winningMove(board, other(ai));
        if (block >= 0) return block;
        return Math.random() < 0.5 ? bestMove(board, ai) : pick(emptyCells(board));
    }

    return bestMove(board, ai);
}

function cpuMove() {
    if (state.over || !isCpuTurn()) return;
    place(chooseMove());
}

/* ---------- Events ---------- */

document.querySelectorAll("[data-mode]").forEach((note) => {
    note.addEventListener("click", () => openSetup(note.dataset.mode));
});

document.querySelectorAll("[data-go='home']").forEach((btn) => {
    btn.addEventListener("click", goToMenu);
});

form.addEventListener("submit", startMatch);
boardEl.addEventListener("click", handleCellClick);

// Arrow keys move focus around the board.
boardEl.addEventListener("keydown", (e) => {
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    const i = cells.indexOf(document.activeElement);
    if (!step || i < 0) return;
    e.preventDefault();
    const row = (Math.floor(i / 3) + step[0] + 3) % 3;
    const col = ((i % 3) + step[1] + 3) % 3;
    cells[row * 3 + col].focus();
});

$("#toMenu").addEventListener("click", goToMenu);
$("#restartBtn").addEventListener("click", newRound);
$("#playAgain").addEventListener("click", newRound);
$("#resultMenu").addEventListener("click", goToMenu);

$("#resetScores").addEventListener("click", () => {
    state.scores = { X: 0, O: 0, draw: 0 };
    state.starter = "X";
    renderScores();
    newRound();
});

// Close the result note with Escape or a click outside it, leaving the final board visible.
resultEl.addEventListener("click", (e) => {
    if (e.target === resultEl) hideResult();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !resultEl.hidden) hideResult();
});
