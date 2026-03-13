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
COPY --from=builder /app/scripts ./scripts

# Create data directory for SQLite database (mounted as Docker volume)
RUN mkdir -p /app/data

# Make startup script executable
RUN chmod +x /app/scripts/startup.sh

# Expose API and viz ports
EXPOSE 3100 4200

# Self-documenting startup: narrates what it installs and why
CMD ["/app/scripts/startup.sh"]
