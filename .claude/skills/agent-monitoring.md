# Skill: Agent Monitor (Parameterized - DRY)

**Name:** agent-monitor
**Roles:** Any (pdsa, qa, dev, etc.)
**Created:** 2026-02-04
**Updated:** 2026-02-04 - Parameterized for DRY pattern

## Purpose

Monitor multiple projects for tasks assigned to specified roles. Single script serves all agents (DRY pattern).

## Projects Monitored

| Project | Database Path |
|---------|---------------|
| xpollination-mcp-server | `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db` |
| HomePage | `/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db` |

## Monitoring Pattern

### Poll Interval
- **30 seconds** between checks
- Pause when actively processing work

### What to Monitor

**Query:** Nodes with `status='ready'` AND `role` in dna_json is `pdsa`

```sql
SELECT id, slug, type, status, dna_json
FROM mindspace_nodes
WHERE status = 'ready'
  AND dna_json LIKE '%"role":"pdsa"%'
```

- **Any type is valid:** task, design, requirement, etc.
- **Role determines assignment:** `role:pdsa` in dna_json
- **Status must be `ready`:** indicates work is available

### Node.js Implementation

```javascript
const Database = require('better-sqlite3');

const projects = [
  {
    name: "xpollination-mcp-server",
    path: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db"
  },
  {
    name: "HomePage",
    path: "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db"
  }
];

function checkProjects() {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`[${timestamp}] MULTI-PROJECT MONITORING`);

  projects.forEach(project => {
    try {
      const db = new Database(project.path, { readonly: true });

      // Check for nodes assigned to pdsa role
      const nodes = db.prepare(`
        SELECT id, slug, type, status, dna_json
        FROM mindspace_nodes
        WHERE status = 'ready'
          AND dna_json LIKE '%"role":"pdsa"%'
      `).all();

      if (nodes.length > 0) {
        console.log(`[${project.name}] ${nodes.length} node(s) for PDSA:`);
        nodes.forEach(n => {
          const dna = JSON.parse(n.dna_json || '{}');
          console.log(`  - ${n.slug} (${n.type}) role:${dna.role}`);
        });
      } else {
        console.log(`[${project.name}] No work for PDSA`);
      }

      db.close();
    } catch (err) {
      console.log(`[${project.name}] Error: ${err.message}`);
    }
  });
}

// Run once for testing, or wrap in setInterval for continuous monitoring
checkProjects();
```

### Running the Monitor

**Script:** `viz/agent-monitor.cjs` (parameterized)

```bash
# Start for PDSA agent
source ~/.nvm/nvm.sh
nohup node viz/agent-monitor.cjs pdsa > /tmp/agent-monitor-pdsa.log 2>&1 &

# Start for Dev agent
nohup node viz/agent-monitor.cjs dev > /tmp/agent-monitor-dev.log 2>&1 &
```

**Output files per role:**
- `/tmp/agent-work-pdsa.json`
- `/tmp/agent-work-dev.json`

### Minimal Token Monitoring (inside Claude)

Check for work with byte count (minimal tokens):
```bash
# PDSA agent checks:
stat -c%s /tmp/agent-work-pdsa.json 2>/dev/null || echo 0
```
- Returns `0` = no work
- Returns `>0` = work found, read the file

**Workflow (CONTINUOUS LOOP):**
1. Background script polls DB every 30s, writes to `/tmp/agent-work-pdsa.json`
2. Claude checks file size: `stat -c%s /tmp/agent-work-pdsa.json 2>/dev/null || echo 0`
3. If >0 bytes, read file and process ALL tasks in order
4. After processing (or if 0 bytes), **wait 30s and goto step 2**

**CRITICAL:** Do NOT check once and stop. The workflow is a CONTINUOUS LOOP. After each check (whether work found or not), wait 30 seconds and check again. The agent must keep polling until told to stop.

**Loop Pattern for Claude:**
```
while true:
    bytes = stat file
    if bytes > 0:
        read file, process tasks
    sleep 30s
```

## Adding New Projects

To add a new project to monitoring:

1. Ensure the project has `data/xpollination.db` initialized
2. Add entry to the `projects` array:
   ```javascript
   {
     name: "NewProject",
     path: "/home/developer/workspaces/github/PichlerThomas/NewProject/data/xpollination.db"
   }
   ```
3. Restart monitoring loop

## Onboarding New Projects

Before a project can be monitored, it needs PM system initialization:

```bash
# 1. Create data directory
mkdir -p /path/to/project/data

# 2. Copy schema
cp /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/schema.sql \
   /path/to/project/data/

# 3. Initialize database
sqlite3 /path/to/project/data/xpollination.db < /path/to/project/data/schema.sql

# 4. Insert default stations
sqlite3 /path/to/project/data/xpollination.db <<EOF
INSERT INTO stations (id, role, name, status, created_at) VALUES
  ('sta-dev', 'dev', 'Dev Station', 'idle', datetime('now')),
  ('sta-human', 'human', 'Human Station', 'idle', datetime('now')),
  ('sta-orch', 'orchestrator', 'Orchestrator Station', 'monitoring', datetime('now')),
  ('sta-pdsa', 'pdsa', 'PDSA Station', 'idle', datetime('now')),
  ('sta-qa', 'qa', 'QA Station', 'idle', datetime('now'));
EOF
```

See PDSA: `docs/pdsa/2026-02-03-onboard-homepage-design.pdsa.md` for full details.

## Status Values (IMPORTANT)

Use these canonical status values when updating nodes:

| Status | Meaning |
|--------|---------|
| `pending` | Not started |
| `ready` | Ready for work |
| `active` | Being worked on |
| `review` | Awaiting human review |
| `rework` | Needs changes |
| `complete` | **Finished (NO 'd')** |
| `blocked` | Cannot proceed |
| `cancelled` | Intentionally stopped |

**CRITICAL:** Use `complete` not `completed`. The 'd' suffix breaks visualization.

## Related PDSAs

- **Dual format reference example:**
  - Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/.claude/skills/pdsa-monitoring.md
  - Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.claude/skills/pdsa-monitoring.md
