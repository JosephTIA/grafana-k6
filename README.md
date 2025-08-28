# Grafana k6 Performance Testing Suite

A comprehensive performance testing framework built with [Grafana k6](https://k6.io/) for API engine comparison and load testing. This suite is designed to evaluate and compare the performance characteristics of different database engines (MySQL, MeiliSearch, DuckDB) under various load patterns.

## Project Structure

```
grafana-k6/
   IA/                           # Intelligence & Analytics test scripts
      base-api-engine.js        # Baseline capacity/stress testing
      soak-api-engine.js        # Extended duration testing (60+ minutes)
      spike-api-engine.js       # Sudden load spike testing
      testcheck.js              # Test validation utilities
   template-configurations/      # Reusable test templates
      base-test.js              # Standard baseline configuration
      soak-test.js              # Soak test template
      spike-test.js             # Spike test template
      template.js               # Generic test template
   testrun/                      # Kubernetes and runtime configurations
      k6-testrun-resource.yaml  # k6 operator configuration
      packaged-tests/           # Packaged test scripts
      stages-script.js          # Dynamic stages configuration
   k6-api.sh                     # Local k6 execution script
   k6-cloud-api.sh              # k6 Cloud execution script
   env-template.example          # Environment configuration template
```

## Setup & Installation

### Prerequisites

- [k6](https://k6.io/docs/getting-started/installation/) installed locally
- Access to the target API endpoints
- (Optional) k6 Cloud account for cloud-based testing

### Environment Configuration

1. Copy the environment template:
```bash
cp env-template.example .env
```
2. Rename the file to .env

3. Configure your environment variables:
```bash
# .env
BASE_URL=endpoint_url_here
K6_CLOUD_TOKEN=your_k6_cloud_token_here
ENGINE=meilisearch  # Options: mysql, meilisearch, duckdb
K6_WEB_DASHBOARD=true
```

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd grafana-k6

# Set up environment
cp env-template.example .env
# Edit .env with your configuration

# Make scripts executable
chmod +x k6-api.sh k6-cloud-api.sh

# Create results directory
mkdir -p results
```

## Running Tests

### Before Execution
1. Select the Engine you would like to run the scripts by changing the ENGINE env variable in the .env file
```bash
# Engine to be used
ENGINE=meilisearch #mysql # or 'meilisearch' or 'duckdb';
```
2. Verify the file you want to run has been preloaded in the shell script file.
```bash
k6 run \
    -e ENGINE="$ENGINE" \
    -e BASE_URL="$BASE_URL" \
    IA/base-api-engine.js 
```
### Local Execution

```bash
# Run baseline API engine test
./k6-api.sh
```

This will:
- Load environment variables from `.env`
- Create timestamped results in the `results/` directory
- Execute the baseline API engine test with your configured parameters

### Cloud Execution

For distributed testing using k6 Cloud:

```bash
# Run test on k6 Cloud
./k6-cloud-api.sh
```

Requires a valid `K6_CLOUD_TOKEN` in your environment.

### Direct k6 Execution

You can also run tests directly with k6:

```bash
# Baseline test
k6 run -e ENGINE=meilisearch -e BASE_URL=https://api.example.com IA/base-api-engine.js

# Soak test (extended duration)
k6 run -e ENGINE=mysql -e BASE_URL=https://api.example.com IA/soak-api-engine.js

# Spike test
k6 run -e ENGINE=duckdb -e BASE_URL=https://api.example.com IA/spike-api-engine.js
```

## Test Configurations

### Baseline Test (`base-api-engine.js`)
- **Purpose**: Capacity and stress testing with gradual load increase
- **Pattern**: Pyramid load pattern (2->5->10->20->35->50->20->0 users)
- **Duration**: ~23 minutes
- **Thresholds**: Aggressive performance requirements (p50<150ms, p95<500ms)

### Soak Test (`soak-api-engine.js`)
- **Purpose**: Extended duration testing to identify memory leaks and degradation
- **Pattern**: Sustained plateau load (25 users for 60+ minutes)
- **Duration**: ~70 minutes
- **Focus**: Long-term stability and resource utilization

### Spike Test (`spike-api-engine.js`)
- **Purpose**: Sudden traffic spike resilience testing
- **Pattern**: Multiple spike scenarios (5x and 10x load increases)
- **Duration**: ~15 minutes
- **Focus**: Recovery behavior and system stability under sudden load

## Metrics & Monitoring

Each test tracks custom metrics specific to the configured engine:

- `{engine}_response_time`: Engine-specific response time trends
- `{engine}_error_rate`: Engine-specific error rates
- Standard k6 HTTP metrics with detailed percentiles (p50, p95, p99)
- Geographic distribution support for k6 Cloud runs

### Result Analysis

a. Tests Results will be stored under the /results folder after test completion

b. Test results are automatically streamed to your connected k6 Cloud account on your browser when using cloud execution.

### Engine Options

- `mysql`: MySQL database backend testing
- `meilisearch`: MeiliSearch backend testing
- `duckdb`: DuckDB backend testing