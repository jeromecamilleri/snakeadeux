import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

const rooms = new Map();

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function logRequest(req, pathname, statusCode, extra = "") {
  const ip = clientIp(req);
  const now = new Date().toISOString();
  const suffix = extra ? ` ${extra}` : "";
  console.log(`[${now}] ${req.method} ${pathname} -> ${statusCode} ip=${ip}${suffix}`);
}

function json(res, code, payload) {
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(payload));
}

function text(res, code, message) {
  res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
  res.end(message);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("payload too large"));
      }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { offer: null, answer: null, updatedAt: Date.now() });
  return rooms.get(roomId);
}

function serveStatic(req, res, pathname) {
  const safe = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(root, safe.replace(/^\/+/, ""));
  if (!filePath.startsWith(root)) {
    logRequest(req, pathname, 403);
    return text(res, 403, "forbidden");
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    logRequest(req, pathname, 404);
    return text(res, 404, "not found");
  }

  const ext = path.extname(filePath).toLowerCase();
  const type = ext === ".html"
    ? "text/html; charset=utf-8"
    : ext === ".js" || ext === ".mjs"
      ? "text/javascript; charset=utf-8"
      : ext === ".json"
        ? "application/json; charset=utf-8"
        : ext === ".png"
          ? "image/png"
          : "application/octet-stream";

  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  logRequest(req, pathname, 200);
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
        "access-control-allow-headers": "content-type",
      });
      logRequest(req, pathname, 204);
      return res.end();
    }

    const m = pathname.match(/^\/signal\/room\/([^/]+)\/(offer|answer)$/);
    if (m) {
      const roomId = decodeURIComponent(m[1]);
      const kind = m[2];
      const room = getRoom(roomId);

      if (req.method === "GET") {
        if (!room[kind]) {
          logRequest(req, pathname, 404, `room=${roomId} kind=${kind} miss`);
          return json(res, 404, { ok: false, error: "missing" });
        }
        logRequest(req, pathname, 200, `room=${roomId} kind=${kind} hit`);
        return json(res, 200, { ok: true, payload: room[kind], updatedAt: room.updatedAt });
      }

      if (req.method === "POST") {
        const body = await parseBody(req);
        room[kind] = body.payload || null;
        room.updatedAt = Date.now();
        logRequest(req, pathname, 200, `room=${roomId} kind=${kind} set`);
        return json(res, 200, { ok: true });
      }

      if (req.method === "DELETE") {
        if (kind === "offer") room.offer = null;
        if (kind === "answer") room.answer = null;
        room.updatedAt = Date.now();
        logRequest(req, pathname, 200, `room=${roomId} kind=${kind} clear`);
        return json(res, 200, { ok: true });
      }

      logRequest(req, pathname, 405, `room=${roomId} kind=${kind}`);
      return json(res, 405, { ok: false, error: "method" });
    }

    if (pathname === "/signal/health") {
      logRequest(req, pathname, 200, `rooms=${rooms.size}`);
      return json(res, 200, { ok: true, rooms: rooms.size });
    }

    serveStatic(req, res, pathname);
  } catch (err) {
    logRequest(req, req.url || "/", 500, `error=${err.message}`);
    text(res, 500, `server error: ${err.message}`);
  }
});

server.listen(port, host, () => {
  const printableHost = host.includes(":") ? `[${host}]` : host;
  console.log(`Signal+static server listening on http://${printableHost}:${port}`);
});
