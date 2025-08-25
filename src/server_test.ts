import WebSocket from "ws";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
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

interface EventValidator {
  name: string;
  event: string;
  validator: (data: any) => { valid: boolean; details: string };
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
const testCases: TestCase[] = [];

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

// Validators for each message type
const eventValidators: EventValidator[] = [
  {
    name: "Connection Established",
    event: "connection_established",
    validator: (data) => {
      const valid = typeof data.message === 'string' && 
                    typeof data.serverTime === 'string' &&
                    (data.lastUpdated === null || typeof data.lastUpdated === 'string') && 
                    typeof data.nextUpdate === 'string' && 
                    typeof data.authMethod === 'string';
      return { 
        valid, 
        details: valid ? "Valid connection_established format" : 
          "Invalid format: missing required fields (message, serverTime, nextUpdate, authMethod)"
      };
    }
  },
  {
    name: "Status Update",
    event: "status",
    validator: (data) => {
      const valid = (data.lastUpdated === null || typeof data.lastUpdated === 'string') && 
                    typeof data.nextUpdate === 'string' && 
                    typeof data.isLoading === 'boolean';
      return { 
        valid, 
        details: valid ? "Valid status format" : 
          "Invalid format: missing required fields (lastUpdated, nextUpdate, isLoading)"
      };
    }
  },
  {
    name: "Cache Update",
    event: "cache_update",
    validator: (data) => {
      const valid = (data.lastUpdated === null || typeof data.lastUpdated === 'string') && 
                    typeof data.nextUpdate === 'string' && 
                    Array.isArray(data.data);
      
      const coinValid = data.data.length === 0 || 
                       (data.data[0].id && 
                        typeof data.data[0].name === 'string' && 
                        typeof data.data[0].current_price === 'number');
      
      return { 
        valid: valid && coinValid, 
        details: valid ? (coinValid ? "Valid cache_update format" : "Invalid coin data format") : 
          "Invalid format: missing required fields (lastUpdated, nextUpdate, data[])"
      };
    }
  },
  {
    name: "Watchlist Update",
    event: "watchlist_update",
    validator: (data) => {
      // Check if id is a valid UUID
      const isValidUUID = (id: string): boolean => {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
      };
      
      const valid = isValidUUID(data.id) && 
                    typeof data.name === 'string' && 
                    Array.isArray(data.coins);
      
      // Check if coins array contains strings
      const coinsValid = data.coins.length === 0 || 
                        typeof data.coins[0] === 'string';
      
      return { 
        valid: valid && coinsValid, 
        details: valid ? (coinsValid ? "Valid watchlist_update format" : "Invalid coins array format") : 
          `Invalid format: missing or malformed required fields (id: ${data.id}, name, coins[])`
      };
    }
  }
];

// Track initial messages for connection protocol test
const receivedMessages: Map<string, any> = new Map();
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

function validateEventData() {
  console.log("\n🔍 Validating WebSocket events data structure...\n");
  
  // Check if we received all expected event types
  const expectedEvents = ["connection_established", "status", "cache_update", "watchlist_update"];
  const receivedEvents = Array.from(receivedMessages.keys());
  
  // Check that all required events were received
  const missingEvents = expectedEvents.filter(e => !receivedEvents.includes(e));
  const extraEvents = receivedEvents.filter(e => !expectedEvents.includes(e));
  
  const allEventsReceived = missingEvents.length === 0;
  
  testResults.push({
    name: "WebSocket: Required Events",
    passed: allEventsReceived,
    details: allEventsReceived ? 
      `All required events received (${expectedEvents.join(", ")})` : 
      `Missing events: ${missingEvents.join(", ")}`
  });
  
  console.log(`${allEventsReceived ? '✅ PASS' : '❌ FAIL'} - Required Events Check`);
  console.log(`📝 Description: Server should send all required event types`);
  
  if (extraEvents.length > 0) {
    console.log(`⚠️ Warning: Received unexpected events: ${extraEvents.join(", ")}`);
  }
  
  if (!allEventsReceived) {
    console.log(`💥 Missing events: ${missingEvents.join(", ")}`);
  }
  
  console.log("─".repeat(50));
  
  // Validate each received event's data structure
  receivedEvents.forEach(eventType => {
    const message = receivedMessages.get(eventType);
    
    // Find validator for this event type
    const validator = eventValidators.find(v => v.event === eventType);
    if (!validator) {
      console.log(`⚠️ Warning: No validator for event type: ${eventType}`);
      return;
    }
    
    // Validate event data structure
    const validationResult = validator.validator(message.data);
    
    testResults.push({
      name: `WebSocket: ${validator.name} Format`,
      passed: validationResult.valid,
      details: validationResult.details
    });
    
    console.log(`${validationResult.valid ? '✅ PASS' : '❌ FAIL'} - ${validator.name} Format`);
    console.log(`📝 Description: ${eventType} event should have correct data structure`);
    
    if (!validationResult.valid) {
      console.log(`💥 Validation Failed: ${validationResult.details}`);
      console.log(`📄 Received: ${JSON.stringify(message.data, null, 2)}`);
    }
    
    console.log("─".repeat(50));
  });
}

function runNextTest(ws: WebSocket) {
  // Validate event data structures before moving to REST tests
  validateEventData();
  
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
  
  // Wait for connection_established, then send subscribe message
  setTimeout(() => {
    console.log("📡 Sending subscribe message...");
    ws.send(JSON.stringify({ action: "subscribe" }));
  }, 100);
  
  // Wait for all initial messages after subscription, then validate and start REST tests
  setTimeout(() => {
    runNextTest(ws);
  }, 6000); // Increased timeout to ensure all watchlist messages arrive (with delays)
};

ws.onmessage = (event) => {
  try {
    const message = JSON.parse(event.data.toString());
    
    // Track all received message types
    if (message.event) {
      console.log(`📡 Received message: ${message.event}`);
      
      // Store first message of each type
      if (!receivedMessages.has(message.event)) {
        receivedMessages.set(message.event, message);
      }
      
      // For watchlist_update, track variant types 
      if (message.event === "watchlist_update" && message.data && message.data.name) {
        const watchlistName = message.data.name;
        console.log(`📋 Watchlist received: ${watchlistName}`);
      }
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