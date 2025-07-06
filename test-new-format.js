// Test the new timestamp-based status messages
const WebSocket = require('ws');

const authToken = 'THIS_IS_A_SECRET_TOKEN';
const url = `ws://localhost:8080`;

console.log('🧪 Testing new timestamp-based status messages...');
console.log(`📍 URL: ${url}`);

const ws = new WebSocket(url, {
  headers: {
    'Authorization': `Bearer ${authToken}`,
    'User-Agent': 'Timestamp-Test-Client'
  }
});

ws.on('open', () => {
    console.log('✅ Connected to server');
});

ws.on('message', (data) => {
    try {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'connection:established') {
            console.log('\n🎉 Connection Established Message:');
            console.log('   📧 Type:', message.type);
            console.log('   🕐 Server Time:', message.serverTime);
            console.log('   📅 Last Updated:', message.lastUpdated);
            console.log('   ⏭️  Next Update:', message.nextUpdate);
            console.log('   🔐 Auth Method:', message.authMethod);
        } else if (message.type === 'status') {
            console.log('\n📊 Status Message:');
            console.log('   📧 Type:', message.type);
            console.log('   📅 Last Updated:', message.lastUpdated);
            console.log('   ⏭️  Next Update:', message.nextUpdate);
            console.log('   🔄 Is Loading:', message.isLoading);
            
            // Calculate if data is outdated
            if (message.nextUpdate) {
                const nextUpdate = new Date(message.nextUpdate);
                const now = new Date();
                const isOutdated = now > nextUpdate;
                console.log('   ⚠️  Data Outdated:', isOutdated);
                if (isOutdated) {
                    const overdueMs = now.getTime() - nextUpdate.getTime();
                    console.log('   ⏰ Overdue by:', Math.round(overdueMs / 1000), 'seconds');
                }
            }
        } else if (message.type === 'coins:update') {
            console.log('\n💰 Coins Update Message:');
            console.log('   📧 Type:', message.type);
            console.log('   📊 Data Count:', message.data?.length || 0);
            console.log('   📅 Last Updated:', message.lastUpdated);
            console.log('   ⏭️  Next Update:', message.nextUpdate);
        } else if (message.type === 'watchlist:update') {
            console.log('\n📋 Watchlist Update Message:');
            console.log('   📧 Type:', message.type);
            console.log('   🏷️  Variant:', message.variant);
            console.log('   📊 Data Count:', message.data?.length || 0);
            console.log('   📅 Last Updated:', message.lastUpdated);
            console.log('   ⏭️  Next Update:', message.nextUpdate);
        }
    } catch (err) {
        console.error('❌ Failed to parse message:', err);
    }
});

ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
});

ws.on('close', (code, reason) => {
    console.log(`🔌 Connection closed: ${code} ${reason || '(no reason)'}`);
    process.exit(0);
});

// Auto-close after 8 seconds
setTimeout(() => {
    console.log('\n⏰ Test complete - closing connection');
    ws.close();
}, 8000);
