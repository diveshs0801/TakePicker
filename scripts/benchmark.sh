#!/usr/bin/env bash
# Usage: ./scripts/benchmark.sh <command that enqueues a render and waits for DONE>
# Runs the same render with 1, 2, 4, 8 render workers and prints wall-clock seconds.
set -e
for N in 1 2 4 8; do
  docker compose up -d --scale render-worker=$N render-worker
  sleep 3
  START=$(date +%s)
  "$@"
  END=$(date +%s)
  echo "workers=$N seconds=$((END-START))"
done
