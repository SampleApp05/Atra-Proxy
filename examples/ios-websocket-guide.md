# iOS WebSocket Connection Guide - Header Authentication

## 📱 Connecting from iOS Apps with Authorization Header

### Swift WebSocket Connection Example

```swift
import Foundation

class AtraProxyWebSocket: NSObject, URLSessionWebSocketDelegate {
    private var webSocketTask: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    
    func connect() {
        let authToken = "THIS_IS_A_SECRET_TOKEN" // Replace with your actual token from .env
        let urlString = "ws://localhost:8080"
        
        guard let url = URL(string: urlString) else {
            print("❌ Invalid WebSocket URL: \(urlString)")
            return
        }
        
        print("🔌 Connecting to: \(urlString)")
        print("🔐 Using Authorization header for authentication")
        
        // Create URLRequest with Authorization header (REQUIRED for iOS)
        var request = URLRequest(url: url)
        request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
        request.setValue("AtraProxy-iOS-Client/1.0", forHTTPHeaderField: "User-Agent")
        
        urlSession = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocketTask = urlSession?.webSocketTask(with: request)
        webSocketTask?.resume()
        
        print("🔌 Connecting to Atra-Proxy WebSocket...")
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self?.handleMessage(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self?.handleMessage(text)
                    }
                @unknown default:
                    break
                }
                
                // Continue receiving messages
                self?.receiveMessage()
                
            case .failure(let error):
                print("❌ WebSocket receive error: \(error)")
                // Implement reconnection logic here if needed
            }
        }
    }
    
    private func handleMessage(_ messageText: String) {
        guard let data = messageText.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] else {
            print("❌ Failed to parse message: \(messageText)")
            return
        }
        
        let messageType = json["event"] as? String ?? "unknown"
        
        switch messageType {
        case "connection_established":
            print("✅ Connection established")
            print("📊 Server data state: \(json["dataState"] as? String ?? "unknown")")
            print("🔐 Auth method: \(json["authMethod"] as? String ?? "unknown")")
            
        case "status":
            let status = json["status"] as? String ?? "unknown"
            let lastUpdated = json["lastUpdated"] as? String ?? "never"
            print("📡 Status update: \(status) (last updated: \(lastUpdated))")
            
        case "coins_update":
            if let coinsData = json["data"] as? [[String: Any]] {
                print("💰 Received \(coinsData.count) coins")
                // Process coin data here
                processCoinData(coinsData)
            }
            
        case "search_result":
            handleSearchResult(json)
            
        case "watchlist_update":
            handleWatchlistUpdate(json)
            
        default:
            print("📩 Received message event: \(messageType)")
        }
    }
    
    private func handleSearchResult(_ json: [String: Any]) {
        let requestID = json["requestID"] as? String ?? "unknown"
        let status = json["status"] as? String ?? "unknown"
        
        if status == "SUCCESS" {
            if let results = json["data"] as? [[String: Any]] {
                print("🔍 Search results for \(requestID): \(results.count) coins found")
                
                for coin in results.prefix(3) { // Show first 3 results
                    let name = coin["name"] as? String ?? "Unknown"
                    let symbol = coin["symbol"] as? String ?? "?"
                    let price = coin["current_price"] as? Double ?? 0.0
                    print("  • \(name) (\(symbol)): $\(String(format: "%.2f", price))")
                }
            }
        } else {
            let errorMessage = json["message"] as? String ?? "Unknown error"
            print("❌ Search failed for \(requestID): \(errorMessage)")
        }
    }
    
    private func handleWatchlistUpdate(_ json: [String: Any]) {
        let variant = json["variant"] as? String ?? "unknown"
        if let data = json["data"] as? [[String: Any]] {
            print("📊 Watchlist update (\(variant)): \(data.count) coins")
        }
    }
    
    private func processCoinData(_ coins: [[String: Any]]) {
        // Process the coin data for your app
        // This is where you'd update your local data store, UI, etc.
        print("💾 Processing \(coins.count) coins...")
        
        // Example: Find top 5 by market cap
        let sortedCoins = coins
            .compactMap { coin -> (String, Double)? in
                guard let name = coin["name"] as? String,
                      let marketCap = coin["market_cap"] as? Double else { return nil }
                return (name, marketCap)
            }
            .sorted { $0.1 > $1.1 }
            .prefix(5)
        
        print("🏆 Top 5 by market cap:")
        for (index, coin) in sortedCoins.enumerated() {
            print("   \(index + 1). \(coin.0): $\(String(format: "%.0f", coin.1))")
        }
    }
    
    func sendSearchRequest(query: String, maxResults: Int = 25) {
        let requestID = "ios_search_\(UUID().uuidString.prefix(8))"
        
        let searchMessage: [String: Any] = [
            "event": "search_request",
            "query": query,
            "requestID": requestID,
            "maxResults": maxResults
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: searchMessage, options: []),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            print("❌ Failed to create search message")
            return
        }
        
        let message = URLSessionWebSocketTask.Message.string(jsonString)
        webSocketTask?.send(message) { error in
            if let error = error {
                print("❌ Failed to send search request: \(error)")
            } else {
                print("📤 Sent search request for: \(query)")
            }
        }
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .goingAway, reason: nil)
        webSocketTask = nil
        urlSession = nil
        print("🔌 Disconnected from WebSocket")
    }
    
    // MARK: - URLSessionWebSocketDelegate
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        print("✅ WebSocket connected successfully")
        print("   - Protocol: \(protocol ?? "none")")
    }
    
    func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("🔌 WebSocket disconnected with code: \(closeCode)")
        if let reason = reason, let reasonString = String(data: reason, encoding: .utf8) {
            print("📝 Disconnect reason: \(reasonString)")
        }
    }
    
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error {
            print("❌ URLSession task failed:")
            print("   - Error: \(error.localizedDescription)")
            print("   - Code: \((error as NSError).code)")
            print("   - Domain: \((error as NSError).domain)")
        }
    }
}
```

