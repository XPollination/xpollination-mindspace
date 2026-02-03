# PDSA: Mindspace Flow Visualization Design

**Date:** 2026-02-03
**Node:** viz-design (ACTIVE)
**Requirement:** viz-prototype-req

## PLAN

### Objective
Design a web-based visualization showing the PM tool workflow as a warehouse with packages (nodes) moving through stations (statuses).

### Acceptance Criteria (from requirement)
1. Web-accessible (localhost or deployed)
2. Shows nodes as packages in a warehouse
3. Shows stations (statuses) as areas
4. Can zoom into node details
5. Visualizes DAG dependencies
6. Real-time or refresh to show flow

### Data Model Analysis
```
mindspace_nodes:
- id: TEXT (UUID)
- type: TEXT (requirement, design, task, test)
- status: TEXT (pending, ready, active, done)
- parent_ids: TEXT (JSON array for DAG)
- slug: TEXT (human-readable identifier)
- dna_json: TEXT (node-specific metadata)
```

### Tech Stack Decision

**Constraints:**
- Hetzner CX22: 2 vCPU, 4GB RAM
- Must be lightweight
- Quick to implement (prototype)

**Options Evaluated:**
| Option | Pros | Cons |
|--------|------|------|
| D3.js | Powerful, flexible | Steep learning curve |
| vis.js | Good for networks | Heavier dependency |
| React | Component-based | Build setup overhead |
| **Vanilla JS + SVG** | Lightweight, no build | Manual DOM handling |

**Decision: Vanilla JS + SVG**
- Single HTML file with embedded CSS/JS
- SVG for vector graphics (scalable, zoomable)
- Fetch from MCP server or local SQLite
- Can be served by a simple static server

### Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│                     WAREHOUSE VIEW                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │
│  │ PENDING │  │  READY  │  │ ACTIVE  │  │  DONE   │    │
│  │ Station │  │ Station │  │ Station │  │ Station │    │
│  │         │  │         │  │         │  │         │    │
│  │  [pkg]  │  │  [pkg]  │  │  [pkg]  │  │  [pkg]  │    │
│  │  [pkg]  │  │         │  │         │  │  [pkg]  │    │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │
│                                                         │
│  ← DAG dependency arrows between packages →             │
└─────────────────────────────────────────────────────────┘

Package = Node
- Color by type (requirement=blue, design=green, task=yellow, test=purple)
- Click to zoom/show details
- Arrows show parent_ids dependencies
```

### Components

1. **Data Loader** (`loadData()`)
   - Fetch nodes from local JSON file or API endpoint
   - Parse into JS objects

2. **Station Renderer** (`renderStations()`)
   - Create 4 station columns (pending, ready, active, done)
   - SVG rectangles with labels

3. **Package Renderer** (`renderPackages()`)
   - Position packages in their station
   - Color by type
   - Show slug as label

4. **Dependency Renderer** (`renderDependencies()`)
   - Draw arrows between packages based on parent_ids
   - Use SVG paths with arrowheads

5. **Interaction Handler** (`setupInteractions()`)
   - Click package → show detail panel
   - Zoom in/out (SVG viewBox manipulation)
   - Refresh button

### File Structure
```
viz/
├── index.html      # Single-file app (HTML + CSS + JS)
└── data.json       # Exported from SQLite (or fetched via API)
```

### Data Flow
1. Export mindspace_nodes to JSON
2. Load JSON in browser
3. Render visualization
4. Click refresh to reload

## DO

**Handoff to Dev Agent:**
1. Create `viz/index.html` with the architecture above
2. Create `viz/data.json` export script
3. Test locally with `python3 -m http.server 8080`

## STUDY

**QA Review: 2026-02-03**

### Implementation Assessment
- **Tech stack:** Vanilla JS + SVG as planned (single HTML file, 698 lines)
- **Architecture:** Matches PDSA design exactly
- **Files delivered:**
  - `viz/index.html` - main visualization (19,630 bytes)
  - `viz/export-data.js` - data export script (ES modules)
  - `viz/data.json` - exported node data

### Quality Gate Results

| Gate | Status | Evidence |
|------|--------|----------|
| Single HTML file works standalone | PASS | 19,630 bytes served at localhost:8080 |
| All 4 stations visible | PASS | pending/ready/active/done columns in renderStations() |
| Packages positioned in correct stations | PASS | Groups by status, tested with 4 nodes |
| Dependency arrows visible | PASS | SVG curved paths with arrowheads |
| Click shows package details | PASS | showDetail() populates detail panel |
| Zoom works | PASS | +/- buttons, wheel zoom, pan support |
| Refresh reloads data | PASS | Refresh button calls loadData() |

### Acceptance Criteria Verification

| Criteria | Status |
|----------|--------|
| Web-accessible | PASS - localhost:8080 |
| Shows nodes as packages | PASS - colored boxes by type |
| Shows stations as areas | PASS - 4 columns |
| Can zoom into node details | PASS - zoom + click detail |
| Visualizes DAG dependencies | PASS - arrows + parent list |
| Real-time or refresh | PASS - refresh button |

### Observations
- Implementation exceeded expectations with professional styling
- Legend for package types included (bonus)
- Pan/drag functionality added (bonus)
- Mouse wheel zoom works (bonus)
- Stats bar shows counts (bonus)

## ACT

**Decision:** ACCEPT - All quality gates passed.

**MCP Status Updates:**
- `viz-impl`: done → completed
- `viz-test`: active → completed
- `viz-prototype-req`: ready → completed

**Next Steps:**
1. Consider adding more nodes to demonstrate DAG flow at scale
2. Could add filter by type feature in future iteration
3. Server can be stopped or kept running for demos

---

## Quality Gates for Dev

- [x] Single HTML file works standalone
- [x] All 4 stations visible
- [x] Packages positioned in correct stations
- [x] Dependency arrows visible
- [x] Click shows package details
- [x] Zoom works
- [x] Refresh reloads data
