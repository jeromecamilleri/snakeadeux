import test from "node:test";
import assert from "node:assert/strict";

import {
  canRequestStep,
  canToggleStepMode,
  computeStartIntent,
  controlledPlayerIdForRole,
} from "../src/controls_logic.js";

test("canToggleStepMode blocks remote client only", () => {
  assert.equal(canToggleStepMode("none"), true);
  assert.equal(canToggleStepMode("host"), true);
  assert.equal(canToggleStepMode("client"), false);
});

test("canRequestStep requires playing + step mode", () => {
  assert.equal(canRequestStep("playing", true), true);
  assert.equal(canRequestStep("playing", false), false);
  assert.equal(canRequestStep("menu", true), false);
  assert.equal(canRequestStep("gameover", true), false);
});

test("computeStartIntent for host toggles host ready only when connected", () => {
  assert.deepEqual(
    computeStartIntent({ role: "host", phase: "connected", hostReady: false, clientReady: false }),
    { type: "toggle_host_ready", value: true },
  );
  assert.deepEqual(
    computeStartIntent({ role: "host", phase: "connected", hostReady: true, clientReady: false }),
    { type: "toggle_host_ready", value: false },
  );
  assert.deepEqual(
    computeStartIntent({ role: "host", phase: "waiting-answer", hostReady: true, clientReady: false }),
    { type: "noop" },
  );
});

test("computeStartIntent for client toggles client ready only when connected", () => {
  assert.deepEqual(
    computeStartIntent({ role: "client", phase: "connected", hostReady: false, clientReady: false }),
    { type: "toggle_client_ready", value: true },
  );
  assert.deepEqual(
    computeStartIntent({ role: "client", phase: "connected", hostReady: false, clientReady: true }),
    { type: "toggle_client_ready", value: false },
  );
  assert.deepEqual(
    computeStartIntent({ role: "client", phase: "connecting", hostReady: false, clientReady: false }),
    { type: "noop" },
  );
});

test("computeStartIntent for local mode starts local match", () => {
  assert.deepEqual(
    computeStartIntent({ role: "none", phase: "idle", hostReady: false, clientReady: false }),
    { type: "start_local" },
  );
});

test("controlled player id is role-dependent", () => {
  assert.equal(controlledPlayerIdForRole("client"), "p2");
  assert.equal(controlledPlayerIdForRole("host"), "p1");
  assert.equal(controlledPlayerIdForRole("none"), "p1");
});
