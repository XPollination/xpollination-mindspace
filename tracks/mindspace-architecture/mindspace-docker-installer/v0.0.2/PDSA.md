# PDSA: Docker Containerization + Self-Documenting Installer (v0.0.2 — Brain Integration)

**Task:** `mindspace-docker-installer`
**Version:** v0.0.2
**Date:** 2026-03-13
**Author:** PDSA agent
**Rework of:** v0.0.1 (D5 rejected — Brain must be local, not external)

---

## PLAN

### Rework Context

Thomas rejected v0.0.1's D5 ("Brain API NOT included in compose — keep external"). His direction:

> "Brain is part of the node, not optional. Move Brain API + Skills + Hooks from best-practices into mindspace repo. Docker compose = 3 services (mindspace + qdrant + brain)."

This is an architectural shift: each Mindspace node is self-contained with its own Brain. Federation between nodes is future work.

**Plateau reference:** https://xpollination.earth/review/0afa83e7-72d2-4813-a3e5-d79bdb272447/

### Current State (post v0.0.1 implementation)

Already implemented and working:
- `Dockerfile` — multi-stage builder+runtime, node:22-slim
- `docker-compose.yml` — single mindspace service, ports 3100+4200, named volume
- `docker-compose.dev.yml` — dev override with source mounts
- `scripts/startup.sh` — self-documenting startup (4 steps)
- `.dockerignore` — excludes node_modules/.git/data
- `package.json` — `start` wraps `docker compose up --build`

Needs to change:
- Brain API source lives in `xpollination-best-practices/api/` — must move into this repo
- Qdrant docker-compose lives in `xpollination-best-practices/api/docker-compose.yml` — must merge
- Skills live in `xpollination-best-practices/.claude/skills/` — must copy into this repo
- Hook scripts live in `xpollination-best-practices/scripts/` — must copy into this repo
- Hardcoded paths in `viz/discover-projects.cjs` and `viz/agent-monitor.cjs`

### Design Decisions

**D1–D4, D6–D8: UNCHANGED from v0.0.1.** Single container for API+viz, node:22-slim multi-arch, named volumes, self-documenting startup, dev mode override, npm start wrapper, dockerignore.

**D5 (REVISED): Brain API + Qdrant included in docker-compose — 3 services.**

```yaml
services:
  mindspace:
    build: .
    ports:
      - "3100:3100"   # Mindspace API
      - "4200:4200"   # Viz dashboard
    volumes:
      - mindspace-data:/app/data
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/app/data/mindspace.db
      - QDRANT_URL=http://qdrant:6333
      - BRAIN_URL=http://brain:3200
    depends_on:
      - qdrant
      - brain
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant-data:/qdrant/storage
    deploy:
      resources:
        limits:
          memory: 300M
    environment:
      QDRANT__STORAGE__OPTIMIZERS__MEMMAP_THRESHOLD_KB: 1000
      QDRANT__STORAGE__HNSW_INDEX__ON_DISK: "true"
    restart: unless-stopped

  brain:
    build:
      context: .
      dockerfile: Dockerfile.brain
    ports:
      - "3200:3200"   # Brain knowledge API
      - "3201:3201"   # Brain MCP server
    volumes:
      - brain-data:/app/brain/data
    environment:
      - QDRANT_URL=http://qdrant:6333
      - BRAIN_API_KEY=${BRAIN_API_KEY}
    depends_on:
      - qdrant
    restart: unless-stopped

volumes:
  mindspace-data:
  qdrant-data:
  brain-data:
```

Reasoning: Thomas's vision is each node is self-contained. Brain is not optional infrastructure — it's core to the agent workflow (brain gates in workflow engine, brain-first hooks, memory recovery). Docker networking handles inter-service communication via service names (`qdrant`, `brain`).

**D9: Brain API gets its own Dockerfile (`Dockerfile.brain`).**

Brain API has different dependencies than Mindspace API (HuggingFace transformers for embeddings, Qdrant client). Separate Dockerfile keeps concerns clean.

