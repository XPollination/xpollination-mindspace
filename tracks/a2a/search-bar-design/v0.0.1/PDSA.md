# PDSA: Vector Search Bar in Viz Header

**Task:** search-bar-design | **Version:** v0.0.1 | **Requirement:** REQ-VKF-005

## Design Decisions
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Always-visible in header, brain vector search | Instant access. Leverages existing Qdrant vectors. |
| D2 | Results overlay dropdown (not full page) | Keeps context. Dismiss on click-away. |

## Layout
Header search input → debounce 300ms → POST /api/v1/memory (read_only) → overlay with type badges + 120-char previews → click navigates to /m/{id} or /c/{id}.

## Acceptance Criteria
- AC1: Search input in header, AC2: Vector results with type badges, AC3: Click navigates, AC4: Debounce, AC5: Empty state message
