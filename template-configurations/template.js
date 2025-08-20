import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
};

// Test setup (runs once)
export function setup() {
  // Authentication, data preparation, etc.
}

// Main test function (runs for each VU iteration)
export default function () {
  // Your test logic here
}

// Cleanup (runs once after test)
export function teardown(data) {
  // Cleanup operations
}