import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Configure which engine to test via environment variable
const TARGET_ENGINE = __ENV.ENGINE; //|| 'mysql' || 'meilisearch' || 'duckdb'
const BASE_URL = __ENV.BASE_URL; //'https://api.rizwn.com/api/v1/datafeed';

// Custom metrics for detailed tracking
const engineResponseTime = new Trend(`${TARGET_ENGINE}_response_time`);
const engineErrorRate = new Rate(`${TARGET_ENGINE}_error_rate`);

// Focused test configuration for deep engine analysis / Sustained plateau
export const options = {
    stages: [
        // Quick ramp-up to target load
        { duration: '2m', target: 15 },    // Ramp to sustained load
        { duration: '3m', target: 25 },    // Reach operating level
        
        // Extended soak period - this is the key part
        { duration: '30m', target: 25 },   // 30min sustained load
        { duration: '10m', target: 25 },   // Additional soak time
        
        // Gradual ramp-down to observe recovery
        { duration: '3m', target: 10 },    // Step down
        { duration: '2m', target: 0 },     // Complete shutdown
    ],
    
    thresholds: {
        [`${TARGET_ENGINE}_response_time`]: [
            'p(50)<200',   // Slightly relaxed for long duration
            'p(95)<800',   // Allow for some degradation over time
            'p(99)<1500'   // More lenient for outliers in long tests
        ],
        [`${TARGET_ENGINE}_error_rate`]: ['rate<1.0'], // Allow slight increase over time
        'http_req_duration': ['p(95)<1000'],
        
        // Soak-specific thresholds
        'http_req_duration{scenario:soak}': ['p(95)<900'], // Trend monitoring
    },
    
    //Geograpghic distribution for load (k6 Cloud)
    ext: {
        loadimpact: {
            distribution: {
                'amazon:sg:singapore': { loadZone: 'amazon:sg:singapore', percent: 100 },
            },
        },
    },
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)', 'count'],
    noVUConnectionReuse: true,
    discardResponseBodies: false,
    systemTags: ['status', 'method', 'url', 'name', 'group', 'check', 'error', 'scenario'],
    
    // Soak test specific settings
    setupTimeout: '60s',        // Allow longer setup for stability
    teardownTimeout: '60s',     // Allow proper cleanup
    noConnectionReuse: false,   // Enable connection reuse for realistic long-term behavior
};

// Comprehensive search scenarios
const searchScenarios = [
    // High-probability matches
    { term: 'pillow', weight: 0.2 },
    { term: 'mop', weight: 0.15 },
    { term: 'bug', weight: 0.15 },
    
    // Moderate matches
    { term: 'ceramic bowl', weight: 0.1 },
    { term: 'gym wraps', weight: 0.1 },
    
    // Low/no matches
    { term: 'areeaverderci', weight: 0.1 },
    { term: 'oouyrenncyye', weight: 0.05 },
    
    // Edge cases
    { term: '', weight: 0.05 },
    { term: ' ', weight: 0.02 },
    { term: 'interestig cute date ideas for people who are introverts octopus', weight: 0.03 },
    { term: 'こんにちは', weight: 0.1 },
    { term: 'வணக்கம்', weight: 0.05 },
    { term: '咖啡', weight: 0.02},
    
    // Special characters
    { term: '$$$(spacebar)', weight: 0.02 },
    { term: '__search with spaces', weight: 0.03 },
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