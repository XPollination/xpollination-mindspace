# ============================================================================
# Mindspace — Multi-stage Docker build
# ============================================================================
# This Dockerfile creates a production image for the Mindspace system:
#   - API server (Express, port 3100) — RESTful backend with auth, migrations
#   - Viz dashboard (Node HTTP, port 4200) — mindspace visualization UI
#   - SQLite database — persistent via Docker volume at /app/data
#
# Two stages:
#   1. builder — installs native dependencies (better-sqlite3 needs compilation)
#   2. runtime — slim image with only production artifacts
# ============================================================================

# ---------------------------------------------------------------------------
# Stage 1: builder
# better-sqlite3 requires native compilation tools (python3, make, g++).
# We install these in a temporary stage so the final image stays small.
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Install native build tools for better-sqlite3 compilation.
# python3 — node-gyp build system dependency
# make    — builds native C/C++ modules
# g++     — compiles better-sqlite3 C++ bindings
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better Docker layer caching.
# If dependencies haven't changed, Docker reuses this layer.
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for TypeScript compilation)
RUN npm ci

# Copy source code and compile TypeScript
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# Slim image — no build tools, only what's needed to run the servers.
# Supports amd64 (Hetzner) and arm64 (Synology DS218) via node:22-slim.
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

WORKDIR /app

# Copy compiled output and production dependencies from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Copy source files needed at runtime (not compiled by tsc)
COPY --from=builder /app/api ./api
COPY --from=builder /app/viz ./viz
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/twins ./src/twins
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/docs ./docs

# Install tmux + curl for persistent agent terminal sessions and A2A connectivity
RUN apt-get update && apt-get install -y --no-install-recommends tmux curl && rm -rf /var/lib/apt/lists/*

# Install Claude Code globally (agents use Max Plan OAuth — no API key needed)
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || echo "Claude Code install deferred to startup (self-healing)"

# Pre-configure Claude Code defaults (template — per-user dirs created at runtime)
RUN mkdir -p /home/node/.claude && \
    echo '{"theme":"light","telemetry":false,"hasCompletedOnboarding":true}' > /home/node/.claude/settings.json && \
    chown -R node:node /home/node/.claude

# Copy A2A agent scripts needed at runtime
COPY --from=builder /app/src/a2a ./src/a2a

# Create data directory and set ownership to node user (UID 1000).
# This prevents SQLite "readonly database" errors when /app/data is bind-mounted.
# Without this, migrations create files as root and the node process can't write.
RUN mkdir -p /app/data && chown -R node:node /app/data /app

# Make startup script executable
RUN chmod +x /app/scripts/startup.sh

# Run as non-root (node user, UID 1000 in node:22-slim).
# All files created at runtime (SQLite DB, WAL, SHM) will be owned by UID 1000.
USER node

# Expose API and viz ports
EXPOSE 3100 4200

# Self-documenting startup: narrates what it installs and why
CMD ["/app/scripts/startup.sh"]
