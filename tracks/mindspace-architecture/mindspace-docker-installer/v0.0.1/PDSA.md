# PDSA: Docker Containerization + Self-Documenting Installer

**Task:** `mindspace-docker-installer`
**Version:** v0.0.1
**Date:** 2026-03-12
**Author:** PDSA agent

---

## PLAN

### Problem Statement

Current installation requires manual Node.js 22 setup, native `better-sqlite3` compilation, and Linux environment knowledge. Not reproducible on a new server without reading documentation and installing dependencies. `npm start` is silent — doesn't explain what the system does or teach the user about Mindspace.

### Current State

- API server: `api/server.ts` (Express, port 3100) — never deployed in production
- Viz server: `viz/server.js` (Node HTTP, port 4200/4100)
- Database: SQLite with `better-sqlite3` (requires native compilation)
- 33 SQL migrations + seed scripts from Phase 1 (`mindspace-api-deployment`)
- Brain API: External service on port 3200 (separate deployment)
- Platform: Hetzner CX22 (x86_64), Synology DS218 (ARM64), developer laptops

### Design Decisions

**D1: Single container for API + viz — not multi-container.**

Both services are small Node.js processes sharing one SQLite database. A multi-container setup would require shared volumes for the database and add complexity without benefit. Single container runs both processes via a process manager or startup script.

Reasoning: SQLite doesn't support concurrent writers from separate containers well. One container with one DB file is the natural fit.

**D2: `node:22-slim` base image (multi-arch: amd64 + arm64).**

`node:22-slim` supports both `linux/amd64` (Hetzner) and `linux/arm64` (Synology). The `-slim` variant is ~200MB vs ~1GB for full image. `better-sqlite3` requires `python3`, `make`, `g++` for compilation — install in build stage, not in final image.

Multi-stage build:
1. **Builder stage:** Install build tools, `npm ci`, compile native modules
2. **Runtime stage:** Copy `node_modules` and built artifacts, slim image only

**D3: SQLite data via Docker named volume.**

```yaml
volumes:
  mindspace-data:
services:
  mindspace:
    volumes:
      - mindspace-data:/app/data
```

Named volumes persist across `docker compose down/up`. Bind mounts (`./data:/app/data`) are an alternative for dev mode where you want direct host access. The default uses named volumes for clean separation.

**D4: Self-documenting startup script (`scripts/startup.sh`).**

The startup script narrates each step:

```
╔══════════════════════════════════════════════════════╗
║              MINDSPACE SYSTEM STARTUP                ║
╚══════════════════════════════════════════════════════╝

▸ Step 1/5: Running database migrations...
  ✓ 33 migrations applied (users, projects, missions, capabilities, tasks, ...)

▸ Step 2/5: Seeding initial data...
  ✓ Admin users created (thomas, robin, maria)
  ✓ Agent API keys generated (pdsa, dev, qa, liaison)
  ✓ Default project: xpollination-mcp-server

▸ Step 3/5: Migrating legacy data...
  ✓ 285 tasks imported from mindspace_nodes
  ✓ 18 capabilities created from group mappings
  ✓ 1 mission: "XPollination Platform"
  ✓ Hierarchy: Mission → Capabilities → Tasks (all linked)

▸ Step 4/5: Starting API server (port 3100)...
  ✓ Mindspace API listening on http://0.0.0.0:3100
  ✓ Health: GET /health
  ✓ Docs: GET /api/projects

▸ Step 5/5: Starting visualization dashboard (port 4200)...
  ✓ Viz dashboard at http://0.0.0.0:4200
  ✓ Kanban board, Mission view, Task detail

════════════════════════════════════════════════════════
  MINDSPACE IS READY

  API:  http://localhost:3100
  Viz:  http://localhost:4200

  What is Mindspace?
  A project management system organized as:
  Mission → Capabilities → Requirements → Tasks

  Each task has DNA (rich metadata) tracking its journey
  through the workflow: pending → ready → active → review → complete
════════════════════════════════════════════════════════
```

**D5: Brain API NOT included in compose — keep external.**

The Brain API (Qdrant + Fastify on port 3200) is a separate system with its own data, deployment, and lifecycle. Including it in compose would create a monolith. The Mindspace containers work without brain — agent workflow continues, brain contribution/query gracefully fails.

**D6: Dev mode via `docker-compose.dev.yml`.**

