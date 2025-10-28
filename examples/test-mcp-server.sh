#!/bin/bash

# Test the MCP server by starting it and checking if it responds
# The server communicates via stdio using JSON-RPC

echo "Testing Cursor Context MCP Server..."
echo "======================================"
echo ""

# Check if built
if [ ! -f "dist/mcp-server/index.js" ]; then
    echo "❌ MCP server not built. Run: npm run build"
    exit 1
fi

echo "✓ MCP server binary found"
echo ""

# Start the server (it will wait for stdio input, that's normal for MCP)
echo "Starting MCP server..."
echo ""

# Capture output and check for startup message
OUTPUT=$(node dist/mcp-server/index.js 2>&1 < /dev/null & PID=$!; sleep 0.5; kill $PID 2>/dev/null; wait $PID 2>&1)

if echo "$OUTPUT" | grep -q "Cursor Context MCP Server started"; then
    echo "✓ MCP server started successfully"
else
    echo "❌ MCP server failed to start"
    echo "Output: $OUTPUT"
    exit 1
fi

echo ""
echo "======================================"
echo "✓ MCP Server Test Passed!"
echo ""
echo "Next steps:"
echo "1. Configure Cursor (see MCP-SETUP.md)"
echo "2. Restart Cursor"
echo "3. Try: 'List my recent chat sessions'"

