import http from "http";
import { WebSocketServer } from "ws";

import { APIConfig } from "./utils/APIConfig";
import {
  loadCache,
  getCoinCache,
  getUpdateTime,
  getNextUpdateTime,
  fetchCoinsData,
  broadcastStatus,
  sendInitialDataToClient,
} from "./cacheManager";

import { searchCoins, fetchFromCoinGeckoAPI } from "./search";

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
const server = http.createServer(async (req, res) => {
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
  
  // Handle REST /search endpoint
  if (req.method === 'GET' && req.url && req.url.startsWith('/search')) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const queryParam = parsedUrl.searchParams.get('query');
    const maxResults = parseInt(parsedUrl.searchParams.get('maxResults') || '25') || 25;
    if (!queryParam || typeof queryParam !== 'string' || queryParam.trim() === '') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing or invalid query parameter' }));
      return;
    }
    let results = searchCoins(queryParam, getCoinCache(), maxResults);
    if (results.length === 0) {
      try {
        const cgResults = await fetchFromCoinGeckoAPI(queryParam);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'SUCCESS', data: cgResults || [] }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to fetch results from CoinGecko API' }));
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'SUCCESS', data: results }));
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
          <p><strong>Search API:</strong> <a href="/search?query=bitcoin&maxResults=5">/search?query=bitcoin&maxResults=5</a></p>
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
  res.end(JSON.stringify({ error: 'Not Found', message: 'Use WebSocket for real-time data or /search for search queries' }));
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
    data: {
      message: "WebSocket connection established",
      serverTime: new Date().toISOString(),
      lastUpdated: getUpdateTime(),
      nextUpdate: getNextUpdateTime(),
      authMethod: clientInfo.authMethod
    }
  }));

  // Handle incoming messages from client
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      // Handle subscribe message
      if (data.action === "subscribe") {
        console.log("📡 Client subscribed, sending initial data");
        sendInitialDataToClient(ws);
      }
      
    } catch (error) {
      console.error("❌ Failed to parse client message:", error);
      // Send error response for invalid JSON
      ws.send(JSON.stringify({
        event: "error",
        data: {
          code: 1002,
          message: "Invalid JSON format",
          timestamp: new Date().toISOString(),
          severity: "medium"
        }
      }));
    }
  });

  // Handle client disconnection
  ws.on("close", (code, reason) => {
    console.log(`🔌 Client disconnected: ${code} ${reason || '(no reason)'}`);
    console.log(`📊 Active connections: ${wss.clients.size}`);
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
