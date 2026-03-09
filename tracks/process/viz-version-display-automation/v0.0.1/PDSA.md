# PDSA: Automate Viz Version Display

**Task:** viz-version-display-automation
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The viz `index.html` has a hardcoded version string (`<span class="viz-version">v0.0.X</span>` at line 933) that must be manually updated each release. When v0.0.10 was deployed, the HTML still showed v0.0.9 because nobody updated the string. The `/api/version` endpoint correctly reads the symlink, but the UI header is static.

## Analysis

### Options considered

1. **Runtime fetch from /api/version** — On page load, fetch `/api/version` and populate the `.viz-version` span. Zero manual steps. Already infrastructure exists: `checkForUpdate()` at line 1875 already fetches this endpoint.
   - Pros: No build step, no release script changes, always correct, zero maintenance
   - Cons: Brief flash (empty or placeholder until fetch completes, ~50ms on localhost)

2. **Build-time sed in release script** — Add `sed` step to `new-version.sh` or copy script that updates the version string when creating a new version folder.
   - Pros: No runtime fetch, version in HTML source
   - Cons: Another manual/scripted step, can still be forgotten, couples to release process

3. **Service worker injection** — Over-engineered for a single span update.

**Decision: Option 1 (runtime fetch).** It fits the symlink-based deployment pattern (no build step), is self-correcting (always reads truth from server), and reuses existing infrastructure.

### Flash mitigation

Set the initial HTML span to a neutral placeholder like `v...` or empty string. The fetch completes in <50ms on localhost, so the flash is imperceptible.

## Design

### Change A: Add version fetch on page load

In `index.html`, add a function that runs on `DOMContentLoaded` (or in the existing init flow):

```javascript
// Populate version from server (eliminates hardcoded version)
async function loadVersion() {
  try {
    const res = await fetch('/api/version');
    const data = await res.json();
    if (data.version) {
      document.querySelector('.viz-version').textContent = data.version;
    }
  } catch (e) {
    // Keep placeholder on error — non-critical
  }
}
```

Call `loadVersion()` in the initialization sequence (alongside or before `checkForUpdate()`).

### Change B: Replace hardcoded version with placeholder

Change line 933 from:
```html
<span class="viz-version">v0.0.10</span>
```
to:
```html
<span class="viz-version"></span>
```

Empty span — populated by `loadVersion()` on page load. If the fetch fails, the span stays empty (acceptable degradation — the `/api/version` endpoint is on the same server).

### Change C: Apply to BOTH v0.0.10 directories

The change must be applied in both:
- `xpollination-mcp-server/viz/versions/v0.0.10/index.html` (PROD repo)
- `xpollination-mcp-server-test/viz/versions/v0.0.10/index.html` (TEST repo)

Since this is a fix to v0.0.10 (not a new version), it modifies the existing version in place.

### Files Changed

1. `xpollination-mcp-server/viz/versions/v0.0.10/index.html` — add `loadVersion()`, empty placeholder
2. `xpollination-mcp-server-test/viz/versions/v0.0.10/index.html` — same changes

### Testing

1. `.viz-version` span has no hardcoded version string (empty or placeholder)
2. `loadVersion()` function exists in index.html
3. `loadVersion()` fetches `/api/version`
4. `loadVersion()` sets `.viz-version` textContent from response
5. `loadVersion()` has try/catch error handling
6. `loadVersion()` is called during page initialization
7. After page load, the displayed version matches `/api/version` response
8. No hardcoded `v0.0.` string in the `.viz-version` span HTML
