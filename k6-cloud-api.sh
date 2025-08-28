#!/bin/bash

# Load environment variables from .env
source .env

# Set k6 specific environment variables
export K6_CLOUD_TOKEN="$K6_CLOUD_TOKEN"
export K6_WEB_DASHBOARD=true
timestamp=$(date +"%Y%m%d_%H%M%S")

# Run k6 with dynamic output file
k6 cloud \
    -e ENGINE="$ENGINE" \
    -e BASE_URL="$BASE_URL" \
    IA/soak-api-engine.js