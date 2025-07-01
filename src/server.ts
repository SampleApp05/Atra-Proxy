import http from "http";
import WebSocket from "ws";
import url from "url";

import { APIConfig } from "./utils/APIConfig";
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
import { SearchMessageVariant, SocketAction} from "./utils/MessageVariant";
import { MessageStatus } from "./utils/MessageStatus";
import {
  ErrorCode,
  buildSocketErrorResponse,
  buildSocketErrorResponseWithOriginal,
} from "./utils/ErrorResponseBuilder";

function validateClient(request: http.IncomingMessage): Boolean {
  const { query } = url.parse(request.url || "", true);
  const token = query.token;

  console.log("🔍 Validating client token:", token);
  console.log("🔍 Expected token:", APIConfig.AUTH_TOKEN);

  return token === APIConfig.AUTH_TOKEN;
}

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
  let action = SearchMessageVariant.SEARCH_REQUEST;
  
  const rawMessage = data.toString();
  let parsed: any;
  
  try {
    parsed = JSON.parse(rawMessage);
  } catch (err) {
    // Send back the original message for frontend correlation
    const response = {
      status: MessageStatus.ERROR,
      code: ErrorCode.INVALID_JSON,
      message: "Failed to parse JSON message",
      action,
      originalMessage: rawMessage, // Echo back the problematic message
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(response));
    return;
  }

  const { type, query, requestID, maxResults = 25 } = parsed;

  if (type !== SearchMessageVariant.SEARCH_REQUEST) {
    let response = buildSocketErrorResponseWithOriginal(
      ErrorCode.INVALID_VARIANT_FIELD,
      action,
      rawMessage,
      null,
      requestID
    );
    ws.send(response);
    return;
  }

  if (typeof query !== "string" || query.trim() === "") {
    let response = buildSocketErrorResponseWithOriginal(
      ErrorCode.INVALID_QUERY, 
      action,
      rawMessage,
      null,
      requestID
    );
    ws.send(response);
    return;
  }

  if (typeof requestID !== "string" || requestID.trim() === "") {
    let response = buildSocketErrorResponseWithOriginal(
      ErrorCode.INVALID_REQUEST_ID,
      action,
      rawMessage,
      null,
      requestID
    );
    ws.send(response);
    return;
  }

  if (typeof maxResults !== "number" || maxResults <= 0 || maxResults > 100) {
    let response = buildSocketErrorResponseWithOriginal(
      ErrorCode.INVALID_MAX_RESULTS,
      action,
      rawMessage,
      null,
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
            action,
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
          action,
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

    let response = buildSocketErrorResponse(ErrorCode.AUTHENTICATION_FAILED, SocketAction.AUTHENTICATION);
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
}, APIConfig.REFRESH_INTERVAL);

// Start HTTP + WS server
server.listen(APIConfig.PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${APIConfig.PORT}`);
});
