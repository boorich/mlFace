#!/bin/bash
# Script to start the MCP bridge

# Default values
CONTAINER=""
PORT=11434
ADVANCED=true

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --container)
      CONTAINER="$2"
      shift 2
      ;;
    --port)
      PORT="$2"
      shift 2
      ;;
    --basic)
      ADVANCED=false
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --container CONTAINER_NAME [--port PORT] [--basic]"
      exit 1
      ;;
  esac
done

# Check for required arguments
if [ -z "$CONTAINER" ]; then
  echo "Error: Container name is required"
  echo "Usage: $0 --container CONTAINER_NAME [--port PORT] [--basic]"
  exit 1
fi

# Check if container exists
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
  echo "Error: Container '$CONTAINER' is not running"
  echo "Running containers:"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install --silent express cors body-parser
fi

# Start the bridge
if [ "$ADVANCED" = true ]; then
  echo "Starting advanced MCP bridge for container '$CONTAINER' on port $PORT..."
  node mcp-bridge-advanced.js --container "$CONTAINER" --port "$PORT"
else
  echo "Starting basic MCP bridge for container '$CONTAINER' on port $PORT..."
  node mcp-bridge.js --container "$CONTAINER" --port "$PORT"
fi
