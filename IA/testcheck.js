import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Configure which engine to test via environment variable
const TARGET_ENGINE = __ENV.ENGINE || 'mysql' || 'meilisearch' || 'duckdb';
const BASE_URL = 'https://api.rizwn.com/api/v1/datafeed';

// Custom metrics for detailed tracking
const engineResponseTime = new Trend(`${TARGET_ENGINE}_response_time`);
const engineErrorRate = new Rate(`${TARGET_ENGINE}_error_rate`);

// Focused test configuration for deep engine analysis
export const options = {
    stages: [
        // Gradual ramp-up for detailed observation
        { duration: '1m', target: 2 },
        { duration: '1m', target: 0 }  // Cool down
    ],
    // stages: [
    //     // Gradual ramp-up for detailed observation
    //     { duration: '1m', target: 2 },
    //     { duration: '2m', target: 5 },
    //     { duration: '3m', target: 10 },
    //     { duration: '5m', target: 20 },
    //     { duration: '3m', target: 35 },
    //     { duration: '5m', target: 50 },  // Peak load
    //     { duration: '2m', target: 20 },  // Step down
    //     { duration: '2m', target: 0 },   // Cool down
    // ],
    
    thresholds: {
        [`${TARGET_ENGINE}_response_time`]: [
            'p(50)<150',   // Aggressive thresholds for comparison
            'p(95)<500',
            'p(99)<1000'
        ],
        [`${TARGET_ENGINE}_error_rate`]: ['rate<0.01'], // Very low error tolerance
        'http_req_duration': ['p(95)<800'],
    },

    ext: {
        loadimpact: {
            distribution: {
                'amazon:us:ashburn': { loadZone: 'amazon:us:ashburn', percent: 100 },
            },
        },
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
    noVUConnectionReuse: true,
    discardResponseBodies: false,
    systemTags: ['status', 'method', 'url', 'name', 'group', 'check', 'error']
};

// Comprehensive search scenarios
const searchScenarios = [
    // High-probability matches
    { term: 'brush', weight: 0.2 },
    { term: 'milk', weight: 0.15 },
    { term: 'hair', weight: 0.15 }
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
}