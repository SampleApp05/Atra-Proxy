import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import url from "url";

import { APIConfig } from "./utils/APIConfig";
import {
  loadCache,
  getCoinCache,
  getUpdateTime,
  getNextUpdateTime,
  getCache,
  fetchCoinsData,
  broadcastStatus,
  broadcastWatchlists,
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
  // Only accept Authorization header for security
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    console.log("❌ No Authorization header provided");
    return false;
  }
  
  let token: string;
  
  // Support both "Bearer TOKEN" and just "TOKEN" formats
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = authHeader;
  }

  console.log("🔍 Validating client token:", token ? `${token.substring(0, 8)}...` : 'none');
  console.log("🔍 Expected token:", APIConfig.AUTH_TOKEN ? `${APIConfig.AUTH_TOKEN.substring(0, 8)}...` : 'none');

  return token === APIConfig.AUTH_TOKEN;
}

// Create HTTP server for health checks and WebSocket upgrade
const server = http.createServer((req, res) => {
  // Handle HTTP requests for health checks, etc.
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      lastUpdated: getUpdateTime(),
      nextUpdate: getNextUpdateTime(),
      timestamp: new Date().toISOString(),
      port: APIConfig.PORT
    }));
    return;
  }
  
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>Atra-Proxy WebSocket Server</title></head>
        <body>
          <h1>🚀 Atra-Proxy WebSocket Server</h1>
          <p><strong>Status:</strong> Running</p>
          <p><strong>WebSocket Endpoint:</strong> ws://localhost:${APIConfig.PORT}</p>
          <p><strong>Last Updated:</strong> ${getUpdateTime() || 'Never'}</p>
          <p><strong>Next Update:</strong> ${getNextUpdateTime()}</p>
          <p><strong>Health Check:</strong> <a href="/health">/health</a></p>
          <hr>
          <h3>Authentication:</h3>
          <p><strong>⚠️ Authorization header required</strong></p>
          <h4>Supported formats:</h4>
          <code>Authorization: Bearer YOUR_TOKEN</code><br>
          <code>Authorization: YOUR_TOKEN</code>
          
          <h3>iOS Swift Example:</h3>
          <pre>
var request = URLRequest(url: URL(string: "ws://localhost:${APIConfig.PORT}")!)
request.setValue("Bearer YOUR_TOKEN", forHTTPHeaderField: "Authorization")
webSocketTask = urlSession?.webSocketTask(with: request)
          </pre>
        </body>
      </html>
    `);
    return;
  }
  
  // For all other routes, return 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found', message: 'Use WebSocket connection' }));
});

// Create WebSocket server that can handle direct connections
const wss = new WebSocketServer({ 
  server,
  // Allow direct WebSocket connections without HTTP upgrade
  perMessageDeflate: false,
  verifyClient: (info: { req: http.IncomingMessage }) => {
    // Validate the client during WebSocket handshake
    return validateClient(info.req);
  }
});

// Load cache and broadcast initial status on server start
loadCache();

broadcastStatus(wss, false); // Not loading initially

// Check if we need to refresh data immediately
const lastUpdate = getUpdateTime();
if (!lastUpdate) {
  // No data at all, fetch immediately
  fetchCoinsData(wss);
} else {
  // Check if data is stale (older than refresh interval)
  const lastUpdateMs = new Date(lastUpdate).getTime();
  const now = Date.now();
  if (now - lastUpdateMs > APIConfig.REFRESH_INTERVAL) {
    // Data is stale, refresh it
    fetchCoinsData(wss);
  }
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

  const { event, query, requestID, maxResults = 25 } = parsed;

  if (event !== SearchMessageVariant.SEARCH_REQUEST) {
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
            event: SearchMessageVariant.SEARCH_RESULT,
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
        event: SearchMessageVariant.SEARCH_RESULT,
        requestID,
        data: results,
      })
    );
  }
}
// Handle client connections
wss.on("connection", (ws, request) => {
  // Authentication is already handled in verifyClient, log connection details
  const authHeader = request.headers.authorization;
  
  const clientInfo = {
    userAgent: request.headers['user-agent'] || 'Unknown',
    origin: request.headers.origin || 'Unknown',
    ip: request.socket.remoteAddress || 'Unknown',
    authMethod: 'Header' // Only header auth is supported now
  };
  
  console.log("🆕 Client connected:", {
    userAgent: clientInfo.userAgent,
    origin: clientInfo.origin,
    ip: clientInfo.ip,
    authMethod: clientInfo.authMethod
  });

  // Send immediate welcome message with connection info
  ws.send(JSON.stringify({
    event: "connection_established",
    message: "WebSocket connection established",
    serverTime: new Date().toISOString(),
    lastUpdated: getUpdateTime(),
    nextUpdate: getNextUpdateTime(),
    authMethod: clientInfo.authMethod
  }));

  ws.on("message", (data) => {
    try {
      handleSearchMessageIfNeeded(data, ws);
    } catch (error) {
      console.error("❌ Error handling message:", error);
      const errorResponse = {
        status: MessageStatus.ERROR,
        code: ErrorCode.UNEXPECTED_SERVER_ERROR,
        message: "Internal server error while processing message",
        timestamp: new Date().toISOString()
      };
      ws.send(JSON.stringify(errorResponse));
    }
  });

  // Immediately send status and cache to new clients
  const { data, lastUpdated, nextUpdate } = getCache();

  ws.send(
    JSON.stringify({
      event: "status",
      lastUpdated,
      nextUpdate,
      isLoading: false
    })
  );

  ws.send(
    JSON.stringify({
      event: "coins_update",
      data,
      lastUpdated,
      nextUpdate
    })
  );

  // Send current watchlists to new client
  if (data && data.length > 0) {
    // Create a single-client WebSocket server wrapper for broadcastWatchlists
    const singleClientWss = {
      clients: new Set([ws])
    } as WebSocketServer;
    broadcastWatchlists(singleClientWss);
  }

  // Handle client disconnection
  ws.on("close", (code, reason) => {
    console.log(`🔌 Client disconnected: ${code} ${reason || '(no reason)'}`);
  });

  // Handle WebSocket errors
  ws.on("error", (error) => {
    console.error("❌ WebSocket error:", error);
  });
});

setInterval(() => {
  fetchCoinsData(wss);
}, APIConfig.REFRESH_INTERVAL);

// Start HTTP + WebSocket server
server.listen(APIConfig.PORT, () => {
  console.log(`🚀 Atra-Proxy Server Started`);
  console.log(`📍 HTTP Server: http://localhost:${APIConfig.PORT}`);
  console.log(`🔌 WebSocket Endpoint: ws://localhost:${APIConfig.PORT}`);
  console.log(`🔐 Authentication: Authorization header REQUIRED`);
  console.log(`   - Format: Authorization: Bearer YOUR_TOKEN`);
  console.log(`   - Format: Authorization: YOUR_TOKEN`);
  console.log(`🏥 Health Check: http://localhost:${APIConfig.PORT}/health`);
  console.log(`⏰ Cache Refresh Interval: ${APIConfig.REFRESH_INTERVAL / 1000}s`);
  console.log(`📊 Last Updated: ${getUpdateTime() || 'Never'}`);
  console.log(`📊 Next Update: ${getNextUpdateTime()}`);
});