```yaml
# docker-compose.dev.yml
services:
  mindspace:
    build:
      context: .
      target: development  # Multi-stage: dev stage with tsx
    volumes:
      - ./api:/app/api       # Hot-reload API source
      - ./viz:/app/viz       # Hot-reload viz
      - ./src:/app/src       # Hot-reload legacy
      - ./data:/app/data     # Direct host access to DB
    command: ["npm", "run", "dev:all"]
    environment:
      - NODE_ENV=development
```

**D7: `npm start` wraps `docker compose up --build`.**

Update `package.json`:
```json
"start": "docker compose up --build",
"start:dev": "docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
```

For environments without Docker (current Hetzner setup), keep `start:native`:
```json
"start:native": "node scripts/startup.js"
```

**D8: `.dockerignore` for efficient builds.**

Exclude: `node_modules`, `.git`, `data/`, `dist/`, `*.db`, `tracks/`, `.claude/`

### Files to Create

| File | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: builder (compile native modules) + runtime (slim) |
| `docker-compose.yml` | Production compose: API + viz, named volume, ports 3100+4200 |
| `docker-compose.dev.yml` | Dev override: source mounts, hot-reload, bind mount data |
| `scripts/startup.sh` | Self-documenting startup: migrate → seed → start API → start viz |
| `.dockerignore` | Exclude non-essential files from build context |
| `package.json` | Update start scripts |

### Dockerfile Outline

```dockerfile
# ═══════════════════════════════════════════════════════
# MINDSPACE: Project Management for Cross-Pollination
# ═══════════════════════════════════════════════════════
# This Dockerfile creates a self-contained Mindspace system.
# It runs two services:
#   1. API (port 3100) — RESTful backend with Express
#   2. Viz (port 4200) — Dashboard for visualizing projects
# Data is stored in SQLite (mounted as a Docker volume).

# ── Stage 1: Build ────────────────────────────────────
# Install build tools for better-sqlite3 native compilation.
# These tools are NOT included in the final image.
FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build  # Compile TypeScript

# ── Stage 2: Runtime ──────────────────────────────────
# Slim image with only what's needed to run.
FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/viz ./viz
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./
COPY --from=builder /app/data ./data

# The startup script runs migrations, seeds data, and starts services.
# It narrates each step so you understand what Mindspace is doing.
EXPOSE 3100 4200
CMD ["bash", "scripts/startup.sh"]
```

### docker-compose.yml Outline

```yaml
version: "3.8"

# Mindspace: Mission → Capability → Requirement → Task
# This compose file runs the complete Mindspace system.

services:
  mindspace:
    build: .
    ports:
      - "3100:3100"   # API — project management endpoints
      - "4200:4200"   # Viz — dashboard UI
    volumes:
      - mindspace-data:/app/data   # SQLite database persists here
    environment:
      - NODE_ENV=production
      - API_PORT=3100
      - VIZ_PORT=4200
    restart: unless-stopped

volumes:
  mindspace-data:
    # Named volume for SQLite database.
    # Survives docker compose down/up.
    # Back up with: docker cp mindspace-mindspace-1:/app/data ./backup/
```

### Risks and Mitigations

**R1: SQLite file locking in Docker.** SQLite WAL mode works within a single container. Named volumes on Linux use the host filesystem — no locking issues.

**R2: better-sqlite3 compilation on ARM64.** `node:22-slim` supports ARM64. The builder stage compiles for the target architecture automatically. Docker buildx for multi-arch images if publishing to registry.

**R3: Synology Docker compatibility.** Synology DSM 7.2 supports Docker Compose v2. `node:22-slim` arm64 images work. The `/tmp` noexec issue doesn't apply inside containers.

**R4: Port conflicts with existing services.** Current setup uses 4100 (PROD viz), 4200 (TEST viz), 3100 (unused). Docker ports can be remapped in compose if needed.

### Verification Plan

1. `docker compose up --build` — builds successfully, starts both services
2. First-run output shows narrated startup (migrations, seeding, hierarchy explanation)
3. `curl http://localhost:3100/health` — API responds 200
4. `curl http://localhost:4200` — Viz dashboard loads
5. `docker compose down && docker compose up` — data persists (SQLite in volume)
6. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up` — dev mode with hot-reload
7. Container size: < 400MB (slim image without build tools)
8. ARM64 build: `docker buildx build --platform linux/arm64 .` succeeds

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
