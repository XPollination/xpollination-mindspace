# PDSA: Project Dropdown for Multi-Project Support

**Date:** 2026-02-03
**Node:** viz-project-dropdown-design (539dc97d-4fc1-4f5e-93c1-7f7adebda73c)
**Type:** Design
**Status:** APPROVED - Ready for Implementation
**Requirement:** viz-project-dropdown

## PLAN

### Thomas's Requirement (verbatim)

> "on the top left there is currently 'mindspace Warehouse' and that is correct for now. but soon i will switch to another project and want to use the same project management system. can you make a drop down with it and have all projects that are in the current workspace put in there?"

### Current State
- Top left shows static text: "mindspace Warehouse"
- Single project visualization only
- No way to switch between projects

### Proposed State
- Top left shows dropdown with current project name
- Dropdown lists all projects in workspace
- Selecting a project reloads the visualization

---

## Design: Project Discovery

### Workspace Structure
```
~/workspaces/github/PichlerThomas/
├── xpollination-mcp-server/     ← has data/xpollination.db ✓
│   └── data/xpollination.db
├── xpollination-mindspace/      ← has data/xpollination.db ✓
│   └── data/xpollination.db
├── HomeAssistant/               ← no db (skip)
└── HomePage/                    ← to be checked
```

### Discovery Logic
```javascript
// Server-side: scan workspace for projects
function discoverProjects(workspacePath) {
  const projects = [];
  const dirs = fs.readdirSync(workspacePath);

  for (const dir of dirs) {
    const dbPath = path.join(workspacePath, dir, 'data', 'xpollination.db');
    if (fs.existsSync(dbPath)) {
      projects.push({
        name: dir,
        path: path.join(workspacePath, dir),
        dbPath: dbPath
      });
    }
  }

  return projects;
}
```

### Projects Endpoint
New endpoint needed: `GET /api/projects`
```json
{
  "current": "xpollination-mcp-server",
  "projects": [
    { "name": "xpollination-mcp-server", "path": "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server" },
    { "name": "xpollination-mindspace", "path": "/home/developer/workspaces/github/PichlerThomas/xpollination-mindspace" }
  ]
}
```

---

## Design: Dropdown UI

### Visual Design
```
Before:
┌─────────────────────────────────────────┐
│ mindspace Warehouse                      │
└─────────────────────────────────────────┘

After:
┌─────────────────────────────────────────┐
│ xpollination-mcp-server  ▼              │  ← dropdown
└─────────────────────────────────────────┘
         │
         ▼ (on click)
┌─────────────────────────────────────────┐
│ ● xpollination-mcp-server               │  ← current (checked)
│   xpollination-mindspace                │
│   HomePage                              │
└─────────────────────────────────────────┘
```

### HTML Structure
```html
<header>
  <select id="project-selector" class="project-dropdown">
    <option value="xpollination-mcp-server" selected>xpollination-mcp-server</option>
    <option value="xpollination-mindspace">xpollination-mindspace</option>
  </select>
  <span class="subtitle">Warehouse</span>
</header>
```

### CSS
```css
.project-dropdown {
  background: #1a1a2e;
  color: #e94560;
  border: 1px solid #e94560;
  padding: 8px 12px;
  font-size: 1.2em;
  font-weight: bold;
  cursor: pointer;
}

.project-dropdown:hover {
  background: #2d2d44;
}
```

---

## Design: Project Switching

### Flow
1. User selects project from dropdown
2. Browser requests new data: `GET /api/data?project=xpollination-mindspace`
3. Server loads data from that project's database
4. Visualization re-renders with new data

### Implementation Options

**Option A: Server-side routing**
- Each project has its own data endpoint
- Dropdown triggers page reload with project param
- Simple but causes full page refresh

**Option B: Dynamic data loading (RECOMMENDED)**
- Single page, dynamic data swap
- Dropdown triggers fetch of new data.json
- Visualization re-renders without page reload
- Smoother UX

### Implementation (Option B)
```javascript
// On project change
document.getElementById('project-selector').onchange = async (e) => {
  const projectName = e.target.value;

  // Fetch new data
  const response = await fetch(`/api/data?project=${projectName}`);
  const newData = await response.json();

  // Update global state
  nodes = newData.nodes;
  stations = newData.stations;

  // Re-render
  renderVisualization();
};
```

---

## Design: Server Changes

### New API Endpoint
```javascript
// GET /api/projects - list available projects
app.get('/api/projects', (req, res) => {
  const projects = discoverProjects(WORKSPACE_PATH);
  res.json({
    current: currentProject,
    projects: projects
  });
});

// GET /api/data?project=name - get data for specific project
app.get('/api/data', (req, res) => {
  const projectName = req.query.project || currentProject;
  const projectPath = path.join(WORKSPACE_PATH, projectName);
  const data = exportData(projectPath);
  res.json(data);
});
```

### Configuration
```javascript
const WORKSPACE_PATH = '/home/developer/workspaces/github/PichlerThomas';
```

---

## Acceptance Criteria

- [ ] Dropdown replaces static "mindspace Warehouse" text
- [ ] Dropdown shows current project name
- [ ] Dropdown lists all projects with `data/xpollination.db`
- [ ] Selecting project loads that project's data
- [ ] Visualization re-renders with new project data
- [ ] No page reload required (smooth transition)

---

## Thomas's Answers

| Question | Answer |
|----------|--------|
| Project display name | **Folder name** |
| Empty projects | **Yes, include them** |
| Server requirement | **Yes acceptable** - each project spins up own environment, if server exists, add to it |

---

## DO

### Implementation Task Created
**Node:** `viz-project-dropdown-impl`
**Assigned to:** Dev agent

### Handoff to Dev Agent

Implement project dropdown:

1. **Server endpoint** - `GET /api/projects` to list projects with xpollination.db
2. **Server endpoint** - `GET /api/data?project=name` to get project data
3. **Dropdown UI** - Replace static title with `<select>` dropdown
4. **Dynamic loading** - On change, fetch new data and re-render (no page reload)
5. **Include all projects** - Even empty ones (per Thomas)
6. **Use folder names** - As display names (per Thomas)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-viz-project-dropdown-design.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-viz-project-dropdown-design.pdsa.md
