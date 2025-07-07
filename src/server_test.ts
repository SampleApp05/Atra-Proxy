import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

interface TestCase {
  name: string;
  message: any;
  expectedStatus: 'SUCCESS' | 'ERROR';
  expectedErrorCode?: number;
  description: string;
}

interface RestTestCase {
  name: string;
  url: string;
  expectedStatus: number;
  description: string;
  shouldHaveData?: boolean;
}

const key = (process.env.CLIENT_AUTH_TOKEN as string) || "random-key";
let testIndex = 0;
const testResults: Array<{name: string, passed: boolean, details: string}> = [];

// Test with Authorization header only (secure authentication)
const useHeaderAuth = true; // Header-only authentication for security

console.log(`🔐 Testing with Authorization header authentication (secure mode)`);

const wsOptions = {
  headers: {
    'Authorization': `Bearer ${key}`,
    'User-Agent': 'Atra-Proxy-Server-Test'
  }
};

const wsUrl = "ws://localhost:8080";

// WebSocket protocol test cases (connection only, no message handling)
const testCases: TestCase[] = [
  // No message tests since WebSocket no longer handles search messages
  // Only connection protocol is tested
];

// REST API test cases
const restTestCases: RestTestCase[] = [
  {
    name: "Valid Search - Bitcoin",
    url: "/search?query=bitcoin&maxResults=5",
    expectedStatus: 200,
    description: "Should return bitcoin search results",
    shouldHaveData: true
  },
  {
    name: "Valid Search - ETH",
    url: "/search?query=eth&maxResults=10",
    expectedStatus: 200,
    description: "Should return ethereum search results",
    shouldHaveData: true
  },
  {
    name: "Missing Query Parameter",
    url: "/search?maxResults=5",
    expectedStatus: 400,
    description: "Should return 400 for missing query parameter"
  },
  {
    name: "Empty Query Parameter",
    url: "/search?query=&maxResults=5",
    expectedStatus: 400,
    description: "Should return 400 for empty query parameter"
  },
  {
    name: "Valid Search - Obscure Coin",
    url: "/search?query=veryveryobscurecoin12345&maxResults=5",
    expectedStatus: 200,
    description: "Should handle obscure coin searches (may return empty results)",
    shouldHaveData: false
  },
  {
    name: "Health Check",
    url: "/health",
    expectedStatus: 200,
    description: "Should return health status"
  }
];

// Track initial messages for connection protocol test
let initialMessages: string[] = [];
let restTestIndex = 0;
const baseUrl = "http://localhost:8080";

