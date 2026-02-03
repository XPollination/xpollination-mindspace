#!/bin/bash
# Start visualization HTTP server
# Binds to 0.0.0.0:8080 for external access

cd "$(dirname "$0")"

# Kill existing server if running
pkill -f "python3 -m http.server 8080" 2>/dev/null

# Export fresh data
node export-data.js

# Start server bound to all interfaces
echo "Starting HTTP server on 0.0.0.0:8080..."
python3 -m http.server 8080 --bind 0.0.0.0 &
SERVER_PID=$!

sleep 1

# Verify server started
if kill -0 $SERVER_PID 2>/dev/null; then
    echo "Server running (PID: $SERVER_PID)"
    echo "Access URLs:"
    echo "  - http://localhost:8080/index.html"
    echo "  - http://10.33.33.1:8080/index.html (VPN)"
else
    echo "ERROR: Server failed to start"
    exit 1
fi