```dockerfile
# Dockerfile.brain — Brain Knowledge API
# Fastify server that provides semantic memory for AI agents.
# Stores thoughts in Qdrant (vector DB) and SQLite (trace log).
# Embeds text using HuggingFace transformers (downloaded at first run).

FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY brain/package*.json ./
RUN npm ci
COPY brain/ .

FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
RUN mkdir -p /app/data
EXPOSE 3200 3201
CMD ["npx", "tsx", "src/index.ts"]
```

**D10: Brain API source moves to `brain/` directory in this repo.**

Move `xpollination-best-practices/api/` → `xpollination-mcp-server/brain/`:

```
brain/
├── src/
│   ├── index.ts                 # Fastify server entry (port 3200)
│   ├── scoring-config.ts
│   ├── middleware/
│   │   └── auth.ts              # Bearer token auth
│   ├── mcp/
│   │   └── brain-mcp.ts         # MCP server (port 3201)
│   ├── routes/
│   │   ├── health.ts
│   │   ├── memory.ts            # Core POST /api/v1/memory
│   │   ├── query.ts
│   │   ├── ingest.ts
│   │   └── thoughts.ts
│   ├── services/
│   │   ├── vectordb.ts          # Qdrant client
│   │   ├── thoughtspace.ts      # Core brain logic
│   │   ├── embedding.ts         # HuggingFace transformers
│   │   ├── database.ts          # SQLite (thought-tracing.db)
│   │   ├── seeder.ts
│   │   └── cid-service.ts
│   └── types/
│       └── index.ts
├── data/                        # SQLite DB (mounted volume)
├── package.json
├── package-lock.json
└── tsconfig.json
```

**Why `brain/` not `api/brain/`:** The Brain is a peer service to the Mindspace API, not a sub-component. Top-level `brain/` directory makes the 3-service architecture visible in the repo root.

**D11: Skills move to `.claude/skills/` in this repo.**

Copy from `xpollination-best-practices/.claude/skills/`:
- `xpo.claude.monitor/SKILL.md`
- `xpo.claude.mindspace.brain/SKILL.md`
- `xpo.claude.mindspace.pm.status/` (SKILL.md + versions)
- `xpo.claude.mindspace.garden/SKILL.md`
- `xpo.claude.mindspace.reflect/SKILL.md`
- `xpo.claude.clear/SKILL.md`
- `xpo.claude.unblock/SKILL.md`

Installation symlinks now point to this repo instead of best-practices.

**D12: Hook scripts move to `scripts/hooks/` in this repo.**

Copy from `xpollination-best-practices/scripts/`:
- `xpo.claude.brain-first-hook.sh` — queries brain before processing user prompt
- `xpo.claude.brain-writeback-hook.sh` — contributes agent conclusions after response
- `xpo.claude.compact-recover.sh` — injects recovery context after auto-compact
- `xpo.claude.precompact-save.sh` — saves state before compaction
- `xpo.claude.settings.json` — hook configuration template
- `xpo.claude.sync-settings.js` — merges hooks into local settings.json

New location: `scripts/hooks/` to separate from startup scripts.

**D13: Replace hardcoded paths with `XPO_WORKSPACE_PATH` env var.**

Files to update:
- `viz/discover-projects.cjs` line 9: `DEFAULT_WORKSPACE` already uses `XPO_WORKSPACE_PATH` env var with fallback — keep but update fallback to `/app` for container context
- `viz/agent-monitor.cjs` line 31: Same pattern — update fallback

In Docker context, `XPO_WORKSPACE_PATH=/app` and `XPO_CLI_PATH=/app/src/db/interface-cli.js`.

**D14: Startup script updated to 6 steps (adds Brain narration).**

```
▸ Step 1/6: Running database migrations...
▸ Step 2/6: Seeding initial data...
▸ Step 3/6: Migrating legacy data (if available)...
▸ Step 4/6: Waiting for Brain API...
  ✓ Brain API healthy at http://brain:3200
  ℹ Brain stores agent knowledge as semantic vectors
  ℹ Each agent contributes learnings, queries before decisions
  ℹ Local brain — future: federate with other nodes
▸ Step 5/6: Starting API server (port 3100)...
▸ Step 6/6: Starting visualization dashboard (port 4200)...
```

