#!/bin/bash
# Start the backend server

cd "$(dirname "$0")"

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check for required vars
if [ -z "$XIAOMI_API_KEY" ]; then
    echo "Error: XIAOMI_API_KEY not set. Copy .env.example to .env and add your key."
    exit 1
fi

echo "Starting AI Avatar Chatbot Backend..."
echo "API: http://localhost:${PORT:-8000}"
echo "Press Ctrl+C to stop"

python3 -m uvicorn main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000} --reload
