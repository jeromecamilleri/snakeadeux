import { state, initPlayers, resetMatch, setStepMode } from "./state.js";

export function sendNet(msg) {
  if (state.net.dc && state.net.dc.readyState === "open") {
    state.net.dc.send(JSON.stringify(msg));
  }
}

export function syncReadyToPeer() {
  if (state.net.phase !== "connected") return;
  sendNet({
    type: "ready_state",
    hostReady: state.net.hostReady,
    clientReady: state.net.clientReady,
  });
}

export function tryStartSyncedRound() {
  if (state.net.role !== "host" || state.net.phase !== "connected") return;
  if (!state.net.hostReady || !state.net.clientReady) return;
  resetMatch();
  sendNet({ type: "start" });
  syncReadyToPeer();
}

export function snapshot() {
  return {
    mode: state.mode,
    winner: state.winner,
    food: state.food,
    players: state.players.map((p) => ({
      id: p.id,
      alive: p.alive,
      score: p.score,
      best: p.best,
      reason: p.reason,
      dir: p.dir,
      nextDir: p.nextDir,
      snake: p.snake,
    })),
  };
}

export function applySnapshot(s) {
  state.mode = s.mode;
  state.winner = s.winner;
  state.food = s.food;
  for (let i = 0; i < state.players.length; i++) {
    const src = s.players[i];
    const dst = state.players[i];
    dst.alive = src.alive;
    dst.score = src.score;
    dst.best = src.best;
    dst.reason = src.reason;
    dst.dir = src.dir;
    dst.nextDir = src.nextDir;
    dst.snake = src.snake;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalBaseUrl() {
  return `${location.origin}/signal/room`;
}

async function signalSet(roomId, kind, payload) {
  const res = await fetch(`${signalBaseUrl()}/${encodeURIComponent(roomId)}/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ payload }),
  });
  if (!res.ok) throw new Error(`Signal POST ${kind} failed (${res.status})`);
}

async function signalGet(roomId, kind) {
  const res = await fetch(`${signalBaseUrl()}/${encodeURIComponent(roomId)}/${kind}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Signal GET ${kind} failed (${res.status})`);
  const data = await res.json();
  return data.payload || null;
}

async function pollSignal(roomId, kind, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const payload = await signalGet(roomId, kind);
    if (payload) return payload;
    await sleep(250);
  }
  throw new Error(`Timeout signal ${kind}`);
}

function waitIceDone(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", onChange);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

export function cleanupNet() {
  if (state.net.dc) state.net.dc.close();
  if (state.net.pc) state.net.pc.close();
  state.net.pc = null;
  state.net.dc = null;
  state.net.role = "none";
  state.net.phase = "idle";
  state.net.remoteDir = { x: 0, y: 0 };
  state.net.inviteLink = "";
  state.net.hostReady = false;
  state.net.clientReady = false;
  state.net.pendingSteps = 0;
  state.net.gamepadIndex = -1;
  state.net.rbPressed = false;
  state.net.remoteInputCount = 0;
}

function attachDataChannel(dc) {
  state.net.dc = dc;
  dc.onopen = () => {
    state.net.phase = "connected";
    state.net.lastError = "";
    state.net.hostReady = false;
    state.net.clientReady = false;
    if (state.net.role === "host") {
      syncReadyToPeer();
      sendNet({ type: "debug_state", stepMode: state.net.stepMode });
    }
  };
  dc.onclose = () => {
    state.net.phase = "idle";
  };
  dc.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === "input" && state.net.role === "host") {
      state.net.remoteDir = msg.dir;
      state.net.remoteInputCount += 1;
    }
    if (msg.type === "ready" && state.net.role === "host") {
      state.net.clientReady = !!msg.value;
      syncReadyToPeer();
      tryStartSyncedRound();
    }
    if (msg.type === "step_request" && state.net.role === "host") {
      if (state.net.stepMode && state.mode === "playing") state.net.pendingSteps += 1;
    }
    if (msg.type === "start" && state.net.role === "client") {
      resetMatch();
    }
    if (msg.type === "debug_state" && state.net.role === "client") {
      setStepMode(!!msg.stepMode);
    }
    if (msg.type === "ready_state" && state.net.role === "client") {
      state.net.hostReady = !!msg.hostReady;
      state.net.clientReady = !!msg.clientReady;
    }
    if (msg.type === "state" && state.net.role === "client") {
      applySnapshot(msg.payload);
    }
  };
}

export async function createHostRoom(roomId) {
  cleanupNet();
  state.net.role = "host";
  state.net.phase = "waiting-answer";
  state.net.lastError = "";
  initPlayers();

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  state.net.pc = pc;
  const dc = pc.createDataChannel("snake");
  attachDataChannel(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceDone(pc);
  await signalSet(roomId, "offer", pc.localDescription);

  const answer = await pollSignal(roomId, "answer", 45000);
  if (!answer || answer.type !== "answer") throw new Error("Answer invalide");
  if (pc.signalingState !== "have-local-offer") {
    throw new Error("Etat hote inattendu: " + pc.signalingState);
  }
  await pc.setRemoteDescription(answer);
  state.net.phase = "connecting";
}

export async function joinRoom(roomId) {
  if (state.net.joinInFlight) return;
  state.net.joinInFlight = true;
  cleanupNet();
  state.net.role = "client";
  state.net.phase = "connecting";
  state.net.lastError = "";
  initPlayers();
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    state.net.pc = pc;
    pc.ondatachannel = (e) => attachDataChannel(e.channel);

    const offer = await pollSignal(roomId, "offer", 45000);
    if (!offer || offer.type !== "offer") throw new Error("Offer invalide");
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceDone(pc);
    await signalSet(roomId, "answer", pc.localDescription);
  } finally {
    state.net.joinInFlight = false;
  }
}

export async function createHostOffer() {
  cleanupNet();
  state.net.role = "host";
  state.net.phase = "waiting-answer";
  initPlayers();
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  state.net.pc = pc;
  const dc = pc.createDataChannel("snake");
  attachDataChannel(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitIceDone(pc);
  const offerCode = btoa(JSON.stringify(pc.localDescription));
  const link = location.origin + location.pathname + "#offer=" + encodeURIComponent(offerCode);
  state.net.inviteLink = link;
  prompt("Lien d'invitation a partager avec J2:", link);
}

export async function joinFromOfferCode(offerCode) {
  if (state.net.joinInFlight) return;
  state.net.joinInFlight = true;
  cleanupNet();
  state.net.role = "client";
  state.net.phase = "connecting";
  initPlayers();
  try {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    state.net.pc = pc;
    pc.ondatachannel = (e) => attachDataChannel(e.channel);

    const offer = JSON.parse(atob(offerCode.trim()));
    if (!offer || offer.type !== "offer") {
      throw new Error("Code d'invitation invalide (offer attendu).");
    }
    if (pc.signalingState !== "stable") {
      throw new Error("Etat WebRTC invalide avant join: " + pc.signalingState);
    }
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitIceDone(pc);
    const answerCode = btoa(JSON.stringify(pc.localDescription));
    prompt("Code reponse a renvoyer a l'hote:", answerCode);
  } finally {
    state.net.joinInFlight = false;
  }
}

export function maybeAutoJoinFromHash() {
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const offer = hash.get("offer");
  if (offer && state.net.phase === "idle") {
    joinFromOfferCode(offer).catch((err) => {
      state.net.lastError = String(err.message || err);
      cleanupNet();
    });
  }
}
