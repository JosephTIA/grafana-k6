#!/bin/bash

# Load environment variables from .env
source .env
# Creates results directory if it doesn't exist
mkdir -p results

# Set k6 specific environment variables
export K6_WEB_DASHBOARD=true
timestamp=$(date +"%Y%m%d_%H%M%S")
export K6_OUT="json=results/k6_test_${timestamp}.json"

# Run k6 with dynamic output file
k6 run \
    -e ENGINE="$ENGINE" \
    -e BASE_URL="$BASE_URL" \
    IA/base-api-engine.js 

echo "Test results saved to: results/k6_test_${timestamp}.json"