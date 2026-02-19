import { canvas, state } from "../state.js";

export function readyControlLabel() {
  return "Entree";
}

export function speedStatusText() {
  return state.net.stepMode ? "Mode pas a pas actif (Espace = +1 case)" : "Mode continu";
}

export function readyStatusText() {
  if (state.net.role === "none") return "Mode local";
  const h = state.net.hostReady ? "pret" : "attente";
  const c = state.net.clientReady ? "pret" : "attente";
  return `Ready hote=${h}, client=${c}, in=${state.net.remoteInputCount}`;
}

export function readyStatusShort() {
  if (state.net.role === "none") return "local";
  const h = state.net.hostReady ? "H:ok" : "H:...";
  const c = state.net.clientReady ? "C:ok" : "C:...";
  return `${h} ${c}`;
}

export function localPilotText() {
  if (state.net.role === "host") return "Vous pilotez J1 (vert) avec 8/4/6/2";
  if (state.net.role === "client") return "Vous pilotez J2 (violet)";
  return "Local: J1 vert (8/4/6/2), J2 violet (IJKL)";
}

export function playerControlLabel(player) {
  return player.control === "remote" ? "Distant" : "Clavier";
}

export function isPlayerActiveForThisScreen(playerId) {
  if (state.net.role === "host") return playerId === "p1";
  if (state.net.role === "client") return playerId === "p2";
  return true;
}

export function menuOverlayLines() {
  return [
    "L: mode local 2 joueurs clavier (J1=8/4/6/2, J2=IJKL)",
    "H: heberger une partie distante (room auto, unique)",
    "J: rejoindre la partie distante en cours",
    `${readyControlLabel()}: pret (distant) ou demarrer (local)`,
    "T: activer/desactiver le mode pas a pas",
    "En pas a pas: Espace = avance d'une case",
  ];
}

export function touchButtonsLayout(actions) {
  if (state.mode === "menu") {
    const w = 128;
    const h = 48;
    const gap = 12;
    const total = w * 3 + gap * 2;
    const x0 = Math.floor((canvas.width - total) / 2);
    const y = canvas.height - h - 18;
    const buttons = [
      { id: "local", x: x0, y, w, h, label: "LOCAL", action: () => actions.startLocalAction() },
      { id: "host", x: x0 + w + gap, y, w, h, label: "HOST", action: () => actions.startHostAction() },
      { id: "join", x: x0 + (w + gap) * 2, y, w, h, label: "JOIN", action: () => actions.joinAction() },
    ];
    if (state.net.role !== "none" && state.net.phase === "connected") {
      const readyOn = state.net.role === "host" ? state.net.hostReady : state.net.clientReady;
      buttons.push({
        id: "menu-ready",
        x: x0 + w + gap,
        y: y - h - 10,
        w,
        h,
        label: readyOn ? "PRET: OUI" : "PRET: NON",
        action: () => actions.tryStartFromInput(),
      });
    }
    return buttons;
  }

  if (!state.touch.enabled) return [];

  const size = 70;
  const margin = 18;
  const baseY = canvas.height - size - margin;
  const dpadX = margin + size;
  const buttons = [
    { id: "up", x: dpadX, y: baseY - size - 8, w: size, h: size, label: "▲", action: () => actions.handleDirInput(0, -1) },
    { id: "left", x: dpadX - size - 8, y: baseY, w: size, h: size, label: "◀", action: () => actions.handleDirInput(-1, 0) },
    { id: "down", x: dpadX, y: baseY, w: size, h: size, label: "▼", action: () => actions.handleDirInput(0, 1) },
    { id: "right", x: dpadX + size + 8, y: baseY, w: size, h: size, label: "▶", action: () => actions.handleDirInput(1, 0) },
  ];

  const actionW = 118;
  const actionH = 54;
  const rightX = canvas.width - actionW - margin;
  const actionTop = canvas.height - actionH * 2 - margin - 12;
  buttons.push({
    id: "ready",
    x: rightX,
    y: actionTop,
    w: actionW,
    h: actionH,
    label: "PRET",
    action: () => {
      if (state.mode === "playing") return;
      actions.tryStartFromInput();
    },
  });
  buttons.push({
    id: "step",
    x: rightX,
    y: actionTop + actionH + 12,
    w: actionW,
    h: actionH,
    label: "STEP",
    action: () => actions.requestStep(),
  });
  return buttons;
}
