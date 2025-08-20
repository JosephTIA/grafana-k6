import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Configure which engine to test via environment variable
const TARGET_ENGINE = __ENV.ENGINE; // 'mysql' || 'meilisearch' || 'duckdb';
const BASE_URL = __ENV.BASE_URL;

// Custom metrics for detailed tracking
const engineResponseTime = new Trend(`${TARGET_ENGINE}_response_time`);
const engineErrorRate = new Rate(`${TARGET_ENGINE}_error_rate`);

// Focused test configuration for deep engine analysis
// Primarily focused as a capacity/stress test
export const options = {
    stages: [
        // Gradual ramp-up for detailed observation / Pyramid pattern
        { duration: '1m', target: 2 },
        { duration: '2m', target: 5 },
        { duration: '3m', target: 10 },
        { duration: '5m', target: 20 },
        { duration: '3m', target: 35 },
        { duration: '5m', target: 50 },  // Peak load
        { duration: '2m', target: 20 },  // Step down
        { duration: '2m', target: 0 },   // Cool down
    ],
    
    thresholds: {
        [`${TARGET_ENGINE}_response_time`]: [
            'p(50)<150',   // Aggressive thresholds for comparison
            'p(95)<500',
            'p(99)<1000'
        ],
        [`${TARGET_ENGINE}_error_rate`]: ['rate<0.01'], // Very low error tolerance
        'http_req_duration': ['p(95)<800'],
    },

    //Geograpghic distribution for load (k6 Cloud)
    // ext: {
    //     loadimpact: {
    //         distribution: {
    //             'amazon:ap:singapore': { loadZone: 'amazon:ap:singapore', percent: 40 },
    //         },
    //     },
    // },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
    noVUConnectionReuse: true,
    discardResponseBodies: false,
    systemTags: ['status', 'method', 'url', 'name', 'group', 'check', 'error']
};

// Comprehensive search scenarios
const searchScenarios = [
    // High-probability matches
    { term: 'mug', weight: 0.2 },
    { term: 'paper', weight: 0.15 },
    { term: 'mas', weight: 0.15 },
    
    // Moderate matches
    { term: 'phone case', weight: 0.1 },
    { term: 'keyboard', weight: 0.1 },
    
    // Low/no matches
    { term: 'nonexistentterm123', weight: 0.1 },
    { term: 'zyxwvutsr', weight: 0.05 },
    
    // Edge cases
    { term: '', weight: 0.05 },
    { term: ' ', weight: 0.02 },
    { term: 'big fluffy plushy kids animal easy to clean graduation valentines gift', weight: 0.03 },
    { term: 'こんにちは', weight: 0.1 },
    { term: 'வணக்கம்', weight: 0.05 },
    { term: '咖啡', weight: 0.02},
    
    // Special characters
    { term: '@#$%', weight: 0.02 },
    { term: ' search with spaces', weight: 0.03 },
];

function selectWeightedSearch() {
    const random = Math.random();
    let cumulative = 0;
    
    for (const scenario of searchScenarios) {
        cumulative += scenario.weight;
        if (random <= cumulative) {
            return scenario;
        }
    }
    return searchScenarios[0]; // fallback
}

export default function () {
    const scenario = selectWeightedSearch();
    const searchTerm = scenario.term;
    
    // Build the URL
    const url = `${BASE_URL}?engine=${TARGET_ENGINE}&search=${encodeURIComponent(searchTerm)}`;
    
    // Request tags for filtering
    const tags = {
        engine: TARGET_ENGINE,
        search_term: scenario.term,
        search_length: searchTerm.length.toString()
    };
    
    // Make the request with timing
    const startTime = new Date().getTime();
    const response = http.get(url, { 
        tags,
        timeout: '30s' 
    });
    const endTime = new Date().getTime();
    const duration = endTime - startTime;
    
    // Record metrics
    engineResponseTime.add(duration, tags);
    
    //Safe JSON parsing with error handling
    let jsonData = null;
    let jsonParseSuccess = false;
    try { 
        jsonData = response.json();
        jsonParseSuccess = true;
    } catch (error) {
        console.warn(`JSON Parsing Error: ${error.message}`);
    }
    
    // Comprehensive checks
    const checks = check(response, {
        'Response status is 200': (r) => r.status === 200,
        'JSON parsed successfully': () => jsonParseSuccess,
        'Response time acceptable': (r) => r.timings.duration < 1000,
        'Valid JSON response': () => jsonData !== undefined && jsonData !== null,
        'Response not empty': (r) => r.body && r.body.length > 0,
        'Response size reasonable': (r) => r.body.length < 5000000, // 5MB limit
    }, tags);
    
    // Error tracking
    if (response.status !== 200 || !checks) {
        engineErrorRate.add(1, tags);
        console.error(`
            Error Details:
            - Engine: ${TARGET_ENGINE}
            - Status: ${response.status}
            - Body: ${response.body}
            - Search Term: ${searchTerm}
            - Duration: $${Math.round(response.timings.duration)}ms`
        )
        engineErrorRate.add(0, tags);
    }
    
    // Detailed logging every 25 iterations
    if (__ITER % 25 === 0) {
        console.log(`${TARGET_ENGINE} | "${searchTerm.substring(0, 20)}..." | ${response.status} | ${Math.round(response.timings.duration)}ms | Size: ${response.body.length}bytes`);
    }
    
    // Realistic user behavior
    const thinkTime = Math.random();
    if (thinkTime < 0.1) {
        sleep(0.1); // Fast API user
    } else if (thinkTime < 0.4) {
        sleep(0.5 + Math.random() * 1); // Quick user
    } else if (thinkTime < 0.8) {
        sleep(1 + Math.random() * 2); // Normal user
    } else {
        sleep(2 + Math.random() * 4); // Slow user
    }
}