#!/bin/bash

# Test runner script for Atra-Proxy
echo "🚀 Starting Atra-Proxy Test Suite"
echo "=================================="

# Check if server is running
if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
    echo "❌ Server is not running on localhost:8080"
    echo "💡 Please start the server first: npm start or tsx src/server.ts"
    exit 1
fi

echo "✅ Server detected on localhost:8080"
echo ""

# Run server validation tests
echo "🔧 Running Server Validation Tests..."
echo "------------------------------------"
tsx src/server_test.ts

echo ""
echo "⏳ Waiting 3 seconds before search tests..."
sleep 3

# Run search functionality tests  
echo "🔍 Running Search Functionality Tests..."
echo "---------------------------------------"
tsx src/search_test.ts

echo ""
echo "🎉 Test suite completed!"
