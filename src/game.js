import { GRID, STEP_MS } from "./constants.js";
import { state } from "./state.js";

function randomCell() {
  return { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
}

function occupied(cell) {
  return state.players.some((p) => p.snake.some((seg) => seg.x === cell.x && seg.y === cell.y));
}

function placeFood() {
  let cell = randomCell();
  let tries = 0;
  while (occupied(cell) && tries < 500) {
    cell = randomCell();
    tries += 1;
  }
  state.food = cell;
}

export function trySetDirection(player, x, y) {
  if (!player.alive || state.mode !== "playing") return;
  if (player.dir.x === -x && player.dir.y === -y) return;
  player.nextDir = { x, y };
}

function cellEq(a, b) {
  return a.x === b.x && a.y === b.y;
}

function inBounds(c) {
  return c.x >= 0 && c.y >= 0 && c.x < GRID && c.y < GRID;
}

function bodySetForCollision(players, eatsMap) {
  const set = new Set();
  for (const p of players) {
    if (!p.alive) continue;
    const keepsTail = eatsMap.get(p.id) === true;
    const limit = keepsTail ? p.snake.length : p.snake.length - 1;
    for (let i = 0; i < limit; i++) {
      set.add(p.snake[i].x + "," + p.snake[i].y);
    }
  }
  return set;
}

function endRound() {
  const [p1, p2] = state.players;
  if (p1.alive && !p2.alive) state.winner = "J1";
  else if (p2.alive && !p1.alive) state.winner = "J2";
  else if (p1.score > p2.score) state.winner = "J1";
  else if (p2.score > p1.score) state.winner = "J2";
  else state.winner = "egalite";
  state.mode = "gameover";
}

function stepRound() {
  const alive = state.players.filter((p) => p.alive);
  if (alive.length === 0) return endRound();

  const movingMap = new Map();
  for (const p of alive) {
    p.dir = { ...p.nextDir };
    movingMap.set(p.id, !(p.dir.x === 0 && p.dir.y === 0));
  }

  const nextHeads = new Map();
  const eatsMap = new Map();
  for (const p of alive) {
    if (!movingMap.get(p.id)) {
      nextHeads.set(p.id, { ...p.snake[0] });
      eatsMap.set(p.id, false);
      continue;
    }
    const next = { x: p.snake[0].x + p.dir.x, y: p.snake[0].y + p.dir.y };
    nextHeads.set(p.id, next);
    eatsMap.set(p.id, cellEq(next, state.food));
  }

  const deaths = new Map();
  for (const p of alive) {
    if (!movingMap.get(p.id)) continue;
    if (!inBounds(nextHeads.get(p.id))) deaths.set(p.id, "wall");
  }

  const occupiedCells = bodySetForCollision(alive, eatsMap);
  for (const p of alive) {
    if (!movingMap.get(p.id) || deaths.has(p.id)) continue;
    const n = nextHeads.get(p.id);
    if (occupiedCells.has(n.x + "," + n.y)) deaths.set(p.id, "body");
  }

  if (alive.length === 2) {
    const [a, b] = alive;
    const aNext = nextHeads.get(a.id);
    const bNext = nextHeads.get(b.id);
    const same = cellEq(aNext, bNext);
    const swap = cellEq(aNext, b.snake[0]) && cellEq(bNext, a.snake[0]);
    if (same || swap) {
      deaths.set(a.id, "head");
      deaths.set(b.id, "head");
    }
  }

  for (const p of alive) {
    if (deaths.has(p.id)) {
      p.alive = false;
      p.reason = deaths.get(p.id);
      p.best = Math.max(p.best, p.score);
      continue;
    }
    if (!movingMap.get(p.id)) continue;
    const next = nextHeads.get(p.id);
    p.snake.unshift(next);
    if (eatsMap.get(p.id)) {
      p.score += 1;
      p.best = Math.max(p.best, p.score);
    } else {
      p.snake.pop();
    }
  }

  if ([...eatsMap.values()].some(Boolean)) placeFood();
  if (state.players.some((p) => !p.alive)) endRound();
}

function pollGamepadStep() {
  state.net.rbPressed = false;
}

export function update(dtMs, hooks) {
  pollGamepadStep();

  if (state.net.role === "host" && state.mode === "playing") {
    if (state.net.remoteInputCount > 0) {
      trySetDirection(state.players[1], state.net.remoteDir.x, state.net.remoteDir.y);
    }
  }

  if (state.net.role !== "client" && state.mode === "playing") {
    if (state.net.stepMode) {
      if (state.net.pendingSteps > 0) {
        state.net.pendingSteps -= 1;
        stepRound();
      }
    } else {
      state.elapsed += dtMs;
      while (state.elapsed >= STEP_MS) {
        state.elapsed -= STEP_MS;
        stepRound();
        if (state.mode !== "playing") break;
      }
    }
  }

  if (state.net.role === "host" && state.net.phase === "connected") {
    hooks.sendState();
  }
}
