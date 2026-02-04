# Skill: Multi-Project DEV Monitoring

**Name:** dev-monitoring
**Role:** DEV Agent
**Created:** 2026-02-04

## Purpose

Monitor multiple projects in the workspace for implementation tasks assigned to the DEV role (or unassigned tasks).

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

1. **Ready Items with role:dev** (status: `ready`, any type)
   - Query: `WHERE status='ready' AND dna_json LIKE '%role":"dev%'`
   - Process highest priority first

2. **Task Fields**
   - `slug` - task identifier
   - `dna_json.title` - human-readable title
   - `dna_json.description` - what to implement
   - `dna_json.acceptance_criteria` - definition of done
   - `dna_json.role` - assigned role (dev, pdsa, qa, etc.)

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
  console.log(`[${timestamp}] MULTI-PROJECT DEV MONITORING`);

  let devTasks = [];

  projects.forEach(project => {
    try {
      const db = new Database(project.path, { readonly: true });

      const tasks = db.prepare(`
        SELECT slug, type, status,
               json_extract(dna_json, '$.title') as title,
               json_extract(dna_json, '$.priority') as priority
        FROM mindspace_nodes
        WHERE status = 'ready' AND dna_json LIKE '%role":"dev%'
      `).all();

      if (tasks.length > 0) {
        console.log(`[${project.name}] ${tasks.length} DEV item(s):`);
        tasks.forEach(t => {
          console.log(`  - ${t.slug} (${t.type}): ${t.title || '(no title)'}`);
          devTasks.push({project: project.name, ...t});
        });
      } else {
        console.log(`[${project.name}] No DEV items`);
      }

      db.close();
    } catch (err) {
      console.log(`[${project.name}] Error: ${err.message}`);
    }
  });

  console.log(`Total DEV tasks: ${devTasks.length}`);
  return devTasks;
}

checkProjects();
```

## Workflow When Task Found

1. **Claim task** - Update status to `active`
2. **Read full details** - Query `dna_json` for description and acceptance criteria
3. **Implement** - Follow git protocol (specific staging, atomic commands, immediate push)
4. **Complete** - Update status to `review` (not `done` - QA reviews first)

## Adding New Projects

To add a new project to monitoring:

1. Ensure the project has `data/xpollination.db` initialized
2. Add entry to the `projects` array
3. Restart monitoring loop

## Related Skills

- **PDSA Monitoring:** `.claude/skills/pdsa-monitoring.md` (for PDSA+QA agent)

---

**Dual format reference:**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/.claude/skills/dev-monitoring.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.claude/skills/dev-monitoring.md
