import { state } from "./state.js";
import { update } from "./game.js";
import { bindPointer, createKeyHandler } from "./input.js";
import { dispatchTouchControl, render } from "./render.js";
import { maybeAutoJoinFromHash, sendNet, snapshot, createHostRoom, joinRoom } from "./network.js";
import { createActions } from "./controls.js";
import { buildRenderGameToText, installDebugHooks } from "./debug.js";

const actions = createActions();

function sendState() {
  sendNet({ type: "state", payload: snapshot() });
}

function tickAndRender(dtMs) {
  update(dtMs, { sendState });
  render(actions);
}

const keyHandler = createKeyHandler(actions);
document.addEventListener("keydown", keyHandler);
bindPointer(dispatchTouchControl);
maybeAutoJoinFromHash();

function loop(ts) {
  if (!state.lastTs) state.lastTs = ts;
  const dt = Math.min(34, ts - state.lastTs);
  state.lastTs = ts;
  tickAndRender(dt);
  requestAnimationFrame(loop);
}

const renderGameToText = buildRenderGameToText();
installDebugHooks({
  renderGameToText,
  advanceTime: (ms) => {
    const step = 1000 / 60;
    const n = Math.max(1, Math.round(ms / step));
    for (let i = 0; i < n; i++) {
      update(step, { sendState });
    }
    render(actions);
  },
  createHostRoom,
  joinRoom,
  setReady: actions.tryStartFromInput,
  toggleStepMode: actions.toggleStepMode,
  step: actions.requestStep,
  setDir: actions.handleDirInput,
});

render(actions);
requestAnimationFrame(loop);
