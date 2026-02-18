import { canvas, state } from "./state.js";

export function createKeyHandler(actions) {
  return function keyHandler(e) {
    const key = e.key.toLowerCase();
    const code = e.code;
    const blockedKeys = new Set([
      "arrowup", "arrowdown", "arrowleft", "arrowright",
      "i", "j", "k", "l",
      "enter", " ", "r", "t",
    ]);
    const blockedCodes = new Set([
      "Digit8", "Digit4", "Digit6", "Digit2",
      "Numpad8", "Numpad4", "Numpad6", "Numpad2",
      "NumpadEnter",
    ]);
    if (blockedKeys.has(key) || blockedCodes.has(code)) e.preventDefault();

    if (key === "f") {
      if (!document.fullscreenElement) canvas.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
      return;
    }

    if (state.mode === "menu") {
      if (key === "l") return actions.startLocalAction();
      if (key === "h") return actions.startHostAction();
      if (key === "j") return actions.joinAction();
    }

    if (key === "t") return actions.toggleStepMode();

    if (state.net.stepMode && (state.mode === "menu" || state.mode === "gameover")) {
      if (key === "r") return actions.tryStartFromInput();
    }

    if (!state.net.stepMode && (state.mode === "menu" || state.mode === "gameover") && (key === "enter" || key === " ")) {
      return actions.tryStartFromInput();
    }

    if (state.mode !== "playing") return;

    if ((key === "enter" || key === " ") && state.net.stepMode) {
      if (!e.repeat) actions.requestStep();
      return;
    }

    if (state.net.role === "client") {
      if (key === "i") actions.handleDirInput(0, -1);
      if (key === "k") actions.handleDirInput(0, 1);
      if (key === "j") actions.handleDirInput(-1, 0);
      if (key === "l") actions.handleDirInput(1, 0);
    } else {
      if (code === "Digit8" || code === "Numpad8") actions.handleDirInput(0, -1);
      if (code === "Digit2" || code === "Numpad2") actions.handleDirInput(0, 1);
      if (code === "Digit4" || code === "Numpad4") actions.handleDirInput(-1, 0);
      if (code === "Digit6" || code === "Numpad6") actions.handleDirInput(1, 0);
    }

    if (state.net.role === "none") {
      if (key === "i") actions.trySetDirection(state.players[1], 0, -1);
      if (key === "k") actions.trySetDirection(state.players[1], 0, 1);
      if (key === "j") actions.trySetDirection(state.players[1], -1, 0);
      if (key === "l") actions.trySetDirection(state.players[1], 1, 0);
    }
  };
}

export function bindPointer(dispatchTouchControl) {
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    if (dispatchTouchControl(x, y)) {
      e.preventDefault();
    }
  }, { passive: false });
}
