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

// Test cases covering various scenarios
const testCases: TestCase[] = [
  {
    name: "Valid Search Request",
    message: {
      type: "search:request",
      query: "bitcoin",
      requestID: "test_valid_001",
      maxResults: 10
    },
    expectedStatus: 'SUCCESS',
    description: "Should return successful search results"
  },
  {
    name: "Invalid JSON",
    message: '{"type":"search:request","query":"btc","requestID":"test_invalid_json_002"', // Malformed JSON
    expectedStatus: 'ERROR',
    expectedErrorCode: 1002,
    description: "Should handle malformed JSON with original message echo"
  },
  {
    name: "Missing Type Field",
    message: {
      query: "ethereum",
      requestID: "test_missing_type_003",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1003,
    description: "Should reject message without type field"
  },
  {
    name: "Invalid Type Field",
    message: {
      type: "invalid:request",
      query: "litecoin",
      requestID: "test_invalid_type_004",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1003,
    description: "Should reject message with invalid type"
  },
  {
    name: "Empty Query",
    message: {
      type: "search:request",
      query: "",
      requestID: "test_empty_query_005",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1005,
    description: "Should reject empty query string"
  },
  {
    name: "Missing Query",
    message: {
      type: "search:request",
      requestID: "test_missing_query_006",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1005,
    description: "Should reject message without query field"
  },
  {
    name: "Invalid RequestID",
    message: {
      type: "search:request",
      query: "dogecoin",
      requestID: "",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1006,
    description: "Should reject empty requestID"
  },
  {
    name: "Missing RequestID",
    message: {
      type: "search:request",
      query: "cardano",
      maxResults: 5
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1006,
    description: "Should reject message without requestID"
  },
  {
    name: "Invalid MaxResults - Zero",
    message: {
      type: "search:request",
      query: "polkadot",
      requestID: "test_max_zero_009",
      maxResults: 0
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1007,
    description: "Should reject maxResults of 0"
  },
  {
    name: "Invalid MaxResults - Too High",
    message: {
      type: "search:request",
      query: "chainlink",
      requestID: "test_max_high_010",
      maxResults: 150
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1007,
    description: "Should reject maxResults over 100"
  },
  {
    name: "Invalid MaxResults - String",
    message: {
      type: "search:request",
      query: "solana",
      requestID: "test_max_string_011",
      maxResults: "25"
    },
    expectedStatus: 'ERROR',
    expectedErrorCode: 1007,
    description: "Should reject non-numeric maxResults"
  },
  {
    name: "Search Non-existent Coin",
    message: {
      type: "search:request",
      query: "nonexistentcoin12345",
      requestID: "test_nonexistent_012",
      maxResults: 5
    },
    expectedStatus: 'SUCCESS',
    description: "Should return empty results or fallback to CoinGecko API"
  }
];

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
  if (testIndex >= testCases.length) {
    console.log("\n🎉 All tests completed!");
    console.log("\n📊 TEST SUMMARY:");
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    testResults.forEach(result => {
      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${result.name}: ${result.details}`);
    });
    
    ws.close();
    return;
  }

  const testCase = testCases[testIndex];
  console.log(`\n🧪 Running Test ${testIndex + 1}/${testCases.length}: ${testCase.name}`);
  
  // Send test message
  if (typeof testCase.message === 'string') {
    // Send malformed JSON as string
    ws.send(testCase.message);
  } else {
    ws.send(JSON.stringify(testCase.message));
  }
  
  testIndex++;
}

const ws = new WebSocket(wsUrl, wsOptions);

ws.onopen = () => {
  console.log("🚀 WebSocket connection opened with secure header authentication");
  console.log("🔧 Starting comprehensive server tests...\n");
  
  // Start tests after a short delay to receive initial status messages
  setTimeout(() => {
    runNextTest(ws);
  }, 1000);
};

ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data.toString());
    
    // Skip initial status and cache messages
    if (message.type === "status" || message.type === "coins:update") {
      console.log(`📡 Initial server message: ${message.type}`);
      return;
    }
    
    // Process test responses
    if (testIndex > 0 && testIndex <= testCases.length) {
      const currentTestCase = testCases[testIndex - 1];
      
      let passed = false;
      let details = "";
      
      if (currentTestCase.expectedStatus === 'SUCCESS') {
        passed = message.status === 'SUCCESS' || (message.variant === 'search:result');
        details = passed ? "Successful response received" : `Expected SUCCESS, got ${message.status}`;
      } else if (currentTestCase.expectedStatus === 'ERROR') {
        passed = message.status === 'ERROR';
        if (passed && currentTestCase.expectedErrorCode) {
          passed = message.code === currentTestCase.expectedErrorCode;
          details = passed ? 
            `Correct error code ${message.code}` : 
            `Expected error code ${currentTestCase.expectedErrorCode}, got ${message.code}`;
        } else {
          details = passed ? "Error response received" : `Expected ERROR, got ${message.status}`;
        }
      }
      
      testResults.push({
        name: currentTestCase.name,
        passed,
        details
      });
      
      logTestResult(currentTestCase, message, passed);
      
      // Continue to next test after a short delay
      setTimeout(() => {
        runNextTest(ws);
      }, 500);
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
  console.log("🔌 Connection closed");
  process.exit(0);
};
