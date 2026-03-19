# PDSA: Knowledge Browser Page — Render Node Content

**Task:** `kb-render-page`
**Version:** v0.0.1
**Status:** Design

## Plan

### Page Structure

```
┌──────────────────────────────────────────────┐
│ [Mission] Traversable Context                │  ← type badge + title
│ Mindspace > Traversable Context              │  ← breadcrumb
├──────────────────────────────────────────────┤
│                                              │
│  ## Why This Matters                         │
│  On 2026-03-17, agents caused chaos...       │  ← rendered markdown
│  [full content from content_md]              │
│                                              │
├──────────────────────────────────────────────┤
│ Capabilities (3)                             │  ← children section
│ ┌─────────────┐ ┌─────────────┐             │
│ │ CAP-TASK-   │ │ CAP-GRAPH   │             │  ← child cards
│ │ ENGINE      │ │ Traversable │             │
│ │ Workflow... │ │ context...  │             │
│ └─────────────┘ └─────────────┘             │
├──────────────────────────────────────────────┤
│ 94 tasks · 88 complete · v0.0.7             │  ← metadata footer
└──────────────────────────────────────────────┘
```

### HTML Template: `renderNodePage(typePrefix, node, children, metadata)`

**Head:**
- `<title>` = `{title} — Mindspace Knowledge Browser`
- Open Graph: `og:title`, `og:description` (first 200 chars of content_md)
- `<link>` to marked.js CDN (already in viz) and highlight.js for code blocks
- CSS inline (dark theme matching viz)

**Body sections:**
1. **Type badge**: Colored pill — Mission (purple), Capability (blue), Requirement (green)
2. **Title**: `<h1>{title}</h1>`
3. **Breadcrumb**: `Project > Mission > Capability > Requirement` with each segment linked via `/m/{short_id}/{slug}` pattern
4. **Content**: `marked.parse(node.content_md)` — renders markdown to HTML
5. **Children**: Grid of cards, each with title + first 100 chars of description + link
6. **Metadata footer**: Task count, completion %, content version

### Children Queries

```javascript
function getChildren(typePrefix, nodeId, db) {
  switch (typePrefix) {
    case 'm': // Mission → Capabilities
      return db.prepare(`
        SELECT c.*, c.short_id FROM capabilities c
        WHERE c.mission_id = ? ORDER BY c.sort_order
      `).all(nodeId);
    case 'c': // Capability → Requirements
      return db.prepare(`
        SELECT r.*, r.short_id FROM requirements r
        WHERE r.capability_id = ? ORDER BY r.req_id_human
      `).all(nodeId);
    case 'r': // Requirement → Tasks (via dna_json LIKE)
      return db.prepare(`
        SELECT slug, json_extract(dna_json, '$.title') as title,
               status, json_extract(dna_json, '$.role') as role
        FROM mindspace_nodes
        WHERE type = 'task' AND dna_json LIKE '%' || ? || '%'
        ORDER BY status, slug
      `).all(node.req_id_human);
    default: return [];
  }
}
```

### CSS (inline, dark theme)

```css
:root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #c9d1d9; --accent: #e94560; }
body { background: var(--bg); color: var(--text); font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }
.badge-mission { background: #7c3aed; } .badge-capability { background: #2563eb; } .badge-requirement { background: #16a34a; }
.badge { display: inline-block; padding: 4px 12px; border-radius: 12px; color: white; font-size: 12px; font-weight: 600; }
.breadcrumb a { color: #58a6ff; text-decoration: none; } .breadcrumb a:hover { text-decoration: underline; }
.content { line-height: 1.7; } .content h2, .content h3 { color: #e6edf3; margin-top: 1.5em; }
.content code { background: #1f2937; padding: 2px 6px; border-radius: 4px; }
.content pre { background: #1f2937; padding: 16px; border-radius: 8px; overflow-x: auto; }
.content table { border-collapse: collapse; width: 100%; } .content th, .content td { border: 1px solid var(--border); padding: 8px 12px; }
.children-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
.child-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
.child-card:hover { border-color: var(--accent); } .child-card a { color: #58a6ff; text-decoration: none; }
.metadata { color: #8b949e; font-size: 14px; margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--border); }
```

### marked.js Integration

Use CDN `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js">` — already pattern in viz. Server-side rendering: generate `<div class="content">${markedContent}</div>` where `markedContent` is the pre-rendered HTML from `marked.parse()`.

**Alternative (server-side):** Since viz/server.js is Node.js, use `marked` npm package (already in dependencies) to render server-side. No client-side JS needed for basic rendering. Highlight.js can be added as `<script>` for code block styling.

## Do

DEV modifies `viz/server.js`:
1. Update `renderNodePage()` (from kb-url-routing) with the full template
2. Add `getChildren()` function
3. Add CSS inline in template
4. Use marked.parse() for server-side markdown rendering

## Study

Verify (browser):
- `/m/{short_id}` renders mission page with full content
- Content markdown renders correctly (headers, lists, tables, code blocks)
- Children cards link to child nodes
- Breadcrumb navigates correctly
- Mobile-responsive layout
- Code blocks have monospace font and background

## Act

### Design Decisions
1. **Server-side rendering**: marked.parse() runs on server, sends full HTML. No client-side JS needed for content viewing.
2. **Inline CSS**: One file, no external stylesheet dependency. Keeps deployment simple.
3. **Children as cards**: Visual hierarchy — click to drill deeper.
4. **Dark theme**: Matches viz dashboard. Consistent brand.
5. **CDN highlight.js**: Optional enhancement for code blocks. Page works without it.
