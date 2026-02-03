# PDSA: Auto-Refresh Live Data

**Date:** 2026-02-03
**Node:** viz-auto-refresh-design (c1060cc5-753d-4251-95a0-14c41f5e7761)
**Type:** Design
**Status:** AWAITING REVIEW
**Requirement:** viz-auto-refresh

## PLAN

### Thomas's Requirement (verbatim)

> "ensure that the webpage shows latest information. i needed to refresh manually"

### Current State
- Static data loaded on page load
- Manual browser refresh needed to see changes
- No indication of data staleness

### Proposed State
- Data refreshes automatically
- No manual refresh needed
- Visual indicator when data updates

---

## Design: Refresh Mechanism Options

### Option A: Polling (RECOMMENDED for simplicity)
```
Browser ──────────────────────────────> Server
         GET /api/data every N seconds
```

**Pros:**
- Simple to implement
- Works with static file server
- No special server infrastructure

**Cons:**
- Slight delay (up to N seconds)
- Some wasted requests if no changes

### Option B: WebSocket
```
Browser <═══════════════════════════════> Server
         Persistent connection, push on change
```

**Pros:**
- Instant updates
- No wasted requests

**Cons:**
- Requires WebSocket server
- More complex implementation
- Connection management needed

### Option C: Server-Sent Events (SSE)
```
Browser <─────────────────────────────── Server
         Server pushes events on change
```

**Pros:**
- Simpler than WebSocket
- Built-in reconnection

**Cons:**
- One-way only
- Requires SSE server support

### Recommendation: **Polling** for initial implementation
- Simplest to implement
- Works with current static server
- Can upgrade to WebSocket later if needed

---

## Design: Polling Implementation

### Refresh Interval
- **5 seconds** (reasonable balance of freshness vs. load)
- Configurable via constant

### Smart Refresh (avoid unnecessary re-renders)
```javascript
let lastDataHash = null;

async function pollData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();

    // Hash the data to detect changes
    const newHash = JSON.stringify(data).length + data.node_count;

    if (newHash !== lastDataHash) {
      lastDataHash = newHash;
      updateVisualization(data);
      showUpdateIndicator();
    }
  } catch (error) {
    console.error('Poll failed:', error);
    showErrorIndicator();
  }
}

// Start polling
setInterval(pollData, 5000);
```

### Pause Polling When Tab Hidden
```javascript
let pollInterval;

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(pollInterval);
  } else {
    pollData(); // Immediate refresh
    pollInterval = setInterval(pollData, 5000);
  }
});
```

---

## Design: Update Indicator

### Visual Feedback Options

**Option A: Toast notification**
```
┌─────────────────────────────────────┐
│ ✓ Data updated                      │  ← appears briefly
└─────────────────────────────────────┘
```

**Option B: Subtle header indicator (RECOMMENDED)**
```
┌─────────────────────────────────────────────────────────────┐
│ [Project ▼]  🔍 Search...              ● Live  │
│                                            ↑                │
│                                     green dot = connected   │
└─────────────────────────────────────────────────────────────┘
```

**Option C: Last updated timestamp**
```
│ Updated: 2 seconds ago                                      │
```

### Implementation (Option B - Status indicator)
```html
<span id="live-indicator" class="live-indicator">
  <span class="live-dot"></span>
  <span class="live-text">Live</span>
</span>
```

```css
.live-indicator {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #888;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e; /* green = connected */
  animation: pulse 2s infinite;
}

.live-dot.error {
  background: #ef4444; /* red = error */
  animation: none;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Flash on Update
```javascript
function showUpdateIndicator() {
  const dot = document.querySelector('.live-dot');
  dot.classList.add('flash');
  setTimeout(() => dot.classList.remove('flash'), 500);
}
```

```css
.live-dot.flash {
  background: #60a5fa; /* blue flash on update */
  transform: scale(1.5);
  transition: all 0.2s;
}
```

---

## Design: Efficient Updates

### Diff-Based Rendering
Instead of re-rendering everything, update only changed nodes:

```javascript
function updateVisualization(newData) {
  const oldNodes = currentNodes;
  const newNodes = newData.nodes;

  // Find changes
  const added = newNodes.filter(n => !oldNodes.find(o => o.id === n.id));
  const removed = oldNodes.filter(o => !newNodes.find(n => n.id === o.id));
  const updated = newNodes.filter(n => {
    const old = oldNodes.find(o => o.id === n.id);
    return old && JSON.stringify(old) !== JSON.stringify(n);
  });

  // Apply changes
  added.forEach(addNode);
  removed.forEach(removeNode);
  updated.forEach(updateNode);

  currentNodes = newNodes;
}
```

---

## Acceptance Criteria

- [ ] Data refreshes automatically every 5 seconds
- [ ] No manual browser refresh needed
- [ ] Visual indicator shows "Live" status
- [ ] Indicator flashes/changes on data update
- [ ] Polling pauses when tab is hidden
- [ ] Error state shown if poll fails
- [ ] Selection state preserved across refreshes

---

## Questions for Thomas

1. **Refresh interval:** 5 seconds good, or faster/slower?
2. **Update indicator:** Status dot, toast, or timestamp?
3. **Update animation:** Flash changed nodes, or just update quietly?

---

## DO

(Awaiting Thomas review before implementation)

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-03-viz-auto-refresh-design.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-03-viz-auto-refresh-design.pdsa.md
