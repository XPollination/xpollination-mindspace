# PDSA: Dual Links in Visualization Detail Panel

**Date:** 2026-02-04
**Node:** viz-dual-links-detail-panel (91d03484-575e-42b6-ae36-eea670d52b3c)
**Type:** Task
**Status:** ACTIVE

## PLAN

### Objective

Add dual format links (Git URL + Workspace path) to the detail panel, below the Children section.

### What is "Dual Links"?

From Thomas's clarification (2026-02-03):
> "clickable links to git (for humans) and workspace paths (for agents direct access)"

**Dual links = two reference formats:**
1. **Git URL (for humans):** `https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/file.pdsa.md`
2. **Workspace path (for agents):** `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/file.pdsa.md`

### Current State

- Detail panel shows: title, slug, type, status, parents, children, description
- No dual links section exists

### Proposed Design

```
┌───────────────────────────────────────────┐
│ Package Details                           │
├───────────────────────────────────────────┤
│ Title: Self-Contained DNA                 │
│ Slug: design-self-contained-dna           │
│ ...                                       │
│                                           │
│ ↓ Children (2):                           │
│   • impl-task-1 [→]                       │
│   • test-task-1 [→]                       │
│                                           │
│ 🔗 Dual Links:                            │  ← NEW SECTION
│   Git:  [View on GitHub]                  │  ← clickable
│   Path: /home/.../file.pdsa.md            │  ← copyable
│                                           │
│ Description:                              │
│ ...                                       │
└───────────────────────────────────────────┘
```

---

## DO (Findings)

### Source of Dual Links

Dual links can come from:
1. `dna.pdsa_ref` - if node has explicit pdsa_ref field
2. Derived from slug - construct path based on node type and slug

### Derivation Logic

```javascript
function getDualLinks(node) {
  // If explicit pdsa_ref exists, use it
  if (node.dna.pdsa_ref) {
    return node.dna.pdsa_ref;
  }

  // Otherwise derive from node metadata
  const project = node.dna.project || 'xpollination-mcp-server';
  const slug = node.slug;
  const date = node.created_at.slice(0, 10); // YYYY-MM-DD

  const filename = `${date}-${slug}.pdsa.md`;
  const workspace = `/home/developer/workspaces/github/PichlerThomas/${project}/docs/pdsa/${filename}`;
  const git = `https://github.com/PichlerThomas/${project}/blob/main/docs/pdsa/${filename}`;

  return { git, workspace };
}
```

### Implementation Location

File: `viz/index.html`
Function: `showDetail(node)` - add section after Children

### HTML Template

```html
<div class="detail-field dual-links">
  <label>🔗 Dual Links</label>
  <div class="dual-link-item">
    <span class="link-label">Git:</span>
    <a href="${gitUrl}" target="_blank">[View on GitHub]</a>
  </div>
  <div class="dual-link-item">
    <span class="link-label">Path:</span>
    <code class="copyable">${workspacePath}</code>
  </div>
</div>
```

### CSS

```css
.dual-links .dual-link-item {
  display: flex;
  gap: 8px;
  margin: 4px 0;
}
.dual-links .link-label {
  color: #888;
  min-width: 40px;
}
.dual-links code.copyable {
  font-size: 0.85em;
  color: #60a5fa;
  cursor: pointer;
}
```

---

## STUDY

### Acceptance Criteria Status

- [ ] Dual links section appears below Children section
- [ ] Shows Git URL as clickable link
- [ ] Shows Workspace path
- [ ] Only shown if node has pdsa_ref or can be derived

---

## ACT

### Handoff to Dev

Implement dual links section in `viz/index.html`:
1. Add `getDualLinks(node)` helper
2. Add HTML section in `showDetail()`
3. Add CSS for styling

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-04-viz-dual-links-detail-panel.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-04-viz-dual-links-detail-panel.pdsa.md