### Usage Example

```swift
class CryptoViewController: UIViewController {
    private let webSocket = AtraProxyWebSocket()
    private var coinData: [[String: Any]] = []
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Connect to WebSocket
        webSocket.connect()
    }
    
    deinit {
        webSocket.disconnect()
    }
}
```

## 🔧 Connection Configuration

### Required: Authorization Header
```swift
var request = URLRequest(url: URL(string: "ws://localhost:8080")!)
request.setValue("Bearer THIS_IS_A_SECRET_TOKEN", forHTTPHeaderField: "Authorization")

// Alternative format (without "Bearer"):
request.setValue("THIS_IS_A_SECRET_TOKEN", forHTTPHeaderField: "Authorization")
```

### Connection URLs

#### Local Development
```
ws://localhost:8080
```

#### Physical Device (replace with your Mac's IP)
```
ws://192.168.1.100:8080
```

#### Production (with SSL)
```
wss://your-domain.com
```

## 📡 Enhanced Message Types

### 1. Connection Established
```json
{
  "event": "connection_established",
  "message": "WebSocket connection established",
  "serverTime": "2024-01-01T00:00:00Z",
  "dataState": "OK",
  "authMethod": "Header"
}
```

### 2. Status Updates
```json
{
  "event": "status",
  "status": "OK",
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

### 3. Coin Data Updates
```json
{
  "event": "coins_update",
  "data": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "current_price": 45000.50,
      "market_cap": 850000000000,
      "market_cap_rank": 1,
      "price_change_percentage_24h": 2.5
    }
  ],
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

### 4. Search Results
```json
{
  "status": "SUCCESS",
  "variant": "search_result",
  "requestID": "ios_search_12345",
  "data": [...] // Array of matching coins
}
```

### 5. Watchlist Updates
```json
{
  "event": "watchlist_update",
  "variant": "top_gainers",
  "data": [...], // Array of top gaining coins
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

## 🛡️ Security & Best Practices

### Authentication
- ✅ Use Authorization header (secure)
- ❌ Avoid query parameters for tokens (less secure)
- 🔐 Store tokens securely (Keychain, not UserDefaults)

### Error Handling
```swift
func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    if let error = error {
        let nsError = error as NSError
        
        switch nsError.code {
        case -1011: // Bad server response
            print("❌ Authentication failed or server error")
        case -1001: // Timeout
            print("❌ Connection timeout")
        default:
            print("❌ Connection error: \(error.localizedDescription)")
        }
        
        // Implement reconnection logic
        DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
            self.reconnect()
        }
    }
}
```

### Production Considerations
- Use WSS (secure WebSocket) in production
- Implement automatic reconnection
- Handle app state changes (background/foreground)
- Add connection health monitoring
- Validate all incoming data

## 📱 Testing Your Implementation

1. **Start Atra-Proxy server**: `npm start`
2. **Check server logs** for connection details
3. **Test with curl**:
   ```bash
   curl -H "Authorization: Bearer THIS_IS_A_SECRET_TOKEN" http://localhost:8080/health
   ```
4. **Connect from iOS app** and check logs for:
   - ✅ Connection established message
   - 🔐 Auth method confirmation
   - 📊 Data state information

## 🔍 Troubleshooting

### Common Issues:
1. **Wrong token**: Ensure it matches your `.env` file exactly
2. **Missing header**: Use `URLRequest` with `setValue` for Authorization
3. **Network issues**: Use your Mac's IP for physical devices
4. **SSL in production**: Use `wss://` not `ws://`

Your iOS app should now connect securely using the Authorization header! 🎉

# iOS WebSocket Guide

> Note: Search is now performed via REST API, not WebSocket.

## Example: REST /search usage in Swift

```swift
let url = URL(string: "http://localhost:8080/search?query=bitcoin&maxResults=10")!
let task = URLSession.shared.dataTask(with: url) { data, response, error in
    if let data = data {
        print(String(data: data, encoding: .utf8) ?? "")
    }
}
task.resume()
```
