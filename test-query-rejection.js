// Test that query parameter authentication is rejected
const WebSocket = require('ws');

const authToken = 'THIS_IS_A_SECRET_TOKEN';
const urlWithQuery = `ws://localhost:8080?token=${authToken}`;

console.log('🧪 Testing WebSocket connection with query parameter (should FAIL)...');
console.log(`📍 URL: ${urlWithQuery}`);

// Create WebSocket with query parameter (no headers)
const ws = new WebSocket(urlWithQuery);

ws.on('open', () => {
    console.log('❌ ERROR: Connection succeeded when it should have failed!');
});

ws.on('error', (err) => {
    if (err.message.includes('401') || err.message.includes('Unauthorized')) {
        console.log('✅ CORRECT: Connection rejected (401 Unauthorized)');
    } else {
        console.log('✅ CORRECT: Connection failed as expected');
        console.log('   Error:', err.message);
    }
});

ws.on('close', (code, reason) => {
    if (code === 1002 || code === 1006) {
        console.log('✅ CORRECT: Connection closed with security-related code:', code);
    } else {
        console.log(`🔌 Connection closed: ${code} ${reason || '(no reason)'}`);
    }
    process.exit(0);
});

// Auto-close after 5 seconds if somehow it connects
setTimeout(() => {
    console.log('⏰ Test timeout');
    ws.close();
}, 5000);
