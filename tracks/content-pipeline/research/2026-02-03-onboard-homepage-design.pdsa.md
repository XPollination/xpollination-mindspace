# PDSA: Onboard HomePage Project to PM System

**Date:** 2026-02-03
**Node:** onboard-homepage-design (7f6b1d69-d026-4573-a384-04889846352c)
**Type:** Design
**Status:** AWAITING REVIEW
**Requirement:** onboard-homepage-project (35b0de4a-d8d7-4ab7-b6b1-5407c3310d5a)

## PLAN

### Thomas's Requirement (verbatim)

> "how to onboard the project homepage (i already provided link, add it to the context). task contains checking out the project and set it up as described in task ad97adfb"

### Current State

| Item | Status |
|------|--------|
| HomePage repo cloned | ✓ Yes |
| Path | `/home/developer/workspaces/github/PichlerThomas/HomePage` |
| `data/` directory | ✓ Exists |
| `data/xpollination.db` | ✗ Missing |

### Goal
Initialize HomePage for PM system so it appears in the project dropdown.

---

## Design: Database Initialization

### Option A: Copy and Initialize (RECOMMENDED)
1. Copy schema from mcp-server
2. Initialize empty database in HomePage
3. Create default stations

```bash
# Copy schema
cp /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/schema.sql \
   /home/developer/workspaces/github/PichlerThomas/HomePage/data/

# Initialize database
cd /home/developer/workspaces/github/PichlerThomas/HomePage
sqlite3 data/xpollination.db < data/schema.sql

# Insert default stations
sqlite3 data/xpollination.db <<EOF
INSERT INTO stations (id, role, name, status, created_at) VALUES
  ('sta-dev', 'dev', 'Dev Station', 'idle', datetime('now')),
  ('sta-human', 'human', 'Human Station', 'idle', datetime('now')),
  ('sta-orch', 'orchestrator', 'Orchestrator Station', 'monitoring', datetime('now')),
  ('sta-pdsa', 'pdsa', 'PDSA Station', 'idle', datetime('now')),
  ('sta-qa', 'qa', 'QA Station', 'idle', datetime('now'));
EOF
```

### Option B: Shared Schema Module
- Create npm package with schema
- Each project imports and runs migration
- More complex, future consideration

### Recommendation: Option A
Simple file copy + SQL initialization. Can evolve to shared module later.

---

## Design: Verification Steps

After initialization:

1. **Check database exists:**
   ```bash
   ls -la /home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db
   ```

2. **Verify tables created:**
   ```bash
   sqlite3 HomePage/data/xpollination.db ".tables"
   # Expected: frames, drafts, trends, mindspace_nodes, stations, ...
   ```

3. **Verify stations exist:**
   ```bash
   sqlite3 HomePage/data/xpollination.db "SELECT * FROM stations"
   ```

4. **Check project dropdown:**
   - Refresh visualization at http://10.33.33.1:8080
   - Verify "HomePage" appears in dropdown
   - Select HomePage and confirm empty state loads

---

## Design: First Nodes (Optional)

Create a welcome/root requirement to start the project:

```sql
INSERT INTO mindspace_nodes (id, type, status, slug, dna_json, parent_ids, created_at) VALUES (
  'root-homepage',
  'requirement',
  'ready',
  'homepage-root',
  '{"title":"HomePage Project Root","description":"Root node for HomePage project management."}',
  '[]',
  datetime('now')
);
```

---

## Design: Reusable Onboarding Script

For future projects, create a reusable script:

```bash
#!/bin/bash
# scripts/onboard-project.sh

PROJECT_PATH=$1
MCP_SERVER_PATH="/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server"

if [ -z "$PROJECT_PATH" ]; then
  echo "Usage: ./onboard-project.sh /path/to/project"
  exit 1
fi

# Create data directory if needed
mkdir -p "$PROJECT_PATH/data"

# Copy schema
cp "$MCP_SERVER_PATH/src/db/schema.sql" "$PROJECT_PATH/data/"

# Initialize database
sqlite3 "$PROJECT_PATH/data/xpollination.db" < "$PROJECT_PATH/data/schema.sql"

# Insert default stations
sqlite3 "$PROJECT_PATH/data/xpollination.db" <<EOF
INSERT INTO stations (id, role, name, status, created_at) VALUES
  ('sta-dev', 'dev', 'Dev Station', 'idle', datetime('now')),
  ('sta-human', 'human', 'Human Station', 'idle', datetime('now')),
  ('sta-orch', 'orchestrator', 'Orchestrator Station', 'monitoring', datetime('now')),
  ('sta-pdsa', 'pdsa', 'PDSA Station', 'idle', datetime('now')),
  ('sta-qa', 'qa', 'QA Station', 'idle', datetime('now'));
EOF

echo "✓ Initialized PM system for: $PROJECT_PATH"
```

---

## Acceptance Criteria

- [ ] HomePage has `data/xpollination.db`
- [ ] Database has all required tables (mindspace_nodes, stations, etc.)
- [ ] Default stations created (dev, human, orchestrator, pdsa, qa)
- [ ] HomePage appears in project dropdown
- [ ] Can switch to HomePage in visualization
- [ ] Empty state displays correctly (no nodes, stations visible)

---

## Questions for Thomas

1. **First node:** Create a root requirement node, or leave completely empty?
2. **Onboarding script:** Create reusable script for future projects?
3. **Schema location:** Keep schema in HomePage's data/ or reference from mcp-server?

---

## DO

(Awaiting Thomas review before implementation)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-onboard-homepage-design.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-onboard-homepage-design.pdsa.md
