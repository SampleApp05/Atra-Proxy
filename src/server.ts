import dotenv from "dotenv";
dotenv.config();

import http, { request } from "http";
import WebSocket from "ws";
import url from "url";
import {
  loadCache,
  getCoinCache,
  getDataStatus,
  getCache,
  fetchCoinsData,
  broadcastStatus,
  DataStatus,
} from "./cacheManager";

import { searchCoins } from "./search";

const AUTH_TOKEN = process.env.CLIENT_AUTH_TOKEN || "super-secret-token";
const REFRESH_INTERVAL = 5 * 60 * 1000; // 10 minutes

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

function handleSearchMessageIfNeeded(data: WebSocket.RawData): string | null {
  try {
    const message = JSON.parse(data.toString());
    const id = message.requestID;

    if (
      (message.type === "search:request" &&
        typeof message.query === "string") === false
    ) {
      return null;
    }

    if (id == null || typeof id !== "string") {
      return JSON.stringify({
        type: "error",
        message: "Invalid Search message format",
        requestID: id,
      });
    }

    let results = searchCoins(
      message.query,
      getCoinCache(),
      message.maxResults || 25
    );

    return JSON.stringify({
      type: "search:result",
      query: message.query,
      results,
      requestID: id,
    });
  } catch (err) {
    console.error("❌ Failed to handle incoming message:", err);
    return JSON.stringify({
      type: "error",
      message: "Invalid message format",
    });
  }
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

  ws.on("message", (data) => {
    let message = handleSearchMessageIfNeeded(data);
    if (message) {
      ws.send(message);
      return;
    }
  });

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

setInterval(() => {
  fetchCoinsData(wss);
}, REFRESH_INTERVAL);

// Start HTTP + WS server
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});
