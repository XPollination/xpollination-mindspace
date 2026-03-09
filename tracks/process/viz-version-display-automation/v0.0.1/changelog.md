# Changelog: viz-version-display-automation v0.0.1

## Initial Design

- **Runtime version fetch**: On page load, fetch `/api/version` and populate `.viz-version` span
- **Remove hardcoded version**: Replace `v0.0.10` with empty span, populated by JS
- **Reuses existing infrastructure**: `/api/version` endpoint already exists and reads symlink
- **Zero maintenance**: Version display always correct after any deployment
- **Graceful degradation**: If fetch fails, span stays empty (non-critical UI element)
