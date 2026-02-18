import { GRID } from "../constants.js";
import { canvas, ctx, state } from "../state.js";
import {
  isPlayerActiveForThisScreen,
  localPilotText,
  playerControlLabel,
  readyStatusShort,
} from "../ui/menu.js";

function drawWorld(viewX, viewY, size, tile) {
  ctx.fillStyle = "#f5f9ef";
  ctx.fillRect(viewX, viewY, size, size);
  ctx.strokeStyle = "rgba(34, 52, 33, 0.09)";
  for (let i = 0; i <= GRID; i++) {
    const p = i * tile;
    ctx.beginPath();
    ctx.moveTo(viewX + p, viewY);
    ctx.lineTo(viewX + p, viewY + size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(viewX, viewY + p);
    ctx.lineTo(viewX + size, viewY + p);
    ctx.stroke();
  }

  ctx.fillStyle = "#c1121f";
  ctx.beginPath();
  ctx.arc(viewX + state.food.x * tile + tile / 2, viewY + state.food.y * tile + tile / 2, tile * 0.35, 0, Math.PI * 2);
  ctx.fill();

  for (const p of state.players) {
    for (let i = p.snake.length - 1; i >= 0; i--) {
      const s = p.snake[i];
      ctx.fillStyle = i === 0 ? p.colors.head : p.colors.body;
      ctx.fillRect(viewX + s.x * tile + 1, viewY + s.y * tile + 1, tile - 2, tile - 2);
    }
  }
}

function drawHUDForPlayer(p, x, y, width) {
  const active = isPlayerActiveForThisScreen(p.id);
  ctx.fillStyle = active ? "rgba(22, 26, 28, 0.78)" : "rgba(31, 42, 31, 0.12)";
  ctx.fillRect(x, y, width, 68);
  ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.35)" : "rgba(31, 42, 31, 0.35)";
  ctx.strokeRect(x, y, width, 68);
  ctx.fillStyle = active ? "#f3f7f8" : "#132114";
  ctx.font = "bold 25px Trebuchet MS";
  ctx.fillStyle = p.colors.head;
  ctx.fillRect(x + 12, y + 11, 14, 14);
  ctx.fillStyle = active ? "#f3f7f8" : "#132114";
  ctx.fillText(p.name, x + 34, y + 27);
  ctx.font = "bold 20px Trebuchet MS";
  ctx.fillText("Score: " + p.score, x + 12, y + 53);
  ctx.font = "16px Trebuchet MS";
  const tag = active ? "ici" : "obs";
  ctx.fillText(playerControlLabel(p) + " | " + (p.alive ? "Actif" : "KO") + " | " + tag, x + 145, y + 53);
}

export function drawGameplay(layout) {
  if (layout.mode === "split") {
    drawHUDForPlayer(state.players[0], layout.leftX, layout.padding + 2, layout.board);
    drawHUDForPlayer(state.players[1], layout.rightX, layout.padding + 2, layout.board);
    drawWorld(layout.leftX, layout.y, layout.board, layout.tile);
    drawWorld(layout.rightX, layout.y, layout.board, layout.tile);
    ctx.strokeStyle = "rgba(18, 28, 20, 0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(layout.leftX, layout.y, layout.board, layout.board);
    ctx.strokeRect(layout.rightX, layout.y, layout.board, layout.board);
    return;
  }

  drawHUDForPlayer(state.players[0], 48, layout.padding + 40, 250);
  drawHUDForPlayer(state.players[1], canvas.width - 298, layout.padding + 40, 250);
  ctx.textAlign = "center";
  ctx.font = "15px Trebuchet MS";
  ctx.fillText(`Etat: ${state.net.role}/${state.net.phase} | ${state.net.stepMode ? "pas-a-pas" : "continu"} | ${readyStatusShort()}`, canvas.width / 2, layout.padding + 86);
  ctx.fillText(localPilotText(), canvas.width / 2, layout.padding + 106);
  ctx.textAlign = "left";
  drawWorld(layout.x, layout.y, layout.board, layout.tile);
  ctx.strokeStyle = "rgba(18, 28, 20, 0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(layout.x, layout.y, layout.board, layout.board);
}
