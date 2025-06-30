import dotenv from "dotenv";
dotenv.config();

import http from "http";
import WebSocket from "ws";
import url from "url";

import { DataState } from "./utils/DataState";
import {
  loadCache,
  getCoinCache,
  getDataState,
  getCache,
  fetchCoinsData,
  broadcastStatus,
} from "./cacheManager";

import { searchCoins, fetchFromCoinGeckoAPI } from "./search";
import { SearchMessageVariant } from "./utils/MessageVariant";
import { MessageStatus } from "./utils/MessageStatus";
import {
  ErrorCode,
  buildSocketErrorResponse,
} from "./utils/ErrorResponnseBuilder";

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

const initialStatus = getDataState();
broadcastStatus(wss, initialStatus);

if (initialStatus !== DataState.OK) {
  // Refresh if cache is outdated or stale
  fetchCoinsData(wss);
}

function handleSearchMessageIfNeeded(data: WebSocket.RawData, ws: WebSocket) {
  let parsed: any;
  try {
    parsed = JSON.parse(data.toString());
  } catch (err) {
    let response = buildSocketErrorResponse(ErrorCode.INVALID_JSON);
    ws.send(response);
    return;
  }

  const { type, query, requestID, maxResults = 25 } = parsed;

  if (type !== SearchMessageVariant.SEARCH_REQUEST) {
    let response = buildSocketErrorResponse(
      ErrorCode.INVALID_VARIANT_FIELD,
      requestID
    );

    ws.send(response);
    return;
  }

  if (typeof query !== "string" || query.trim() === "") {
    let response = buildSocketErrorResponse(ErrorCode.INVALID_QUERY, requestID);
    ws.send(response);
    return;
  }

  if (typeof requestID !== "string" || requestID.trim() === "") {
    let response = buildSocketErrorResponse(
      ErrorCode.INVALID_REQUEST_ID,
      requestID
    );
    ws.send(response);
    return;
  }

  if (typeof maxResults !== "number" || maxResults <= 0 || maxResults > 100) {
    let response = buildSocketErrorResponse(
      ErrorCode.INVALID_MAX_RESULTS,
      requestID
    );
    ws.send(response);
    return;
  }

  let results = searchCoins(query, getCoinCache(), maxResults);

  // If nothing found, fallback to CoinGecko search API
  if (results.length === 0) {
    fetchFromCoinGeckoAPI(query)
      .then((cgResults) => {
        if (cgResults === null) {
          let response = buildSocketErrorResponse(
            ErrorCode.SEARCH_FAILED,
            "Failed to fetch results from CoinGecko API",
            requestID
          );
          ws.send(response);
          return;
        }

        ws.send(
          JSON.stringify({
            status: MessageStatus.SUCCESS,
            variant: SearchMessageVariant.SEARCH_RESULT,
            requestID,
            data: cgResults,
          })
        );
      })
      .catch((err) => {
        console.error("Search fallback failed:", err);
        let response = buildSocketErrorResponse(
          ErrorCode.SEARCH_FAILED,
          "Unhandled error during search fallback",
          requestID
        );
        ws.send(response);
      });
  } else {
    ws.send(
      JSON.stringify({
        status: MessageStatus.SUCCESS,
        variant: SearchMessageVariant.SEARCH_RESULT,
        requestID,
        data: results,
      })
    );
  }
}
// Handle client connections
wss.on("connection", (ws, request) => {
  if (validateClient(request) === false) {
    console.log("❌ Unauthorized client attempted to connect");

    let response = buildSocketErrorResponse(ErrorCode.AUTHENTICATION_FAILED);
    ws.send(response);
    ws.close();
    return;
  }

  console.log("🆕 Client connected");

  ws.on("message", (data) => {
    handleSearchMessageIfNeeded(data, ws);
  });

  // Immediately send status and cache to new clients
  const { data, lastUpdated } = getCache();

  ws.send(
    JSON.stringify({
      type: "status",
      status: getDataState(),
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
