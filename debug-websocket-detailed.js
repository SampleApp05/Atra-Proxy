const WebSocket = require('ws');

// Test WebSocket connection to debug the watchlist issue
const wsUrl = 'ws://localhost:8080';
const token = process.env.CLIENT_AUTH_TOKEN || 'eyJrZXkiOiIzMDliZjU4ZjY2N2Q5YjBmZDRjNmE4MWZlYTI1MDE2ZTRlMDFmMWVjZDFkMGRlN2FkNGQyMzVjYjc1YTQ4OGU2IiwiaXYiOiI0ZjVjNDk4YzFkZjRhM2U2ZTFlYjA2YTM5YzExNDZkNiIsInRhZyI6IjQ0ZGE5NjEwMTBjMjgwMWM4N2UxOTRiMjE5NmE1NmJkIiwiZW5jcnlwdGVkIjoiNzJkMWM4ODJjNTQ5OTYzZmQzMjI5M2U4ZWRkMjZkYzc2ZWRlNDM1MGJiN2RmNGU2ZGQ4NzQ0In0=';

const ws = new WebSocket(wsUrl, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

let messageCount = 0;

ws.on('open', () => {
  console.log('🚀 Connected to WebSocket');
  
  // Wait a bit then send subscribe message
  setTimeout(() => {
    console.log('📡 Sending subscribe message...');
    ws.send(JSON.stringify({ action: 'subscribe' }));
  }, 100);
});

ws.on('message', (data) => {
  messageCount++;
  try {
    const message = JSON.parse(data.toString());
    console.log(`📨 Message ${messageCount}: ${message.event}`);
    
    if (message.event === 'watchlist_update') {
      console.log(`   📋 Watchlist variant: ${message.data.variant}`);
      console.log(`   📊 Coin count: ${message.data.data.length}`);
      console.log(`   🪙 First few coins: ${message.data.data.slice(0, 3).join(', ')}`);
    }
  } catch (error) {
    console.error('❌ Failed to parse message:', error);
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 Connection closed: ${code} ${reason}`);
  console.log(`📊 Total messages received: ${messageCount}`);
  process.exit(0);
});

// Close connection after 10 seconds
setTimeout(() => {
  console.log('⏰ Closing connection...');
  ws.close();
}, 10000);
