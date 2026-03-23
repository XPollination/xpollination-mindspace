# Mindspace

Project management for AI agent teams. One command starts everything.

## Quick Start

```bash
git clone https://github.com/XPollination/xpollination-mindspace.git
cd xpollination-mindspace
cp .env.example .env          # edit .env to set JWT_SECRET and BRAIN_API_KEY
npm start
```

That's it. `npm start` builds, configures, and launches the full system.

## What `npm start` Does

`npm start` runs `docker compose up --build`, which starts 3 services with health-checked dependencies:

```
Qdrant (vector DB, port 6333)
  └─ healthy? ──▸ Brain API (knowledge store, port 3200)
                    └─ healthy? ──▸ Mindspace (API + Viz)
                                     ├── API server  (port 3100)
                                     └── Viz dashboard (port 4200)
```

Each service waits for its dependencies to be **healthy** before starting — not just running.

### Startup Sequence (inside Mindspace container)

The entrypoint (`scripts/startup.sh`) runs 5 steps:

| Step | What | Why |
|------|------|-----|
| 0 | Wait for Brain API | Ensures knowledge store is reachable before proceeding |
| 1 | Database migrations | Creates tables (Mission > Capability > Requirement > Task). Checksummed, idempotent — safe to run on every start |
| 2 | Seed initial data | Creates admin users, projects, and agent API keys (pdsa, dev, qa, liaison) |
| 3 | Legacy migration | If legacy `xpollination.db` exists, migrates it to the new schema (one-time) |
| 4 | Start servers | Viz dashboard (background) + API server (foreground) |

### Verify

```bash
curl http://localhost:3100/health          # API
curl http://localhost:4200                 # Viz (redirects to login)
curl http://localhost:3200/api/v1/health   # Brain
npm run health                             # All services at once
```

## Reboot Resilience

All services are configured with Docker health checks and `restart: unless-stopped`. On host reboot:

1. Docker daemon starts automatically
2. Docker restarts all containers
3. Health checks enforce startup order: Qdrant → Brain → Mindspace
4. `startup.sh` waits for Brain before running migrations
5. Services self-heal on failure (automatic restart with backoff)

No manual intervention needed.

## Configuration

Copy `.env.example` to `.env`. The required variables:

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `JWT_SECRET` | — | Yes | Signs session cookies (API + Viz must share the same value) |
| `BRAIN_API_KEY` | `changeme` | Yes | Authenticates agents with the Brain API |
| `DATABASE_PATH` | `./data/xpollination.db` | — | SQLite database location |
| `API_PORT` | `3100` | — | API server port |
| `VIZ_PORT` | `4200` | — | Viz dashboard port |
| `VIZ_BIND` | `0.0.0.0` | — | Viz binding address |
| `BRAIN_API_URL` | `http://brain:3200` | — | Brain endpoint (auto-set in Docker) |
| `XPO_WORKSPACE_PATH` | — | — | Parent directory for multi-project discovery |

Google OAuth is optional — password login works without it. See `.env.example` for all options.

## Architecture

```
4 Claude Agents (Liaison, PDSA, Dev, QA)
    │
    ▼
┌──────────────────────────────────────────┐
│           Mindspace Platform             │
│                                          │
│  API Server (Express, port 3100)         │
│  ├── Auth (JWT sessions, Google OAuth)   │
│  ├── Task workflow engine                │
│  ├── Agent API keys                      │
│  └── SQLite (data/)                      │
│                                          │
│  Viz Dashboard (port 4200)               │
│  ├── Mission > Capability > Requirement  │
│  ├── Task board with workflow states     │
│  ├── Knowledge space browser             │
│  └── Multi-project support               │
│                                          │
│  Brain API (Fastify, port 3200)          │
│  ├── Agent shared memory                 │
│  ├── Vector search (Qdrant)              │
│  └── Knowledge highways                  │
└──────────────────────────────────────────┘
    │
    ▼
xpollination.earth
```

## Key Files

| Path | Purpose |
|------|---------|
| `docker-compose.yml` | Full system definition (the source of truth for `npm start`) |
| `scripts/startup.sh` | Container entrypoint — migrations, seeding, server startup |
| `scripts/service-lifecycle.js` | Health checks, restarts, deployments |
| `api/server.ts` | Express API server |
| `viz/server.js` | Viz dashboard server |
| `src/db/interface-cli.js` | CLI for all database operations (agents use this) |
| `src/db/workflow-engine.js` | Transition rules and validation |
| `.env.example` | Environment variable template |

## Development

### Docker (recommended)

```bash
# Full stack with hot-reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Standalone (uses host brain/qdrant)
docker compose -f docker-compose.dev-standalone.yml up --build
```

### Native (no Docker)

```bash
npm install
npm run build
npm run start:api    # API with migrations on port 3100
npm run viz          # Viz dashboard on port 4200
```

### Testing

```bash
npm test             # Run all tests (vitest)
npm run health       # Check service health
```

## Docker Compose Variants

| File | Use Case | Services |
|------|----------|----------|
| `docker-compose.yml` | Production / `npm start` | Qdrant + Brain + Mindspace |
| `docker-compose.prod.yml` | VPN-bound production | Mindspace only (host brain/qdrant) |
| `docker-compose.dev.yml` | Dev overlay (hot-reload) | Adds source mounts to base |
| `docker-compose.dev-standalone.yml` | Dev standalone | Mindspace only (host brain/qdrant) |

## License

MIT
