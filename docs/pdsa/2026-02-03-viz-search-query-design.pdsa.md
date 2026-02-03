# PDSA: Search Query for Object Details

**Date:** 2026-02-03
**Node:** viz-search-query-design (2529c907-b909-42f9-a5b3-2c6cd5f92ba5)
**Type:** Design
**Status:** AWAITING REVIEW
**Requirement:** viz-search-query

## PLAN

### Thomas's Requirement (verbatim)

> "a search query on the page as well so i can search for any field in 'object details'"

### Current State
- No search functionality
- Must scroll/browse to find nodes
- Detail panel shows info but no way to search across nodes

### Proposed State
- Search input on page
- Real-time filtering as user types
- Searches ALL fields in object DNA (title, description, acceptance_criteria, etc.)

---

## Design: Search UI

### Placement Options

**Option A: Header (next to project dropdown)**
```
┌──────────────────────────────────────────────────────────────┐
│ [Project Dropdown ▼]     🔍 [Search nodes...]          │
└──────────────────────────────────────────────────────────────┘
```

**Option B: Above node list/stations (RECOMMENDED)**
```
┌──────────────────────────────────────────────────────────────┐
│ [Project Dropdown ▼]                                         │
├──────────────────────────────────────────────────────────────┤
│ 🔍 [Search nodes...]                                         │
├──────────────────────────────────────────────────────────────┤
│   STATIONS / QUEUE / COMPLETED                               │
```

### HTML Structure
```html
<div class="search-container">
  <input type="text"
         id="node-search"
         placeholder="Search nodes..."
         class="search-input">
  <span class="search-results-count"></span>
</div>
```

### CSS
```css
.search-container {
  padding: 10px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

.search-input {
  width: 100%;
  padding: 10px 15px;
  background: #1a1a2e;
  border: 1px solid #0f3460;
  color: #eee;
  font-size: 1em;
  border-radius: 4px;
}

.search-input:focus {
  border-color: #e94560;
  outline: none;
}

.search-results-count {
  color: #888;
  font-size: 0.9em;
  margin-top: 5px;
  display: block;
}
```

---

## Design: Search Logic

### Searchable Fields
All fields in node DNA:
- `title`
- `description`
- `slug`
- `acceptance_criteria` (array → joined text)
- `thomas_feedback` (nested → stringified)
- Any other DNA fields

### Search Algorithm
```javascript
function searchNodes(query, nodes) {
  if (!query.trim()) return nodes; // Show all if empty

  const lowerQuery = query.toLowerCase();

  return nodes.filter(node => {
    // Search in slug
    if (node.slug.toLowerCase().includes(lowerQuery)) return true;

    // Search in DNA fields
    const dna = node.dna || {};
    const searchableText = JSON.stringify(dna).toLowerCase();
    return searchableText.includes(lowerQuery);
  });
}
```

### Real-Time Filtering
```javascript
const searchInput = document.getElementById('node-search');
let debounceTimer;

searchInput.oninput = (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = e.target.value;
    const filtered = searchNodes(query, allNodes);

    // Update display
    renderNodes(filtered);
    updateResultsCount(filtered.length, allNodes.length);
  }, 150); // Debounce 150ms
};
```

---

## Design: Results Display

### Option A: Filter nodes (hide non-matching)
- Only matching nodes visible
- Clear search to see all again
- Simple but loses context

### Option B: Highlight matching (RECOMMENDED)
- All nodes visible
- Matching nodes highlighted
- Non-matching nodes dimmed
- User keeps context of full graph

### Implementation (Option B)
```javascript
function renderWithHighlight(query, nodes) {
  const matchingIds = searchNodes(query, nodes).map(n => n.id);

  nodes.forEach(node => {
    const el = document.querySelector(`.package[data-id="${node.id}"]`);
    if (el) {
      if (!query || matchingIds.includes(node.id)) {
        el.classList.remove('dimmed');
        el.classList.add('search-match');
      } else {
        el.classList.add('dimmed');
        el.classList.remove('search-match');
      }
    }
  });
}
```

### CSS for highlighting
```css
.package.dimmed {
  opacity: 0.3;
}

.package.search-match {
  border-color: #60a5fa;
  box-shadow: 0 0 8px rgba(96, 165, 250, 0.4);
}
```

---

## Acceptance Criteria

- [ ] Search input visible above stations/queue
- [ ] Real-time filtering as user types (debounced)
- [ ] Searches all DNA fields (title, description, criteria, etc.)
- [ ] Matching nodes highlighted, non-matching dimmed
- [ ] Results count shown (e.g., "5 of 32 nodes")
- [ ] Empty search shows all nodes (no filter)
- [ ] Search is case-insensitive

---

## Questions for Thomas

1. **Search placement:** Header or above stations?
2. **Display mode:** Filter (hide non-matching) or highlight (dim non-matching)?
3. **Search in detail panel:** Also search/highlight in detail panel text?

---

## DO

(Awaiting Thomas review before implementation)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-viz-search-query-design.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-viz-search-query-design.pdsa.md