The mindspace container waits for brain health before starting services (`depends_on` handles container ordering, but not service readiness — startup.sh checks brain health with retry loop).

**D15: HuggingFace model cache as named volume.**

Brain API downloads HuggingFace embedding models on first run (~100MB). Cache via volume:

```yaml
brain:
  volumes:
    - brain-data:/app/brain/data
    - hf-cache:/root/.cache/huggingface
```

Prevents re-download on container restart. First run is slower (~30s model download).

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `brain/` | **COPY** from best-practices/api/ | Brain API source |
| `brain/package.json` | Copy + verify | Brain dependencies |
| `Dockerfile.brain` | **CREATE** | Multi-stage build for Brain API |
| `docker-compose.yml` | **MODIFY** | Add qdrant + brain services, volumes |
| `docker-compose.dev.yml` | **MODIFY** | Add brain dev overrides |
| `scripts/startup.sh` | **MODIFY** | Add Step 4 (brain health check) |
| `scripts/hooks/` | **COPY** from best-practices/scripts/ | Hook scripts |
| `.claude/skills/` | **COPY** from best-practices/.claude/skills/ | Agent skills |
| `viz/discover-projects.cjs` | **MODIFY** | Update default path fallback |
| `viz/agent-monitor.cjs` | **MODIFY** | Update default path fallback |
| `.dockerignore` | **MODIFY** | Add brain-specific excludes |

### Risks and Mitigations

**R1 (from v0.0.1): SQLite file locking.** Still applies — mindspace SQLite in single container.

**R2 (from v0.0.1): ARM64 compilation.** Now applies to both mindspace AND brain containers. Both use `node:22-slim` which supports arm64. HuggingFace transformers JS runs on both architectures.

**R5 (NEW): Qdrant memory on small servers.** Qdrant limited to 300MB via compose `deploy.resources.limits.memory`. On Synology DS218 (2GB RAM), total memory: ~300MB (Qdrant) + ~200MB (Brain) + ~200MB (Mindspace) + ~100MB (viz) = ~800MB. Fits within 2GB.

**R6 (NEW): HuggingFace model download on first run.** First startup is ~30s slower. Model cached in named volume `hf-cache`. If network unavailable, brain starts but embeddings fail — graceful degradation.

**R7 (NEW): Brain API dependency ordering.** Qdrant must be ready before Brain, Brain must be ready before Mindspace uses it. `depends_on` ensures container start order. Startup.sh adds health check retry for brain readiness.

**R8 (NEW): Duplicate code between repos.** After moving, `xpollination-best-practices/api/` becomes the canonical location's old version. Must decide: delete from best-practices or keep as legacy reference. Recommendation: keep but add deprecation notice pointing to new location.

### Verification Plan

1. `docker compose up --build` — builds all 3 services, starts successfully
2. First-run output narrates 6 steps including Brain startup
3. `curl http://localhost:3100/health` — Mindspace API responds 200
4. `curl http://localhost:4200` — Viz dashboard loads
5. `curl http://localhost:3200/api/v1/health` — Brain API responds healthy
6. `curl http://localhost:6333/health` — Qdrant responds healthy
7. Brain query: `curl -X POST http://localhost:3200/api/v1/memory -d '{"prompt":"test"}'` — returns results
8. `docker compose down && docker compose up` — all data persists (3 volumes)
9. Container sizes: mindspace < 400MB, brain < 500MB (HuggingFace models)
10. ARM64 build: `docker buildx build --platform linux/arm64 .` succeeds for both Dockerfiles
11. Skills present in `.claude/skills/` — `ls .claude/skills/xpo.claude.*/SKILL.md`
12. Hook scripts present in `scripts/hooks/` — `ls scripts/hooks/xpo.claude.*.sh`

---

## DO

_To be completed by DEV agent._

---

## STUDY

_To be completed after implementation._

---

## ACT

_To be completed after study._
