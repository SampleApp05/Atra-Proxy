require('dotenv').config();
const WebSocket = require('ws');

console.log('🔐 Using token:', process.env.CLIENT_AUTH_TOKEN ? `${process.env.CLIENT_AUTH_TOKEN.substring(0, 10)}...` : 'NOT FOUND');

// Test WebSocket connection to check message format
const ws = new WebSocket('ws://localhost:8080', {
  headers: {
    'Authorization': process.env.CLIENT_AUTH_TOKEN
  }
});

ws.on('open', function open() {
  console.log('🚀 Connected to WebSocket server');
});

ws.on('message', function message(data) {
  try {
    const parsed = JSON.parse(data.toString());
    console.log('\n📨 Received message:');
    console.log('Event:', parsed.event);
    console.log('Has data field:', 'data' in parsed);
    console.log('Data type:', typeof parsed.data);
    if (parsed.data) {
      console.log('Data keys:', Object.keys(parsed.data));
    }
    console.log('Full message:', JSON.stringify(parsed, null, 2));
  } catch (error) {
    console.log('❌ Failed to parse message:', data.toString());
  }
});

ws.on('error', function error(err) {
  console.log('❌ WebSocket error:', err.message);
});

ws.on('close', function close(code, reason) {
  console.log('🔌 Connection closed:', code, reason?.toString());
});

// Close after 10 seconds
setTimeout(() => {
  ws.close();
}, 10000);
