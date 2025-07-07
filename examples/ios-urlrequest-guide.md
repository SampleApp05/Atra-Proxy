# iOS WebSocket with URLRequest and Authorization Header

## Quick Start

```swift
import Foundation

class AtraProxyClient {
    private var webSocketTask: URLSessionWebSocketTask?
    private let urlSession = URLSession(configuration: .default)
    
    func connect() {
        // Create URLRequest with Authorization header (REQUIRED)
        var request = URLRequest(url: URL(string: "ws://localhost:8080")!)
        request.setValue("Bearer YOUR_TOKEN", forHTTPHeaderField: "Authorization")
        // Alternative format: request.setValue("YOUR_TOKEN", forHTTPHeaderField: "Authorization")
        
        // Create WebSocket task with URLRequest
        webSocketTask = urlSession.webSocketTask(with: request)
        webSocketTask?.resume()
        
        // Start receiving messages
        receiveMessage()
    }
    
    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    print("📩 Received: \(text)")
                    if let data = text.data(using: .utf8),
                       let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let event = json["event"] as? String {
                        print("📩 Message event: \(event)")
                        
                        if event == "connection_established" {
                            print("✅ Connected successfully!")
                            if let authMethod = json["authMethod"] as? String {
                                print("🔐 Auth method: \(authMethod)")
                            }
                        }
                    }
                case .data(let data):
                    print("📩 Received binary data: \(data.count) bytes")
                @unknown default:
                    print("❓ Unknown message type")
                }
                
                // Continue receiving
                self?.receiveMessage()
                
            case .failure(let error):
                print("❌ WebSocket error: \(error)")
            }
        }
    }
    
    func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
    }
}
```

## Usage Example

```swift
let client = AtraProxyClient()
client.connect()

// Wait a moment for connection, then disconnect
DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
    client.disconnect()
}
```

## Server Response Examples

### Connection Established
```json
{
  "event": "connection_established",
  "message": "WebSocket connection established",
  "serverTime": "2025-07-06T13:14:55.123Z",
  "dataState": "ok",
  "authMethod": "Header"
}
```

## Authentication

⚠️ **Authorization header is REQUIRED** - The server only accepts header-based authentication for security.

**Supported formats:**

1. **Bearer Token (Recommended):**
   ```swift
   request.setValue("Bearer YOUR_TOKEN", forHTTPHeaderField: "Authorization")
   ```

2. **Raw Token:**
   ```swift
   request.setValue("YOUR_TOKEN", forHTTPHeaderField: "Authorization")
   ```

**Security Note:** Query parameter authentication has been removed for security reasons. Headers are more secure as they don't appear in logs or browser history.

## Error Handling

```swift
webSocketTask?.receive { result in
    switch result {
    case .success(let message):
        // Handle message
    case .failure(let error):
        if let wsError = error as? URLError {
            switch wsError.code {
            case .notConnectedToInternet:
                print("❌ No internet connection")
            case .cannotConnectToHost:
                print("❌ Cannot connect to server")
            case .timedOut:
                print("❌ Connection timed out")
            default:
                print("❌ WebSocket error: \(wsError.localizedDescription)")
            }
        }
    }
}
```

## Notes

- The server validates the Authorization header during the WebSocket handshake
- Connection details are logged on the server side for debugging
- The server sends immediate feedback about the authentication method used
- Both Bearer and raw token formats are supported for flexibility

# iOS URLRequest Guide

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
