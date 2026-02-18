import { GRID } from "./constants.js";
import { canvas, ctx, layout, state } from "./state.js";
import { drawGameplay } from "./render/gameplay.js";
import { dispatchTouchControl, drawModeOverlay, drawTouchControls } from "./render/overlay.js";

export { dispatchTouchControl };

function drawHeader() {
  ctx.fillStyle = "#132114";
  ctx.textAlign = "center";
  if (state.mode === "menu") {
    ctx.font = "bold 21px Trebuchet MS";
    ctx.fillText("Snake Duo - Grille partagee " + GRID + "x" + GRID + " | F: plein ecran", canvas.width / 2, 40);
  } else {
    ctx.font = "bold 22px Trebuchet MS";
    ctx.fillText("Snake Duo - Grille partagee " + GRID + "x" + GRID, canvas.width / 2, 36);
    ctx.font = "15px Trebuchet MS";
    ctx.fillText(`Reseau ${state.net.role}/${state.net.phase} | F: plein ecran`, canvas.width / 2, 58);
  }
  ctx.textAlign = "left";
}

export function render(actions) {
  const l = layout();
  ctx.fillStyle = "#eaf2e0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawHeader();
  drawGameplay(l);
  drawTouchControls(actions);
  drawModeOverlay();
}
