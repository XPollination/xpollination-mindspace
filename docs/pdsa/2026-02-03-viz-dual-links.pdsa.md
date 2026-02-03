# PDSA: Clickable Dual Links in Visualization

**Date:** 2026-02-03
**Node:** viz-dual-links (ACTIVE)
**Type:** Design

## PLAN

### Objective
Add clickable navigation links to the package detail panel showing both parent and child relationships.

### Current Behavior
- Detail panel shows "Dependencies" with parent slugs
- Links are text-only, not clickable
- No child links shown

### Proposed Behavior
```
┌───────────────────────────────┐
│ Package Details               │
├───────────────────────────────┤
│ Title: Design Viz Architecture│
│ Slug: viz-design              │
│ Type: design                  │
│ Status: completed             │
│                               │
│ ↑ Parents (1):                │
│   • viz-prototype-req [→]     │  ← clickable
│                               │
│ ↓ Children (2):               │
│   • viz-impl [→]              │  ← clickable
│   • viz-test [→]              │  ← clickable
│                               │
│ Description:                  │
│ Design the visualization...   │
└───────────────────────────────┘
```

### Implementation Design

#### 1. Data Enhancement
Current `parent_ids` provides upstream links. Need to compute `children` at render time:
```javascript
function getChildren(nodeId, allNodes) {
  return allNodes.filter(n =>
    n.parent_ids && n.parent_ids.includes(nodeId)
  );
}
```

#### 2. Detail Panel Update
Modify `showDetail(node)` function:
```javascript
function showDetail(node) {
  // Get parent nodes
  const parents = (node.parent_ids || []).map(pid =>
    nodes.find(n => n.id === pid)
  ).filter(Boolean);

  // Get child nodes
  const children = nodes.filter(n =>
    n.parent_ids && n.parent_ids.includes(node.id)
  );

  // Render with clickable links
  detailContent.innerHTML = `
    ...existing fields...

    <div class="detail-field">
      <label>↑ Parents (${parents.length})</label>
      ${parents.length > 0
        ? `<ul class="node-links">${parents.map(p =>
            `<li data-id="${p.id}" class="clickable">${p.slug}</li>`
          ).join('')}</ul>`
        : '<div class="value">None (root node)</div>'}
    </div>

    <div class="detail-field">
      <label>↓ Children (${children.length})</label>
      ${children.length > 0
        ? `<ul class="node-links">${children.map(c =>
            `<li data-id="${c.id}" class="clickable">${c.slug}</li>`
          ).join('')}</ul>`
        : '<div class="value">None (leaf node)</div>'}
    </div>
  `;

  // Add click handlers
  detailContent.querySelectorAll('.clickable').forEach(el => {
    el.onclick = () => {
      const targetNode = nodes.find(n => n.id === el.dataset.id);
      if (targetNode) showDetail(targetNode);
    };
  });
}
```

#### 3. CSS Additions
```css
.node-links li.clickable {
  cursor: pointer;
  color: #60a5fa;
}

.node-links li.clickable:hover {
  color: #e94560;
  text-decoration: underline;
}
```

### Acceptance Criteria
- [ ] Parents section shows clickable parent node slugs
- [ ] Children section shows clickable child node slugs
- [ ] Clicking a link updates detail panel to that node
- [ ] Root nodes show "None (root node)" for parents
- [ ] Leaf nodes show "None (leaf node)" for children
- [ ] Link count shown in section header

## DO

### Handoff to Dev Agent
Implement the above changes in `viz/index.html`:
1. Add `getChildren()` helper function
2. Modify `showDetail()` to include parents and children sections
3. Add click handlers for navigation
4. Add CSS for clickable links

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)
