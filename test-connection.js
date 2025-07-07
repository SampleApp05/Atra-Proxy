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
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        console.log('📩 Received message event:', message.event || 'unknown');
        
        if (message.event === 'connection_established') {
            console.log('   ✅ Connection established');
            console.log('   � Last updated:', message.lastUpdated);
            console.log('   ⏭️  Next update:', message.nextUpdate);
            console.log('   🔐 Auth method:', message.authMethod);
        } else if (message.event === 'status') {
            console.log('   📡 Status - Loading:', message.isLoading);
            console.log('   📅 Last updated:', message.lastUpdated);
        } else if (message.event === 'coins_update') {
            console.log('   💰 Coin data received:', message.data?.length || 0, 'coins');
        } else if (message.event === 'watchlist_update') {
            console.log('   📋 Watchlist update:', message.variant);
        } else if (message.event === 'search_result') {
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

// WebSocket search request logic removed. Use REST /search endpoint for search functionality.
