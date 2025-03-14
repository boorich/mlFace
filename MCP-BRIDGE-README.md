# MCP Bridge for mlFace

This directory contains three bridge implementations for connecting the mlFace application to MCP servers running in Docker containers that use stdio communication.

## Background

The Model Context Protocol (MCP) servers are designed to run over different transport layers:

1. **stdio** - The default and most secure transport, used by the filesystem server
2. **HTTP** - Optional transport for web applications

When running MCP servers in Docker containers (especially the filesystem server), they typically use stdio mode. To connect a web application to these servers, a bridge is needed to translate between HTTP and stdio.

## Quick Start

### Minimal Bridge (Recommended)

The minimal bridge (`mcp-bridge-minimal.js`) has no external dependencies and is the easiest to use:

```bash
# Run the bridge (replace CONTAINER_NAME with your Docker container's name)
./start-bridge.sh --container CONTAINER_NAME
```

This will use the minimal bridge by default.

### Alternative Bridge Implementations

You can also choose other bridge implementations:

```bash
# Use the basic bridge
./start-bridge.sh --container CONTAINER_NAME --mode basic

# Use the advanced bridge
./start-bridge.sh --container CONTAINER_NAME --mode advanced
```

### In Your Application

Once the bridge is running, in your application's settings, add:

```
http://localhost:11434
```

as the MCP server endpoint.

## Troubleshooting

### Connection Refused

If you see "Connection refused" errors:
- Make sure the bridge is running
- Verify the port number (default: 11434)
- Check that the specified Docker container exists and is running

### Protocol Errors

If you see protocol-related errors:
- Ensure the Docker container is running an MCP-compatible server
- Check the bridge logs for detailed error messages
- Try using the advanced bridge for better protocol handling

### Docker Container Not Found

If the Docker container is not found:
- Verify the container is running with `docker ps`
- Check the container name is correct
- Try using the container ID instead of the name

## Usage with Different MCP Servers

### Filesystem Server

When connecting to a filesystem server:

```bash
# Start the filesystem server
docker run -i --rm \
  --mount type=bind,src=/Users/username/Desktop,dst=/Users/username/Desktop \
  --mount type=bind,src=/Users/username/Projects,dst=/Users/username/Projects \
  mcp/filesystem \
  /Users/username/Desktop \
  /Users/username/Projects

# In another terminal, start the bridge
node mcp-bridge-advanced.js --container CONTAINER_NAME --port 11434
```

### SQLite Server

For SQLite servers:

```bash
# Start the SQLite server
docker run -i --rm -v mcp-test:/mcp mcp/sqlite --db-path /mcp/test.db

# Start the bridge
node mcp-bridge-advanced.js --container CONTAINER_NAME --port 11434
```

## How It Works

The bridge:
1. Creates an HTTP server that listens for requests from your web application
2. Forwards these requests to the Docker container's stdin using the `docker exec` command
3. Captures output from the container's stdout
4. Parses the JSON responses and sends them back to your web application

This approach allows your web application to communicate with the MCP server without modifying the server itself.
