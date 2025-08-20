import http from 'k6/http';
import { check, sleep } from 'k6';

// Soak test configuration - sustained load over long period
export const options = {
  stages: [
    { duration: '5m', target: 20 },    // Ramp up to baseline
    { duration: '10m', target: 50 },   // Increase to sustained load
    { duration: '100m', target: 50 },  // Maintain load for ~1.5 hours
    { duration: '5m', target: 20 },    // Scale back to baseline
    { duration: '5m', target: 0 },     // Gradual ramp down
  ],
  thresholds: {
    // More lenient thresholds for long-duration test
    http_req_duration: ['p(95)<1000'],     // Allow up to 1s for 95th percentile
    http_req_failed: ['rate<0.1'],         // Allow up to 10% failures
    checks: ['rate>0.90'],                 // 90% of checks should pass
    
    // Additional thresholds to catch gradual degradation
    http_req_duration: ['p(50)<600'],      // Median should stay reasonable
    http_req_connecting: ['p(95)<100'],    // Connection time shouldn't degrade
  },
};

export default function () {
  // Add timestamp to track performance over time
  const startTime = Date.now();
  
  // Make API call
  const response = http.get('https://www.dnd5eapi.co/api/spells');
  
  // Safe JSON parsing
  let jsonData = null;
  let jsonParseSuccess = false;
  
  try {
    jsonData = response.json();
    jsonParseSuccess = true;
  } catch (error) {
    console.warn(`JSON parsing failed at ${new Date().toISOString()}:`, error.message);
  }
  
  // Comprehensive checks with timing awareness
  const checksPass = check(response, {
    'status is 200': (r) => r.status === 200,
    'JSON parsed successfully': () => jsonParseSuccess,
    'response under 1s': (r) => r.timings.duration < 1000,
    'response under 600ms (median target)': (r) => r.timings.duration < 600,
    'has results': () => jsonParseSuccess && jsonData.results !== undefined,
    'spell count consistent': () => jsonParseSuccess && jsonData.count > 300,
    'data structure intact': () => jsonParseSuccess && jsonData.results && jsonData.results[0] && jsonData.results[0].name !== undefined,
  });
  
  // Log slow responses for analysis
  if (response.timings.duration > 800) {
    console.warn(`Slow response detected: ${response.timings.duration}ms at ${new Date().toISOString()}`);
  }
  
  // Consistent user behavior pattern
  sleep(2 + Math.random() * 3); // 2-5 second intervals
}