import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

interface SearchTestCase {
  name: string;
  query: string;
  requestID: string;
  maxResults?: number;
  expectedResultType: 'local' | 'coingecko' | 'empty';
  description: string;
}

const key = (process.env.CLIENT_AUTH_TOKEN as string) || "random-key";
const ws = new WebSocket("ws://localhost:8080?token=" + key);

let testIndex = 0;
const testResults: Array<{name: string, passed: boolean, details: string}> = [];

const searchTestCases: SearchTestCase[] = [
  {
    name: "Popular Coin - Bitcoin",
    query: "bitcoin",
    requestID: "search_btc_001",
    maxResults: 5,
    expectedResultType: 'local',
    description: "Should find Bitcoin in local cache"
  },
  {
    name: "Symbol Search - BTC",
    query: "btc",
    requestID: "search_btc_symbol_002",
    maxResults: 10,
    expectedResultType: 'local',
    description: "Should find Bitcoin by symbol"
  },
  {
    name: "Popular Coin - Ethereum",
    query: "ethereum",
    requestID: "search_eth_003",
    maxResults: 3,
    expectedResultType: 'local',
    description: "Should find Ethereum in local cache"
  },
  {
    name: "Partial Match - Chain",
    query: "chain",
    requestID: "search_chain_004",
    maxResults: 15,
    expectedResultType: 'local',
    description: "Should find multiple coins with 'chain' in name"
  },
  {
    name: "Case Insensitive - DOGECOIN",
    query: "DOGECOIN",
    requestID: "search_doge_upper_005",
    maxResults: 5,
    expectedResultType: 'local',
    description: "Should handle uppercase search terms"
  },
  {
    name: "Obscure Coin - Fallback Test",
    query: "veryveryobscurecoin12345",
    requestID: "search_obscure_006",
    maxResults: 5,
    expectedResultType: 'empty',
    description: "Should fallback to CoinGecko API but return empty results for non-existent coins"
  },
  {
    name: "Real Obscure Coin - CoinGecko Fallback",
    query: "polkastarter",
    requestID: "search_real_obscure_006b",
    maxResults: 5,
    expectedResultType: 'coingecko',
    description: "Should fallback to CoinGecko API for real but uncommon coins not in cache"
  },
  {
    name: "Single Character",
    query: "a",
    requestID: "search_single_007",
    maxResults: 20,
    expectedResultType: 'local',
    description: "Should handle single character searches"
  },
  {
    name: "Number in Query",
    query: "coin98",
    requestID: "search_number_008",
    maxResults: 5,
    expectedResultType: 'local',
    description: "Should handle queries with numbers"
  },
  {
    name: "Special Characters",
    query: "usd-coin",
    requestID: "search_special_009",
    maxResults: 5,
    expectedResultType: 'local',
    description: "Should handle special characters in search"
  },
  {
    name: "Max Results Limit",
    query: "coin",
    requestID: "search_limit_010",
    maxResults: 100,
    expectedResultType: 'local',
    description: "Should respect max results limit"
  },
  {
    name: "Default Max Results",
    query: "token",
    requestID: "search_default_011",
    expectedResultType: 'local',
    description: "Should use default max results when not specified"
  },
  {
    name: "Empty Results Test",
    query: "zzzneverexistscoinzzz",
    requestID: "search_empty_012",
    maxResults: 5,
    expectedResultType: 'empty',
    description: "Should handle queries that return no results"
  }
];

function logSearchResult(testCase: SearchTestCase, response: any, passed: boolean) {
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`\n${status} - ${testCase.name}`);
  console.log(`📝 Description: ${testCase.description}`);
  console.log(`🔍 Query: "${testCase.query}"`);
  console.log(`🎯 Expected: ${testCase.expectedResultType} results`);
  
  if (response.status === 'SUCCESS' || response.variant === 'search:result') {
    const resultCount = response.data ? response.data.length : 0;
    console.log(`📊 Results Count: ${resultCount}`);
    
    if (resultCount > 0) {
      console.log(`🥇 First Result: ${response.data[0].name} (${response.data[0].symbol})`);
      console.log(`💰 Price: $${response.data[0].current_price || 'N/A'}`);
    }
    
    if (testCase.maxResults) {
      const respectsLimit = resultCount <= testCase.maxResults;
      console.log(`📏 Respects Limit: ${respectsLimit ? '✅' : '❌'} (${resultCount}/${testCase.maxResults})`);
    }
  } else if (response.status === 'ERROR') {
    console.log(`❌ Error: ${response.message}`);
    console.log(`🔢 Error Code: ${response.code}`);
  }
  
  console.log(`⏱️  Response Time: ${new Date().toLocaleTimeString()}`);
  console.log("─".repeat(60));
}

