# Frontend Message Correlation Examples

## Search is now performed via REST API

### Example: REST /search usage

```js
fetch('http://localhost:8080/search?query=bitcoin&maxResults=10')
  .then(res => res.json())
  .then(data => console.log(data));
```

## How to Handle Message Correlation with Original Message Echo

### 1. **Simple Timestamp + Random ID Approach**

```typescript
class SearchClient {
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    originalMessage: string;
    timestamp: number;
  }>();

  async searchCoins(query: string, maxResults = 25): Promise<any> {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const requestID = `${timestamp}_${randomId}`;

    const message = {
      event: "search_request",
      query,
      requestID,
      maxResults,
      clientTimestamp: timestamp // Add your own timestamp
    };

    const messageStr = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestID, {
        resolve,
        reject,
        originalMessage: messageStr,
        timestamp
      });

      // Send to WebSocket
      this.ws.send(messageStr);

      // Cleanup after timeout
      setTimeout(() => {
        if (this.pendingRequests.has(requestID)) {
          this.pendingRequests.delete(requestID);
          reject(new Error(`Request timeout for: ${query}`));
        }
      }, 10000);
    });
  }

  handleMessage(message: any) {
    // Handle successful responses with requestID
    if (message.status === 'SUCCESS' && message.requestID) {
      const pending = this.pendingRequests.get(message.requestID);
      if (pending) {
        pending.resolve(message.data);
        this.pendingRequests.delete(message.requestID);
      }
      return;
    }

    // Handle errors - check if we have originalMessage
    if (message.status === 'ERROR' && message.originalMessage) {
      // Parse the original message to extract our identifiers
      try {
        const original = JSON.parse(message.originalMessage);
        const requestID = original.requestID;
        
        if (requestID && this.pendingRequests.has(requestID)) {
          const pending = this.pendingRequests.get(requestID);
          pending.reject(new Error(message.message));
          this.pendingRequests.delete(requestID);
          return;
        }
      } catch (e) {
        // If we can't parse the original, try to match by content/timing
        this.handleOrphanedError(message);
      }
    }
  }

  private handleOrphanedError(errorMessage: any) {
    // Find recent requests that might match this error
    const recentRequests = Array.from(this.pendingRequests.entries())
      .filter(([_, req]) => Date.now() - req.timestamp < 5000) // Last 5 seconds
      .sort(([_, a], [__, b]) => b.timestamp - a.timestamp); // Most recent first

    if (recentRequests.length > 0) {
      const [requestID, pending] = recentRequests[0];
      console.warn(`Correlating orphaned error with most recent request: ${requestID}`);
      pending.reject(new Error(errorMessage.message));
      this.pendingRequests.delete(requestID);
    }
  }
}
```

### 2. **Content-Based Correlation Approach**

```typescript
class AdvancedSearchClient {
  private pendingRequests = new Map<string, any>();

  async searchCoins(query: string): Promise<any> {
    const requestID = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
      event: "search_request",
      query,
      requestID,
      // Add content hash for correlation
      contentHash: this.hashContent(query),
      clientId: this.clientId, // Unique client identifier
      maxResults: 25
    };

    const messageStr = JSON.stringify(message);
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestID, {
        resolve, reject, query, messageStr,
        timestamp: Date.now()
      });

      this.ws.send(messageStr);
    });
  }

  handleError(errorMessage: any) {
    if (errorMessage.originalMessage) {
      // Try multiple correlation strategies
      
      // 1. Direct requestID match
      const directMatch = this.tryDirectMatch(errorMessage.originalMessage);
      if (directMatch) return directMatch;

      // 2. Content-based matching
      const contentMatch = this.tryContentMatch(errorMessage.originalMessage);
      if (contentMatch) return contentMatch;

      // 3. Timing-based matching (fallback)
      const timingMatch = this.tryTimingMatch();
      if (timingMatch) return timingMatch;
    }

    console.warn('Could not correlate error message:', errorMessage);
  }

  private tryDirectMatch(originalMessage: string) {
    try {
      const parsed = JSON.parse(originalMessage);
      if (parsed.requestID && this.pendingRequests.has(parsed.requestID)) {
        const pending = this.pendingRequests.get(parsed.requestID);
        pending.reject(new Error('Request failed'));
        this.pendingRequests.delete(parsed.requestID);
        return true;
      }
    } catch (e) {}
    return false;
  }

  private tryContentMatch(originalMessage: string) {
    try {
      const parsed = JSON.parse(originalMessage);
      
      // Find by query content
      for (const [requestID, pending] of this.pendingRequests) {
        if (pending.query === parsed.query) {
          pending.reject(new Error('Request failed'));
          this.pendingRequests.delete(requestID);
          return true;
        }
      }
    } catch (e) {}
    return false;
  }

  private tryTimingMatch() {
    // Match with most recent request
    const recentEntries = Array.from(this.pendingRequests.entries())
      .filter(([_, req]) => Date.now() - req.timestamp < 3000)
      .sort(([_, a], [__, b]) => b.timestamp - a.timestamp);

    if (recentEntries.length > 0) {
      const [requestID, pending] = recentEntries[0];
      pending.reject(new Error('Request failed'));
      this.pendingRequests.delete(requestID);
      return true;
    }
    return false;
  }

  private hashContent(content: string): string {
    // Simple hash function for content correlation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
  }
}
```

### 3. **React Hook Example**

```typescript
function useSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const pendingRef = useRef(new Map());

  const search = useCallback(async (query: string) => {
    const requestID = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    setLoading(true);
    setError(null);

    const message = {
      event: "search_request",
      query,
      requestID,
      maxResults: 25,
      userAgent: navigator.userAgent, // Additional correlation data
      timestamp: Date.now()
    };

    const messageStr = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      pendingRef.current.set(requestID, {
        resolve: (data) => {
          setResults(data);
          setLoading(false);
          resolve(data);
        },
        reject: (err) => {
          setError(err.message);
          setLoading(false);
          reject(err);
        },
        originalMessage: messageStr,
        query
      });

      websocket.send(messageStr);
    });
  }, []);

  const handleMessage = useCallback((message) => {
    if (message.status === 'ERROR' && message.originalMessage) {
      // Parse original to find our request
      try {
        const original = JSON.parse(message.originalMessage);
        const pending = pendingRef.current.get(original.requestID);
        
        if (pending) {
          pending.reject(new Error(message.message));
          pendingRef.current.delete(original.requestID);
        }
      } catch (e) {
        // Handle correlation failure
        console.warn('Failed to correlate error message');
      }
    }
    // ... handle success cases
  }, []);

  return { search, results, loading, error };
}
```

## Benefits of This Approach

1. **Flexibility**: Frontend chooses correlation strategy
2. **Debugging**: Full original message available for debugging
3. **Robustness**: Multiple fallback correlation methods
4. **Performance**: Server doesn't need complex parsing logic
5. **Extensibility**: Easy to add more correlation data points

## Recommended Frontend Strategy

1. **Primary**: Use `requestID` when available
2. **Secondary**: Content-based matching (query text, etc.)
3. **Fallback**: Timing-based correlation for recent requests
4. **Logging**: Always log unmatched errors for debugging
