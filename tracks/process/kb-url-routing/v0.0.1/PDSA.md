# PDSA: Server URL Routing for Knowledge Browser

**Task:** `kb-url-routing`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Hierarchy nodes (missions, capabilities, requirements) need human-readable, shareable URLs. Currently they're only accessible via API endpoints.

### URL Pattern
```
/{type_prefix}/{short_id}/{optional-slug}
```

| Prefix | Type | Table | Example |
|--------|------|-------|---------|
| `/m/` | Mission | missions | `/m/a7Bk3xQ9/fair-attribution` |
| `/c/` | Capability | capabilities | `/c/Xn2pR4kL/cap-auth` |
| `/r/` | Requirement | requirements | `/r/mQ8wY1zP/req-auth-001` |
| `/t/` | Task | mindscape_nodes | `/t/vK5jN9cD/ms-auth-e2e-design` (future) |

**Slug is decorative** — router uses ONLY `short_id` for lookup. This means URLs work even if titles change.

### Route Handler Logic (viz/server.js)

```javascript
// Pattern: /{prefix}/{shortId}[/{slug}][.md]
// Matches: /m/a7Bk3xQ9, /m/a7Bk3xQ9/fair-attribution, /m/a7Bk3xQ9.md

const KB_ROUTE = /^\/(m|c|r|t)\/([a-zA-Z0-9]{8})(\/[^.]*)?(?:\.md)?$/;

function handleKbRoute(req, res) {
  const match = req.url.match(KB_ROUTE);
  if (!match) return false;

  const [, typePrefix, shortId] = match;
  const wantMarkdown = req.url.endsWith('.md');

  // Map prefix to table and query
  const queries = {
    m: 'SELECT * FROM missions WHERE short_id = ?',
    c: `SELECT c.*, m.title as mission_title, m.short_id as mission_short_id
         FROM capabilities c JOIN missions m ON c.mission_id = m.id
         WHERE c.short_id = ?`,
    r: `SELECT r.*, c.title as capability_title, c.short_id as capability_short_id,
               m.title as mission_title, m.short_id as mission_short_id
         FROM requirements r
         JOIN capabilities c ON r.capability_id = c.id
         JOIN missions m ON c.mission_id = m.id
         WHERE r.short_id = ?`,
    t: null // Future: query mindspace_nodes by short_id
  };

  const sql = queries[typePrefix];
  if (!sql) { send404(res); return true; }

  const node = db.prepare(sql).get(shortId);
  if (!node) { send404(res, shortId); return true; }

  if (wantMarkdown) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(node.content_md || '# No content yet');
    return true;
  }

  // Render HTML page
  const html = renderNodePage(typePrefix, node);
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache'
  });
  res.end(html);
  return true;
}
```

### HTML Template

Minimal page with:
- `<title>` and Open Graph meta tags for link previews
- Breadcrumb navigation (Mission > Capability > Requirement)
- `content_md` rendered to HTML (using a simple markdown-to-HTML function or raw display)
- Back link to parent node
- CSS matching viz theme (dark background, accent colors)

### 404 Page

```html
<h1>Node Not Found</h1>
<p>No node with ID <code>{shortId}</code> exists.</p>
<p><a href="/">Return to Dashboard</a></p>
```

### Database Access

The viz server.js already opens the API database (mindspace.db) for hierarchy queries (from viz-hierarchy-data-layer task). The KB routes reuse the same connection.

## Do

DEV adds to viz/server.js:
1. `KB_ROUTE` regex pattern
2. `handleKbRoute()` function with table queries
3. `renderNodePage()` HTML template function
4. `send404()` for unknown short_ids
5. Insert route handler before the static file fallback

## Study

Verify:
- `curl /m/{short_id}` returns HTML with mission title
- `curl /m/{short_id}/any-slug` returns same page (slug ignored)
- `curl /m/{short_id}.md` returns plain text markdown
- `curl /m/nonexistent` returns 404
- Open Graph meta tags present in HTML response
- Breadcrumb shows correct hierarchy path

## Act

### Design Decisions
1. **Short ID only lookup**: Slug is decorative — prevents broken links when titles change.
2. **Regex routing**: Single regex handles all 4 type prefixes + optional slug + .md suffix.
3. **JOINs for context**: Capability query JOINs missions for breadcrumb. Requirement JOINs both.
4. **No client-side rendering**: Server renders full HTML page. No JavaScript required for basic viewing.
5. **`.md` suffix**: Returns raw markdown for programmatic access (curl, scripts, API consumers).
