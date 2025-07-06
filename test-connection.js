// WebSocket test client for header-based authentication
const WebSocket = require('ws');

const authToken = 'THIS_IS_A_SECRET_TOKEN';
const url = `ws://localhost:8080`;

console.log('🧪 Testing WebSocket connection with Authorization header...');
console.log(`📍 URL: ${url}`);
console.log(`🔐 Auth: Bearer ${authToken.substring(0, 8)}...`);

// Create WebSocket with Authorization header
const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'User-Agent': 'Atra-Proxy-Test-Client'
  }
});

ws.on('open', () => {
    console.log('✅ Connected to Atra-Proxy server');
    
    // Test a search request
    setTimeout(() => {
        const searchRequest = {
            type: "search:request",
            query: "bitcoin",
            requestID: "test_debug_001",
            maxResults: 5
        };
        
        console.log('📤 Sending test search request:', searchRequest.query);
        ws.send(JSON.stringify(searchRequest));
    }, 2000);
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📩 Received message type:', message.type || 'unknown');
        
        if (message.type === 'connection:established') {
            console.log('   ✅ Connection established');
            console.log('   📊 Data state:', message.dataState);
            console.log('   🔐 Auth method:', message.authMethod);
        } else if (message.type === 'status') {
            console.log('   📡 Status:', message.status);
        } else if (message.type === 'coins:update') {
            console.log('   💰 Coin data received:', message.data?.length || 0, 'coins');
        } else if (message.variant === 'search:result') {
            console.log('   🔍 Search results:', message.data?.length || 0, 'results');
            if (message.data && message.data.length > 0) {
                console.log('   🥇 First result:', message.data[0].name, `($${message.data[0].current_price})`);
            }
        }
    } catch (err) {
        console.error('❌ Failed to parse message:', err);
        console.log('📄 Raw message:', data.toString());
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${code} ${reason || '(no reason)'}`);
    process.exit(0);
});

// Auto-close after 10 seconds
setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
}, 10000);
