import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://127.0.0.1:4173";
const outDir = process.argv.includes("--out-dir")
  ? process.argv[process.argv.indexOf("--out-dir") + 1]
  : "output/multiplayer-keyboard-e2e";
const room = `room-kb-${Date.now()}`;

fs.mkdirSync(outDir, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function waitFor(page, fn, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await page.evaluate(fn);
    if (ok) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for ${label}`);
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

function head(state, id) {
  const p = state.players.find((x) => x.id === id);
  return p?.snake?.[0] || null;
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
  const host = await context.newPage();
  const client = await context.newPage();

  try {
    await Promise.all([
      host.goto(url, { waitUntil: "domcontentloaded" }),
      client.goto(url, { waitUntil: "domcontentloaded" }),
    ]);

    await host.evaluate((r) => {
      window.test_api.startHostRoom(r).catch((err) => {
        window.__host_room_error = String(err && err.message ? err.message : err);
      });
      return true;
    }, room);
    await client.evaluate((r) => window.test_api.joinRoom(r), room);

    await waitFor(host, () => JSON.parse(window.render_game_to_text()).network.phase === "connected", 60000, "host connected");
    await waitFor(client, () => JSON.parse(window.render_game_to_text()).network.phase === "connected", 60000, "client connected");

    // step mode ON
    await host.keyboard.press("t");

    // ready both with R (in step mode)
    await host.keyboard.press("r");
    await client.keyboard.press("r");

    await waitFor(host, () => JSON.parse(window.render_game_to_text()).mode === "playing", 8000, "host playing");
    await waitFor(client, () => JSON.parse(window.render_game_to_text()).mode === "playing", 8000, "client playing");

    const s0 = await getState(host);
    const p1Start = head(s0, "p1");
    const p2Start = head(s0, "p2");
    assert(p1Start && p2Start, "missing initial heads");

    // Real keyboard inputs on each page (no test_api.setDir)
    await host.locator("canvas").click();
    await host.keyboard.press("Digit2"); // host controls J1 (green) with 8/4/6/2

    await client.locator("canvas").click();
    await client.keyboard.press("i"); // client controls J2 (purple)
    await client.waitForTimeout(120);

    await waitFor(host, () => {
      const s = JSON.parse(window.render_game_to_text());
      return (s.network.remoteInputCount || 0) > 0;
    }, 5000, "host receives remote keyboard input");

    // Step one cell
    await host.keyboard.press("Enter");
    await host.waitForTimeout(250);

    const s1h = await getState(host);
    const s1c = await getState(client);
    const p1End = head(s1h, "p1");
    const p2End = head(s1h, "p2");

    assert(p1End && p2End, "missing final heads");
    assert(p1End.y !== p1Start.y || p1End.x !== p1Start.x, "J1 did not move from host keyboard");
    assert(p2End.y !== p2Start.y || p2End.x !== p2Start.x, "J2 did not move from client keyboard");
    assert((s1h.network.remoteInputCount || 0) > 0, "Host did not receive client input");

    assert(head(s1c, "p1")?.x === p1End.x && head(s1c, "p1")?.y === p1End.y, "Client out of sync for J1");
    assert(head(s1c, "p2")?.x === p2End.x && head(s1c, "p2")?.y === p2End.y, "Client out of sync for J2");

    await host.screenshot({ path: path.join(outDir, "host.png") });
    await client.screenshot({ path: path.join(outDir, "client.png") });
    fs.writeFileSync(path.join(outDir, "host-state.json"), JSON.stringify(s1h, null, 2));
    fs.writeFileSync(path.join(outDir, "client-state.json"), JSON.stringify(s1c, null, 2));

    console.log("Multiplayer keyboard-focus E2E OK");
    console.log(`room=${room}`);
    console.log(`artifacts=${outDir}`);
  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