async function runRestTests() {
  console.log("\n🌐 Starting REST API tests...\n");
  
  for (let i = 0; i < restTestCases.length; i++) {
    const testCase = restTestCases[i];
    console.log(`\n🧪 Running REST Test ${i + 1}/${restTestCases.length}: ${testCase.name}`);
    
    try {
      const response = await fetch(`${baseUrl}${testCase.url}`);
      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { text: responseText };
      }
      
      const passed = response.status === testCase.expectedStatus;
      let details = `HTTP ${response.status}`;
      
      if (testCase.shouldHaveData !== undefined) {
        const hasData = responseData.data && Array.isArray(responseData.data) && responseData.data.length > 0;
        if (testCase.shouldHaveData && !hasData) {
          details += " (no data returned)";
        } else if (!testCase.shouldHaveData && hasData) {
          details += " (unexpected data returned)";
        } else {
          details += testCase.shouldHaveData ? ` (${responseData.data?.length || 0} results)` : " (empty results as expected)";
        }
      }
      
      testResults.push({
        name: `REST: ${testCase.name}`,
        passed,
        details
      });
      
      const status = passed ? "✅ PASS" : "❌ FAIL";
      console.log(`${status} - ${testCase.name}`);
      console.log(`📝 Description: ${testCase.description}`);
      console.log(`🎯 Expected Status: ${testCase.expectedStatus}`);
      console.log(`📊 Actual Status: ${response.status}`);
      
      if (responseData.data) {
        console.log(`📊 Results Count: ${responseData.data.length}`);
        if (responseData.data.length > 0) {
          console.log(`🥇 First Result: ${responseData.data[0].name || responseData.data[0].id || 'Unknown'}`);
        }
      }
      
      if (!passed) {
        console.log(`💥 Failure Details: Expected ${testCase.expectedStatus}, got ${response.status}`);
      }
      
      console.log("─".repeat(50));
      
    } catch (error) {
      console.error(`❌ REST Test Failed: ${testCase.name}`, error);
      testResults.push({
        name: `REST: ${testCase.name}`,
        passed: false,
        details: `Network error: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
  
  // Final summary
  console.log("\n🎉 All tests completed!");
  console.log("\n📊 COMPREHENSIVE TEST SUMMARY:");
  const passed = testResults.filter(r => r.passed).length;
  const total = testResults.length;
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  
  console.log("\n📋 Detailed Results:");
  testResults.forEach(result => {
    const status = result.passed ? "✅" : "❌";
    console.log(`${status} ${result.name}: ${result.details}`);
  });
  
  process.exit(0);
}

function logTestResult(testCase: TestCase, actual: any, passed: boolean) {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${status} - ${testCase.name}`);
  console.log(`📝 Description: ${testCase.description}`);
  console.log(`🎯 Expected Status: ${testCase.expectedStatus}`);
  console.log(`📊 Actual Status: ${actual.status || 'UNKNOWN'}`);
  
  if (testCase.expectedErrorCode) {
    console.log(`🔢 Expected Error Code: ${testCase.expectedErrorCode}`);
    console.log(`🔢 Actual Error Code: ${actual.code || 'N/A'}`);
  }
  
  if (actual.originalMessage) {
    console.log(`📧 Original Message Echoed: YES`);
  }
  
  if (!passed) {
    console.log(`💥 Failure Details: Expected ${testCase.expectedStatus}, got ${actual.status}`);
  }
  
  console.log("─".repeat(50));
}

function runNextTest(ws: WebSocket) {
  // Skip WebSocket message tests since search is now REST-only
  // Go directly to REST tests after connection protocol is verified
  console.log("\n🎉 WebSocket connection protocol verified!");
  console.log("🌐 Starting REST API tests...");
  ws.close();
  // Start REST tests after WebSocket tests complete
  setTimeout(() => {
    runRestTests();
  }, 1000);
}

const ws = new WebSocket(wsUrl, wsOptions);

ws.onopen = () => {
  console.log("🚀 WebSocket connection opened with secure header authentication");
  console.log("🔧 Testing WebSocket connection protocol...\n");
  // Reset initial message tracker
  initialMessages = [];
  // Wait for initial messages, then start REST tests
  setTimeout(() => {
    runNextTest(ws);
  }, 3000); // Wait for all initial WebSocket messages
};

ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data.toString());
    // Track initial protocol messages
    if (["status", "coins_update", "connection_established", "watchlist_update"].includes(message.event)) {
      console.log(`📡 Initial server message: ${message.event}`);
      initialMessages.push(message.event);
      // After receiving all expected initial messages, check protocol
      if (initialMessages.length >= 4 && !testResults.some(r => r.name === "Connection Protocol")) {
        const hasConnection = initialMessages.includes("connection_established");
        const hasStatus = initialMessages.includes("status");
        const hasCoins = initialMessages.includes("coins_update");
        const hasWatchlist = initialMessages.includes("watchlist_update");
        const passed = hasConnection && hasStatus && hasCoins && hasWatchlist;
        testResults.push({
          name: "WebSocket: Connection Protocol",
          passed,
          details: passed ? "All expected initial messages received" : `Missing: ${[!hasConnection && 'connection_established', !hasStatus && 'status', !hasCoins && 'coins_update', !hasWatchlist && 'watchlist_update'].filter(Boolean).join(', ')}`
        });
        console.log(`\n${passed ? '✅ PASS' : '❌ FAIL'} - Connection Protocol`);
        console.log(`� Description: WebSocket should send connection_established, status, coins_update, and watchlist_update on connect`);
        if (!passed) {
          console.log(`💥 Failure Details: ${testResults[testResults.length-1].details}`);
        }
        console.log("─".repeat(50));
      }
      return;
    }
    
  } catch (err) {
    console.error("❌ Failed to parse server response:", err);
    console.error("📄 Raw message:", event.data);
  }
};

ws.onerror = (err) => {
  console.error("❌ WebSocket error:", err);
};

ws.onclose = () => {
  console.log("🔌 WebSocket connection closed");
  // Don't exit here, let REST tests handle the final exit
};
