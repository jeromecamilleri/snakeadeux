import { GRID, STEP_MS } from "./constants.js";
import { layout, state } from "./state.js";

export function buildRenderGameToText() {
  return function renderGameToText() {
    const l = layout();
    return JSON.stringify({
      coordinateSystem: "origin_top_left_x_right_y_down_shared_grid",
      grid: { width: GRID, height: GRID },
      mode: state.mode,
      stepMs: STEP_MS,
      winner: state.winner,
      food: state.food,
      players: state.players.map((p) => ({
        id: p.id,
        name: p.name,
        control: p.control,
        alive: p.alive,
        score: p.score,
        best: p.best,
        reason: p.reason,
        direction: p.dir,
        queuedDirection: p.nextDir,
        snake: p.snake,
      })),
      network: {
        role: state.net.role,
        phase: state.net.phase,
        hasInviteLink: Boolean(state.net.inviteLink),
        hostReady: state.net.hostReady,
        clientReady: state.net.clientReady,
        stepMode: state.net.stepMode,
        pendingSteps: state.net.pendingSteps,
        remoteInputCount: state.net.remoteInputCount,
        lastError: state.net.lastError,
      },
      touch: {
        enabled: state.touch.enabled,
        buttons: state.touch.buttons.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })),
      },
      views: l.mode === "split"
        ? { mode: "split", left: { x: l.leftX, y: l.y, size: l.board }, right: { x: l.rightX, y: l.y, size: l.board } }
        : { mode: "single", main: { x: l.x, y: l.y, size: l.board } },
      visible: { overlay: state.mode !== "playing", splitScreen: l.mode === "split", sharedWorld: true },
    });
  };
}

export function installDebugHooks({
  renderGameToText,
  advanceTime,
  createHostRoom,
  joinRoom,
  setReady,
  toggleStepMode,
  step,
  setDir,
}) {
  window.render_game_to_text = renderGameToText;
  window.advanceTime = advanceTime;
  window.test_api = {
    startHostRoom: async (roomId) => createHostRoom(roomId),
    joinRoom: async (roomId) => joinRoom(roomId),
    setReady: () => setReady(),
    toggleStepMode: () => toggleStepMode(),
    step: () => step(),
    setDir: (x, y) => setDir(x, y),
    getState: () => JSON.parse(renderGameToText()),
  };
}
