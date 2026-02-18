import { GRID, FIRST_FOOD, isTouchForced } from "./constants.js";

export const canvas = document.getElementById("game");
export const ctx = canvas.getContext("2d");

const forceTouch = isTouchForced();

export const state = {
  mode: "menu",
  elapsed: 0,
  lastTs: 0,
  food: { ...FIRST_FOOD },
  winner: "",
  players: [],
  net: {
    role: "none", // none | host | client
    phase: "idle", // idle | waiting-answer | connecting | connected
    pc: null,
    dc: null,
    remoteDir: { x: 0, y: 0 },
    inviteLink: "",
    lastError: "",
    joinInFlight: false,
    hostReady: false,
    clientReady: false,
    stepMode: false,
    pendingSteps: 0,
    gamepadIndex: -1,
    rbPressed: false,
    remoteInputCount: 0,
  },
  touch: {
    enabled: forceTouch || ("ontouchstart" in window) || (navigator.maxTouchPoints || 0) > 0,
    buttons: [],
  },
};

export function makePlayer(config) {
  return {
    id: config.id,
    name: config.name,
    control: config.control,
    snake: config.snake.map((s) => ({ ...s })),
    dir: { ...config.dir },
    nextDir: { ...config.dir },
    colors: config.colors,
    alive: true,
    score: 0,
    best: 0,
    reason: "",
  };
}

export function initPlayers() {
  const isHost = state.net.role === "host";
  const isClient = state.net.role === "client";
  const remoteMode = isHost || isClient;
  state.players = [
    makePlayer({
      id: "p1", name: "J1", control: isClient ? "remote" : "keyboard_local",
      snake: [{ x: 6, y: 13 }, { x: 5, y: 13 }, { x: 4, y: 13 }],
      dir: { x: 1, y: 0 },
      colors: { head: "#165d2f", body: "#2f9e44" },
    }),
    makePlayer({
      id: "p2", name: "J2", control: isHost ? "remote" : "keyboard_local",
      snake: [{ x: 19, y: 13 }, { x: 20, y: 13 }, { x: 21, y: 13 }],
      dir: remoteMode ? { x: -1, y: 0 } : { x: 0, y: 0 },
      colors: { head: "#7b2cbf", body: "#9d4edd" },
    }),
  ];
}

export function layout() {
  const remote = state.net.role === "host" || state.net.role === "client";
  if (remote) {
    const padding = 24;
    const hudH = 132;
    const board = Math.floor(Math.min(canvas.width - padding * 2, canvas.height - padding * 2 - hudH));
    const x = Math.floor((canvas.width - board) / 2);
    const y = padding + hudH;
    return { mode: "single", padding, hudH, board, x, y, tile: board / GRID };
  }
  const padding = 24;
  const gap = 32;
  const hudH = 80;
  const board = Math.floor(Math.min((canvas.width - padding * 2 - gap) / 2, canvas.height - padding * 2 - hudH));
  return {
    mode: "split",
    padding,
    gap,
    hudH,
    board,
    leftX: padding,
    rightX: padding + board + gap,
    y: padding + hudH,
    tile: board / GRID,
  };
}

export function getPlayerById(id) {
  return state.players.find((p) => p.id === id) || null;
}

export function resetMatch() {
  state.mode = "playing";
  state.elapsed = 0;
  state.winner = "";
  initPlayers();
  state.food = { ...FIRST_FOOD };
  state.net.hostReady = false;
  state.net.clientReady = false;
  state.net.pendingSteps = 0;
}

export function setStepMode(nextValue) {
  state.net.stepMode = Boolean(nextValue);
  state.net.pendingSteps = 0;
}

initPlayers();
