# PDSA: Seed Knowledge Content from PLATFORM-001

**Task:** `kb-content-seeding`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Hierarchy nodes have empty `content_md` fields. The knowledge browser needs rich content for each node. PLATFORM-001 v0.0.7 (1035 lines, 11 parts) contains all the source material.

### Content Decomposition: PLATFORM-001 Parts → Nodes

**Principle: Each level owns its depth.** Mission says WHY, Capability says WHAT, Requirement says HOW. No duplication across levels.

#### Missions (WHY)

| Node ID | content_md source | Content focus |
|---------|------------------|---------------|
| mission-fair-attribution | Part 2 subsection | WHY: measurable collaboration, provenance chain, token distribution |
| mission-traversable-context | Part 1 | WHY: context at every level, graph architecture, two traversal paths |
| mission-agent-human-collab | Parts 4+6 subsections | WHY: work together without chaos, workflow lifecycle, roles |

#### Capabilities (WHAT)

| Node ID | content_md source | Content focus |
|---------|------------------|---------------|
| cap-task-engine | Part 3 | WHAT: DNA terminology, field categories, quality gates, operations |
| cap-auth | Part 7 | WHAT: API auth model, API keys, JWT, combined middleware |
| cap-agent-protocol | Part 8 | WHAT: A2A lifecycle, git operations, state machine integration |
| cap-quality | Part 6 | WHAT: Layer 1/2/3 hard gates, branch protection, status checks |
| cap-graph | Part 1 subsection | WHAT: graph structure, dependency traversal, what graph solves |
| cap-provenance | Part 2 subsection | WHAT: provenance chain mechanics, 6 steps, dual-check |
| cap-viz | Summary of viz features | WHAT: kanban, mission dashboard, hierarchy drilldown |
| cap-foundation | Part 5 + Part 10 | WHAT: git workflow, deployment pipeline, implementation sequence |
| cap-token | Part 2 subsection | WHAT: token economics, payout formula, value attribution |

#### Requirements (HOW — brief, not full Part content)

Requirements get 2-3 sentence descriptions of HOW the user interacts, not full Part content. Example: "REQ-AUTH-001: Users register via email+password or Google OAuth, receive JWT tokens valid for 24h."

### Migration: `053-seed-knowledge-content.sql`

```sql
-- Seed content_md for each hierarchy node
-- Source: PLATFORM-001 v0.0.7 (document.md)
-- Each UPDATE sets content_md and content_version = 1

UPDATE missions SET content_md = '...extracted markdown...', content_version = 1
WHERE id = 'mission-fair-attribution';

-- ... repeat for each node
```

### Implementation Approach

1. **Script, not hand-written SQL**: A Node.js script reads PLATFORM-001 document.md, extracts sections by heading, generates UPDATE statements
2. **OR manual extraction**: DEV reads document.md, copies relevant sections, wraps in SQL UPDATE statements
3. **Recommended**: Manual extraction for precision — each node needs curated content, not a raw dump

### Content Guidelines

- **Markdown format**: Headers, lists, code blocks, tables from source document
- **No frontmatter**: Pure markdown, no YAML headers
- **Relative SVG paths**: Keep `![alt](filename.svg)` as-is — the server will resolve them
- **No duplication**: If Part 1 covers both mission and capability concepts, split them by level

## Do

DEV creates `api/db/migrations/053-seed-knowledge-content.sql` with UPDATE statements for each node's content_md, extracted from PLATFORM-001 v0.0.7.

## Study

Verify:
- Each mission has content_md with WHY focus
- Each capability has content_md with WHAT focus
- Each requirement has brief HOW description
- `SELECT id, length(content_md) FROM missions WHERE content_md IS NOT NULL` shows all non-null
- No content duplication across levels
- content_version = 1 for all seeded nodes

## Act

### Design Decisions
1. **SQL migration**: Content is data, stored in DB. Migration ensures reproducibility.
2. **Manual extraction over automated**: Curated content > raw section dumps. Each node needs editorial judgment about what belongs at its level.
3. **content_version = 1**: First version. Future edits increment.
4. **No history entry for seed**: Initial seed doesn't create node_content_history rows — that's for future edits only.
