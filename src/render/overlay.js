import { canvas, ctx, state } from "../state.js";
import {
  menuOverlayLines,
  readyControlLabel,
  readyStatusText,
  speedStatusText,
  touchButtonsLayout,
} from "../ui/menu.js";

export function drawTouchControls(actions) {
  state.touch.buttons = touchButtonsLayout(actions);
  if (state.touch.buttons.length === 0) return;

  for (const b of state.touch.buttons) {
    const isAction = b.id === "ready" || b.id === "step";
    ctx.fillStyle = isAction ? "rgba(16, 24, 18, 0.72)" : "rgba(24, 36, 27, 0.62)";
    ctx.strokeStyle = "rgba(244, 250, 242, 0.6)";
    ctx.lineWidth = 2;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#f4fbf2";
    ctx.font = isAction ? "bold 16px Trebuchet MS" : "bold 26px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function dispatchTouchControl(x, y) {
  for (const b of state.touch.buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      b.action();
      return true;
    }
  }
  return false;
}

export function drawModeOverlay() {
  if (state.mode === "menu") {
    ctx.fillStyle = "rgba(21, 31, 21, 0.82)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff8ea";
    ctx.textAlign = "center";
    ctx.font = "bold 60px Trebuchet MS";
    ctx.fillText("SNAKE DUO ONLINE", canvas.width / 2, canvas.height / 2 - 130);
    ctx.font = "20px Trebuchet MS";
    const lines = menuOverlayLines();
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 58 + i * 30));
    ctx.font = "20px Trebuchet MS";
    const netText = `Reseau: role=${state.net.role}, phase=${state.net.phase}`;
    ctx.fillText(netText, canvas.width / 2, canvas.height / 2 + 160);
    ctx.fillText(readyStatusText(), canvas.width / 2, canvas.height / 2 + 186);
    ctx.fillText(speedStatusText(), canvas.width / 2, canvas.height / 2 + 212);
    if (state.net.lastError) ctx.fillText("Erreur: " + state.net.lastError, canvas.width / 2, canvas.height / 2 + 238);
    ctx.textAlign = "left";
  }

  if (state.mode === "gameover") {
    ctx.fillStyle = "rgba(52, 10, 26, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff2e8";
    ctx.textAlign = "center";
    ctx.font = "bold 58px Trebuchet MS";
    ctx.fillText("ROUND TERMINE", canvas.width / 2, canvas.height / 2 - 120);
    ctx.font = "30px Trebuchet MS";
    ctx.fillText(state.winner === "egalite" ? "Egalite" : "Vainqueur: " + state.winner, canvas.width / 2, canvas.height / 2 - 70);
    ctx.font = "24px Trebuchet MS";
    ctx.fillText(`${readyControlLabel()}: pret pour le round suivant`, canvas.width / 2, canvas.height / 2 - 20);
    ctx.textAlign = "left";
  }
}
