# How to Use Mindspace Flow Visualization Project Management Tool

## Overview

The Mindspace PM system uses a SQLite database (`data/xpollination.db`) to track tasks, requirements, designs, and other work items. Agents poll the database for tasks and update statuses as work progresses.

## Database Location

```
/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db
```

## Core Table: `mindspace_nodes`

All work items are stored in `mindspace_nodes`:

```sql
CREATE TABLE mindspace_nodes (
    id TEXT PRIMARY KEY,           -- UUID
    type TEXT NOT NULL,            -- task, requirement, design, test, group, decision
    status TEXT NOT NULL,          -- pending, ready, active, review, done, completed, blocked, cancelled
    parent_ids TEXT,               -- JSON array of parent node IDs
    slug TEXT NOT NULL,            -- Human-readable identifier (unique)
    dna_json TEXT NOT NULL,        -- JSON with title, description, acceptance_criteria, etc.
    created_at DATETIME,
    updated_at DATETIME
);
```

## How to Add a Task

### Using Node.js (Recommended)

```javascript
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

const db = new Database('./data/xpollination.db');

const task = {
  id: uuidv4(),
  type: 'task',
  status: 'ready',  // 'ready' = available for dev agent to pick up
  parent_ids: null, // or JSON.stringify(['parent-uuid']) if has parent
  slug: 'my-task-slug',  // unique, lowercase, hyphenated
  dna_json: JSON.stringify({
    title: 'My Task Title',
    description: 'What needs to be done',
    acceptance_criteria: [
      'Criterion 1',
      'Criterion 2'
    ],
    role: 'dev',  // optional: which agent should handle
    priority: 'medium'  // optional: low, medium, high
  })
};

db.prepare(`
  INSERT INTO mindspace_nodes (id, type, status, parent_ids, slug, dna_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
`).run(task.id, task.type, task.status, task.parent_ids, task.slug, task.dna_json);

console.log('Task created:', task.slug);
db.close();
```

### One-liner Example

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('./data/xpollination.db');
const id = require('crypto').randomUUID();
db.prepare(\"INSERT INTO mindspace_nodes (id, type, status, slug, dna_json, created_at, updated_at) VALUES (?, 'task', 'ready', ?, ?, datetime('now'), datetime('now'))\").run(
  id,
  'my-new-task',
  JSON.stringify({ title: 'My New Task', description: 'Task description here' })
);
console.log('Created task:', id);
db.close();
"
```

## Status Workflow

```
pending → ready → active → review → done/completed
                    ↓
                  blocked
```

| Status | Meaning |
|--------|---------|
| `pending` | Created but not ready to work on |
| `ready` | Available for agent to pick up |
| `active` | Currently being worked on |
| `review` | Implementation done, awaiting QA review |
| `done` / `completed` | Finished |
| `blocked` | Cannot proceed |
| `cancelled` | Abandoned |

## Querying for Tasks

### Find ready tasks for dev agent:

```javascript
const rows = db.prepare(`
  SELECT slug, json_extract(dna_json, '$.title') as title
  FROM mindspace_nodes
  WHERE type='task' AND status='ready'
`).all();
```

### Update task status:

```javascript
db.prepare(`
  UPDATE mindspace_nodes
  SET status='active', updated_at=datetime('now')
  WHERE slug=?
`).run('my-task-slug');
```

## DNA JSON Structure

The `dna_json` field contains task metadata:

```json
{
  "title": "Task Title",
  "description": "Detailed description",
  "acceptance_criteria": [
    "AC 1: ...",
    "AC 2: ..."
  ],
  "role": "dev",
  "priority": "medium",
  "thomas_feedback": "Any feedback from Thomas",
  "pdsa_ref": {
    "git": "https://github.com/.../docs/pdsa/file.md",
    "workspace": "/home/developer/.../docs/pdsa/file.md"
  }
}
```

## Node Types

| Type | Purpose |
|------|---------|
| `requirement` | High-level requirement from Thomas |
| `design` | PDSA design document |
| `task` | Implementation task for dev agent |
| `test` | Test specification |
| `group` | Container for related nodes |
| `decision` | Decision record |

## Visualization

Start the viz server to see tasks:

```bash
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
npm run viz
# Open http://localhost:3000
```

## Example: Create Task from PDSA Agent

```javascript
// PDSA agent creates implementation task after design approval
const Database = require('better-sqlite3');
const db = new Database('./data/xpollination.db');

const designId = 'uuid-of-design-node';
const taskId = require('crypto').randomUUID();

db.prepare(`
  INSERT INTO mindspace_nodes (id, type, status, parent_ids, slug, dna_json, created_at, updated_at)
  VALUES (?, 'task', 'ready', ?, ?, ?, datetime('now'), datetime('now'))
`).run(
  taskId,
  JSON.stringify([designId]),  // Link to parent design
  'implement-feature-x',
  JSON.stringify({
    title: 'Implement Feature X',
    description: 'Implementation details from PDSA design',
    acceptance_criteria: [
      'Criterion from design doc',
      'Another criterion'
    ],
    design_ref: designId
  })
);

db.close();
```

## Dual Links

For PDSA documents, always include dual links:

```json
{
  "pdsa_ref": {
    "git": "https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/filename.pdsa.md",
    "workspace": "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/filename.pdsa.md"
  }
}
```

## Quick Reference

| Action | Command |
|--------|---------|
| List ready tasks | `SELECT * FROM mindspace_nodes WHERE status='ready' AND type='task'` |
| Claim task | `UPDATE ... SET status='active'` |
| Complete task | `UPDATE ... SET status='review'` (dev) or `status='done'` (QA) |
| Check task details | `SELECT dna_json FROM mindspace_nodes WHERE slug='...'` |

---

**Workspace:** `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server`
