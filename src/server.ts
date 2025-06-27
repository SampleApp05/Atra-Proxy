import dotenv from "dotenv";
dotenv.config();

import http from "http";
import WebSocket from "ws";
import url from "url";
import {
  loadCache,
  getDataStatus,
  getCache,
  fetchCoinsData,
  broadcastStatus,
  DataStatus,
} from "./cacheManager";

const AUTH_TOKEN = process.env.CLIENT_AUTH_TOKEN || "super-secret-token";

function validateClient(request: http.IncomingMessage): Boolean {
  const { query } = url.parse(request.url || "", true);
  const token = query.token;

  console.log("🔍 Validating client token:", token);
  console.log("🔍 Expected token:", AUTH_TOKEN);

  return token === AUTH_TOKEN;
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8080;

const server = http.createServer();

const wss = new WebSocket.Server({ server });

// Load cache and broadcast initial status on server start
loadCache();

const initialStatus = getDataStatus();
broadcastStatus(wss, initialStatus);

if (initialStatus !== DataStatus.OK) {
  // Refresh if cache is outdated or stale
  fetchCoinsData(wss);
}

// Handle client connections
wss.on("connection", (ws, request) => {
  if (validateClient(request) === false) {
    console.log("❌ Unauthorized client attempted to connect");

    ws.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
    ws.close();
    return;
  }

  console.log("🆕 Client connected");

  // Immediately send status and cache to new clients
  const { data, lastUpdated } = getCache();

  ws.send(
    JSON.stringify({
      type: "status",
      status: getDataStatus(),
      lastUpdated,
    })
  );

  ws.send(
    JSON.stringify({
      type: "coins:update",
      data,
      lastUpdated,
    })
  );

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

// Periodic refresh every 10 minutes
const REFRESH_INTERVAL = 10 * 60 * 1000;

setInterval(() => {
  fetchCoinsData(wss);
}, REFRESH_INTERVAL);

// Start HTTP + WS server
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
