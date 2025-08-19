import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test configuration - sudden massive load increase
export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Normal baseline load
    { duration: '1s', target: 200 },  // SPIKE! 10x increase in 1 second
    { duration: '5m', target: 200 },  // Maintain spike load
    { duration: '30s', target: 50 },  // Quick partial recovery
    { duration: '2m', target: 50 },   // Observe recovery behavior
    { duration: '1m', target: 0 },    // Final ramp down
  ],
  thresholds: {
    // More aggressive thresholds to catch breaking points
    http_req_duration: ['p(99)<5000'],     // 99% under 5s (some timeouts expected)
    http_req_failed: ['rate<0.3'],         // Allow up to 30% failures during spike
    checks: ['rate>0.70'],                 // 70% of checks should pass
    
    // Specific spike behavior thresholds
    http_req_connecting: ['p(95)<500'],    // Connection establishment
    http_req_receiving: ['p(95)<1000'],    // Data transfer time
  },
};

export default function () {
  const testPhase = getCurrentPhase();
  
  // Make API call
  const response = http.get('https://www.dnd5eapi.co/api/spells');
  
  // Track different types of failures
  let jsonData = null;
  let jsonParseSuccess = false;
  let timeoutError = false;
  let connectionError = false;
  
  try {
    jsonData = response.json();
    jsonParseSuccess = true;
  } catch (error) {
    console.warn(`JSON parsing failed during ${testPhase}:`, error.message);
    if (error.message.includes('timeout')) timeoutError = true;
    if (error.message.includes('connection')) connectionError = true;
  }
  
  // Spike-specific checks
  const checksPass = check(response, {
    'status is 200': (r) => r.status === 200,
    'not a 5xx server error': (r) => r.status < 500,
    'response received (not timeout)': (r) => r.status !== 0,
    'JSON parsed successfully': () => jsonParseSuccess,
    'response under 5s': (r) => r.timings.duration < 5000,
    'connection established': (r) => r.timings.connecting < 500,
    'has results': () => jsonParseSuccess && jsonData && jsonData.results !== undefined,
  });
  
  // Log critical failures during spike
  if (response.status === 0 || response.status >= 500) {
    console.error(`Critical failure during ${testPhase}: Status ${response.status}, Duration: ${response.timings.duration}ms`);
  }
  
  // Aggressive request pattern during spike
  if (testPhase === 'spike') {
    sleep(0.5 + Math.random() * 1); // 0.5-1.5s during spike
  } else {
    sleep(1 + Math.random() * 2);   // 1-3s during normal phases
  }
}

// Helper function to determine current test phase
function getCurrentPhase() {
  // This is a simplified phase detection
  // In real scenarios, you might use __ITER or other k6 variables
  const elapsed = Date.now() - __ENV.TEST_START_TIME;
  
  if (elapsed < 120000) return 'baseline';           // First 2 minutes
  if (elapsed < 420000) return 'spike';              // Minutes 2-7 (spike + maintain)
  if (elapsed < 570000) return 'recovery';           // Minutes 7-9.5
  return 'rampdown';                                 // Final phase
}

// Initialize test start time
export function setup() {
  const startTime = Date.now();
  console.log(`Spike test starting at ${new Date(startTime).toISOString()}`);
  return { TEST_START_TIME: startTime };
}