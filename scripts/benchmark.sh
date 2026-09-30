#!/usr/bin/env bash
# TakePicker Parallel Render Fan-Out Benchmark
# Usage: ./scripts/benchmark.sh <ASSET_ID>
# Scales render-worker container across 1, 2, 4, and 8 workers to measure render speedup.

set -e

ASSET_ID=${1:-""}
API_URL=${API_URL:-"http://localhost:3000"}

if [ -z "$ASSET_ID" ]; then
  echo "Usage: ./scripts/benchmark.sh <ASSET_ID>"
  echo "Example: ./scripts/benchmark.sh 8b3c990b-6a6d-4952-bf62-111111111111"
  exit 1
fi

echo "=========================================================="
echo " TakePicker Fan-Out Benchmark"
echo " Asset ID: $ASSET_ID"
echo " API URL:  $API_URL"
echo "=========================================================="

BASELINE=0

SUMMARY_TABLE="| Workers | Duration | Speedup |\n|:---:|:---:|:---:|\n"

for N in 1 2 4 6; do
  echo ""
  echo "-> Scaling render-worker to $N worker(s)..."
  docker compose up -d --scale render-worker=$N render-worker >/dev/null 2>&1
  sleep 2

  echo "-> Enqueueing export render flow..."
  RENDER_RES=$(curl -s -X POST "$API_URL/assets/$ASSET_ID/renders" -H "Content-Type: application/json" -d '{}')
  RENDER_ID=$(echo "$RENDER_RES" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

  if [ -z "$RENDER_ID" ]; then
    echo "Error: Failed to trigger render. Response: $RENDER_RES"
    exit 1
  fi

  echo "-> Render ID: $RENDER_ID. Polling progress..."
  START=$(date +%s%N)

  while true; do
    STATUS_RES=$(curl -s "$API_URL/renders/$RENDER_ID")
    ST=$(echo "$STATUS_RES" | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    if [ "$ST" = "DONE" ]; then
      break
    elif [ "$ST" = "FAILED" ]; then
      echo "Error: Render $RENDER_ID failed."
      exit 1
    fi
    sleep 0.3
  done

  END=$(date +%s%N)
  DURATION_MS=$(( (END - START) / 1000000 ))
  DURATION_SEC=$(awk "BEGIN {printf \"%.2f\", $DURATION_MS / 1000}")

  if [ "$N" -eq 1 ]; then
    BASELINE=$DURATION_MS
    SPEEDUP="1.00x (baseline)"
  else
    SPEEDUP=$(awk "BEGIN {printf \"%.2fx\", $BASELINE / $DURATION_MS}")
  fi

  echo "==> [Result] Workers: $N | Duration: ${DURATION_SEC}s | Speedup: $SPEEDUP"
  SUMMARY_TABLE+="${N} | ${DURATION_SEC}s | ${SPEEDUP}\n"
done

echo ""
echo "=========================================================="
echo " Benchmark Summary Table"
echo "=========================================================="
printf "$SUMMARY_TABLE"

echo ""
echo "Benchmark completed successfully."
