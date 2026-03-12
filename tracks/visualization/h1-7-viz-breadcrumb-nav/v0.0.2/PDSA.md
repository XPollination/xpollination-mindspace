# PDSA: Viz Breadcrumb Navigation — Implementation

**Task:** `h1-7-viz-breadcrumb-nav`
**Version:** v0.0.2
**Date:** 2026-03-12
**Author:** DEV agent

---

## Implementation

### Server Changes (viz/server.js + viz/versions/v0.0.23/server.js)

1. **GET /api/tasks/:slug** — New endpoint returning task DNA summary + parent hierarchy
   - Queries `mindspace_nodes` for task by slug
   - Joins `capability_tasks → capabilities → missions` for breadcrumb path
   - Returns: slug, title, status, role, description, depends_on, pdsa_ref, group
   - Returns: `breadcrumb` array, `parent_capability`, `parent_mission`

2. **GET /api/capabilities/:capId** — Added mission context
   - Now includes `mission_id` and `mission_title` in response
   - Enables breadcrumb construction without extra fetch

### Client Changes (viz/versions/v0.0.23/index.html)

1. **Breadcrumb CSS** — `.breadcrumb-bar`, `.breadcrumb-segment`, `.breadcrumb-separator`, `.breadcrumb-segment.active`
2. **navStack** — Array-based navigation state: `[{level, id, title}, ...]`
3. **renderBreadcrumb()** — Builds breadcrumb HTML from navStack
4. **navigateTo(level, id)** — Clickable breadcrumb segments navigate up hierarchy
5. **showCapabilityDetail(capId)** — Updated: pushes to navStack, renders breadcrumb, removed Back button, tasks are clickable
6. **showTaskDetail(slug)** — New: fetches /api/tasks/:slug, renders DNA summary, pushes to navStack
7. **hideDetail()** — Updated: resets navStack

### Version

- Created `viz/versions/v0.0.23/` from v0.0.22 base
- Updated `viz/active` symlink to v0.0.23

## Files Changed

| File | Change |
|------|--------|
| `viz/server.js` | /api/tasks/:slug endpoint, mission context in capability response |
| `viz/versions/v0.0.23/server.js` | Copy with same changes |
| `viz/versions/v0.0.23/index.html` | Breadcrumb bar, navStack, navigateTo, showTaskDetail, updated showCapabilityDetail |
| `viz/versions/v0.0.23/changelog.json` | Version metadata |
| `viz/active` | Symlink → versions/v0.0.23 |

## Verification

- 14/14 TDD tests pass (`viz/h1-7-viz-breadcrumb-nav.test.ts`)
- All existing viz tests remain passing
