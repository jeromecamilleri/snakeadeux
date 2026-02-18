import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://127.0.0.1:4173";
const outDir = process.argv.includes("--out-dir")
  ? process.argv[process.argv.indexOf("--out-dir") + 1]
  : "output/multiplayer-e2e";
const room = `room-${Date.now()}`;

fs.mkdirSync(outDir, { recursive: true });

function fail(message) {
  throw new Error(message);
}

async function waitFor(page, fn, timeoutMs, label) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await page.evaluate(fn);
    if (ok) return;
    await page.waitForTimeout(100);
  }
  fail(`Timeout waiting for ${label}`);
}

async function getState(page) {
  const raw = await page.evaluate(() => window.render_game_to_text());
  return JSON.parse(raw);
}

function headX(state, playerId) {
  const p = state.players.find((x) => x.id === playerId);
  return p?.snake?.[0]?.x;
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

    await host.evaluate(() => window.test_api.toggleStepMode());

    await host.evaluate(() => window.test_api.setReady());
    await client.evaluate(() => window.test_api.setReady());

    await waitFor(host, () => JSON.parse(window.render_game_to_text()).mode === "playing", 8000, "host playing");
    await waitFor(client, () => JSON.parse(window.render_game_to_text()).mode === "playing", 8000, "client playing");

    const s0 = await getState(host);
    const hostJ1Start = headX(s0, "p1");
    const hostJ2Start = headX(s0, "p2");

    await host.evaluate(() => window.test_api.setDir(1, 0));
    await client.evaluate(() => window.test_api.setDir(-1, 0));
    await host.evaluate(() => window.test_api.step());

    await host.waitForTimeout(250);
    await client.waitForTimeout(250);

    const s1Host = await getState(host);
    const s1Client = await getState(client);

    if (headX(s1Host, "p1") === hostJ1Start) fail("J1 did not move on host after step");
    if (headX(s1Host, "p2") === hostJ2Start) fail("J2 did not move on host after remote input+step");

    if (headX(s1Client, "p1") !== headX(s1Host, "p1") || headX(s1Client, "p2") !== headX(s1Host, "p2")) {
      fail("Host/client states diverged after one step");
    }

    await host.screenshot({ path: path.join(outDir, "host.png") });
    await client.screenshot({ path: path.join(outDir, "client.png") });
    fs.writeFileSync(path.join(outDir, "host-state.json"), JSON.stringify(s1Host, null, 2));
    fs.writeFileSync(path.join(outDir, "client-state.json"), JSON.stringify(s1Client, null, 2));

    console.log("Multiplayer E2E OK");
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
