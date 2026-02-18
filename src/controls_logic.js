export function canToggleStepMode(role) {
  return role !== "client";
}

export function canRequestStep(mode, stepMode) {
  return mode === "playing" && stepMode;
}

export function computeStartIntent({ role, phase, hostReady, clientReady }) {
  if (role === "host") {
    if (phase === "connected") {
      return { type: "toggle_host_ready", value: !hostReady };
    }
    return { type: "noop" };
  }

  if (role === "client") {
    if (phase === "connected") {
      return { type: "toggle_client_ready", value: !clientReady };
    }
    return { type: "noop" };
  }

  return { type: "start_local" };
}

export function controlledPlayerIdForRole(role) {
  return role === "client" ? "p2" : "p1";
}
