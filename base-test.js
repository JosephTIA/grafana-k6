import http from 'k6/http';
import { check, sleep } from 'k6';

// Baseline test configuration - normal expected load
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Gradual ramp up to 10 users
    { duration: '3m', target: 20 },  // Increase to 20 users
    { duration: '2m', target: 20 },  // Stay at 20 users
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],     // Less than 5% failures
    checks: ['rate>0.95'],              // 95% of checks should pass
  },
};

export default function () {
  // Simulate different user behaviors
  const userType = Math.random();
  const isActiveUser = userType < 0.5; // 50% active, 50% casual
  
  // Make API call
  const response = http.get('https://www.dnd5eapi.co/api/spells');
  
  // Safe JSON parsing with error handling
  let jsonData = null;
  let jsonParseSuccess = false;
  
  try {
    jsonData = response.json();
    jsonParseSuccess = true;
  } catch (error) {
    console.warn('JSON parsing failed:', error.message);
  }
  
  // Comprehensive checks
  const checksPass = check(response, {
    'status is 200': (r) => r.status === 200,
    'JSON parsed successfully': () => jsonParseSuccess,
    'response time under 500ms': (r) => r.timings.duration < 500,
    'has results array': () => jsonParseSuccess && jsonData.results !== undefined,
    'has expected spell count': () => jsonParseSuccess && jsonData.count > 300,
    'first spell has name': () => jsonParseSuccess && jsonData.results && jsonData.results[0] && jsonData.results[0].name !== undefined,
  });
  
  // Variable sleep based on user behavior
  if (isActiveUser) {
    sleep(1 + Math.random() * 2); // 1-3 seconds for active users
  } else {
    sleep(3 + Math.random() * 5); // 3-8 seconds for casual browsers
  }
}