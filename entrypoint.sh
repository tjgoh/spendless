#!/bin/bash
set -e

echo "Starting server..."
cd /app/server && npm run start &

echo "Starting client..."
cd /app/client && npm run start &

wait -n