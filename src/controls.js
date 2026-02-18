import { getPlayerById, resetMatch, setStepMode, state } from "./state.js";
import { trySetDirection } from "./game.js";
import {
  cleanupNet,
  createHostOffer,
  createHostRoom,
  joinFromOfferCode,
  joinRoom,
  sendNet,
  syncReadyToPeer,
  tryStartSyncedRound,
} from "./network.js";
import {
  canRequestStep,
  canToggleStepMode,
  computeStartIntent,
  controlledPlayerIdForRole,
} from "./controls_logic.js";

export function toggleStepMode() {
  if (!canToggleStepMode(state.net.role)) return;
  setStepMode(!state.net.stepMode);
  if (state.net.role === "host") {
    sendNet({ type: "debug_state", stepMode: state.net.stepMode });
  }
}

export function requestStep() {
  if (!canRequestStep(state.mode, state.net.stepMode)) return;
  if (state.net.role === "client") {
    sendNet({ type: "step_request" });
    return;
  }
  state.net.pendingSteps += 1;
}

export function tryStartFromInput() {
  const intent = computeStartIntent({
    role: state.net.role,
    phase: state.net.phase,
    hostReady: state.net.hostReady,
    clientReady: state.net.clientReady,
  });

  if (intent.type === "toggle_host_ready") {
    state.net.hostReady = intent.value;
    syncReadyToPeer();
    tryStartSyncedRound();
    return;
  }

  if (intent.type === "toggle_client_ready") {
    state.net.clientReady = intent.value;
    sendNet({ type: "ready", value: state.net.clientReady });
    return;
  }

  if (intent.type === "start_local") {
    resetMatch();
  }
}

export function startLocalAction() {
  cleanupNet();
  state.net.role = "none";
  state.net.phase = "idle";
  tryStartFromInput();
}

export function startHostAction() {
  if (location.protocol === "http:" || location.protocol === "https:") {
    const room = prompt("Room ID hote (ex: room42):", "room42");
    if (!room) return;
    createHostRoom(room.trim()).catch((err) => {
      state.net.lastError = String(err.message || err);
      cleanupNet();
    });
    return;
  }

  createHostOffer().catch((err) => {
    state.net.lastError = String(err.message || err);
    cleanupNet();
  });
}

export function joinAction() {
  if (location.protocol === "http:" || location.protocol === "https:") {
    const room = prompt("Room ID a rejoindre:", "room42");
    if (!room) return;
    joinRoom(room.trim()).catch((err) => {
      state.net.lastError = String(err.message || err);
      cleanupNet();
    });
    return;
  }

  const pasted = prompt("Colle le code offer (ou la partie apres #offer=):", "");
  if (!pasted) return;
  const code = pasted.includes("#offer=") ? decodeURIComponent(pasted.split("#offer=")[1]) : pasted;
  joinFromOfferCode(code).catch((err) => {
    state.net.lastError = String(err.message || err);
    cleanupNet();
  });
}

export function handleDirInput(x, y) {
  const player = getPlayerById(controlledPlayerIdForRole(state.net.role));
  if (player) trySetDirection(player, x, y);
  if (state.net.role === "client") {
    sendNet({ type: "input", dir: { x, y } });
  }
}

export function createActions() {
  return {
    handleDirInput,
    joinAction,
    requestStep,
    startHostAction,
    startLocalAction,
    toggleStepMode,
    trySetDirection,
    tryStartFromInput,
  };
}
