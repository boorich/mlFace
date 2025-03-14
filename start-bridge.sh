#!/bin/bash
# Script to start the MCP bridge

# Default values
CONTAINER=""
PORT=11434
MODE="minimal"

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
    --mode)
      MODE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --container CONTAINER_NAME [--port PORT] [--mode minimal|basic|advanced]"
      exit 1
      ;;
  esac
done

# Check for required arguments
if [ -z "$CONTAINER" ]; then
  echo "Error: Container name is required"
  echo "Usage: $0 --container CONTAINER_NAME [--port PORT] [--mode minimal|basic|advanced]"
  exit 1
fi

# Check if container exists
if ! docker ps --format '{{.Names}}' | grep -q "^$CONTAINER$"; then
  echo "Error: Container '$CONTAINER' is not running"
  echo "Running containers:"
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
  exit 1
fi

# Make the bridge script executable
chmod +x mcp-bridge-minimal.js mcp-bridge.js mcp-bridge-advanced.js

# Start the bridge
case "$MODE" in
  "minimal")
    echo "Starting minimal MCP bridge for container '$CONTAINER' on port $PORT..."
    node mcp-bridge-minimal.js --container "$CONTAINER" --port "$PORT"
    ;;
  "basic")
    echo "Starting basic MCP bridge for container '$CONTAINER' on port $PORT..."
    node mcp-bridge.js --container "$CONTAINER" --port "$PORT"
    ;;
  "advanced")
    echo "Starting advanced MCP bridge for container '$CONTAINER' on port $PORT..."
    node mcp-bridge-advanced.js --container "$CONTAINER" --port "$PORT"
    ;;
  *)
    echo "Error: Invalid mode '$MODE'. Must be one of: minimal, basic, advanced"
    exit 1
    ;;
esac