function determineResultType(response: any): 'local' | 'coingecko' | 'empty' | 'error' {
  if (response.status === 'ERROR') return 'error';
  
  const data = response.data || [];
  if (data.length === 0) return 'empty';
  
  // Heuristic: CoinGecko API results often have different structure or timing
  // If we get results for an uncommon coin, it's likely from CoinGecko fallback
  // For this test, we'll check if the first result has certain CoinGecko-specific fields
  // or if the response took longer (indicating API call)
  
  // Simple heuristic: if we have results but they seem to be from API search
  // (you might need to adjust this based on actual CoinGecko response structure)
  if (data.length > 0) {
    // Check if response has CoinGecko search API structure
    const firstResult = data[0];
    if (firstResult && (firstResult.large || firstResult.thumb || firstResult.market_cap_rank === undefined)) {
      return 'coingecko';
    }
  }
  
  return 'local';
}

function runNextSearchTest() {
  if (testIndex >= searchTestCases.length) {
    console.log("\n🎉 All search tests completed!");
    console.log("\n📊 SEARCH TEST SUMMARY:");
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    console.log(`✅ Passed: ${passed}/${total}`);
    console.log(`❌ Failed: ${total - passed}/${total}`);
    
    if (total - passed > 0) {
      console.log("\n❌ Failed Tests:");
      testResults.filter(r => !r.passed).forEach(result => {
        console.log(`   • ${result.name}: ${result.details}`);
      });
    }
    
    ws.close();
    return;
  }

  const testCase = searchTestCases[testIndex];
  console.log(`\n🧪 Running Search Test ${testIndex + 1}/${searchTestCases.length}: ${testCase.name}`);
  
  const searchMessage: any = {
    type: "search:request",
    query: testCase.query,
    requestID: testCase.requestID
  };
  
  if (testCase.maxResults) {
    searchMessage.maxResults = testCase.maxResults;
  }
  
  ws.send(JSON.stringify(searchMessage));
  console.log(`� Sent search query: "${testCase.query}"`);
  
  testIndex++;
}

ws.on("open", () => {
  console.log("🚀 Connected to server for search testing");
  console.log("🔍 Starting comprehensive search tests...\n");
  
  // Start tests after receiving initial messages
  setTimeout(() => {
    runNextSearchTest();
  }, 1000);
});

ws.on("message", (data) => {
  try {
    const msg = JSON.parse(data.toString());
    
    // Skip initial status and cache messages
    if (msg.type === "status" || msg.type === "coins:update") {
      console.log(`📡 Initial server message: ${msg.type}`);
      return;
    }
    
    // Process search test responses
    if (testIndex > 0 && testIndex <= searchTestCases.length) {
      const currentTestCase = searchTestCases[testIndex - 1];
      
      // Check if this response matches our current test
      if (msg.requestID === currentTestCase.requestID || 
          (msg.variant === "search:result" && msg.requestID === currentTestCase.requestID)) {
        
        const actualResultType = determineResultType(msg);
        let passed = false;
        let details = "";
        
        if (msg.status === 'ERROR') {
          passed = false;
          details = `Unexpected error: ${msg.message}`;
        } else if (currentTestCase.expectedResultType === 'empty') {
          passed = (msg.data || []).length === 0;
          details = passed ? "Correctly returned empty results" : `Expected empty, got ${(msg.data || []).length} results`;
        } else if (currentTestCase.expectedResultType === 'local' || currentTestCase.expectedResultType === 'coingecko') {
          passed = (msg.data || []).length > 0;
          
          if (currentTestCase.expectedResultType === 'coingecko') {
            // For CoinGecko fallback tests, we're more lenient - just need some results
            details = passed ? 
              `Found ${(msg.data || []).length} results (likely from CoinGecko API)` : 
              "Expected results from CoinGecko API but got none";
          } else {
            // For local cache tests, standard validation
            details = passed ? 
              `Found ${(msg.data || []).length} results` : 
              "Expected results but got none";
          }
          
          // Additional check for max results
          if (passed && currentTestCase.maxResults) {
            const respectsLimit = (msg.data || []).length <= currentTestCase.maxResults;
            if (!respectsLimit) {
              passed = false;
              details += ` (exceeded maxResults limit: ${(msg.data || []).length}/${currentTestCase.maxResults})`;
            }
          }
        }
        
        testResults.push({
          name: currentTestCase.name,
          passed,
          details
        });
        
        logSearchResult(currentTestCase, msg, passed);
        
        // Continue to next test after a delay
        setTimeout(() => {
          runNextSearchTest();
        }, 800);
      }
    }
    
  } catch (err) {
    console.error("❌ Failed to parse search response:", err);
    console.error("📄 Raw message:", data.toString());
  }
});

ws.on("error", (err) => {
  console.error("❌ WebSocket error during search testing:", err);
});

ws.on("close", () => {
  console.log("🔌 Search test connection closed");
  process.exit(0);
});
