# Use Case: XPollination Homepage Content Pipeline

**Status:** Secondary - Implementation Started
**Original PDCA:** `HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/xpollination-homepage/2026-01-28-UTC-1400.00-main-xpollination-homepage.pdca.md`

---

## Overview

AI-generated blog content pipeline for xpollination.earth with fact-checking and user approval gates.

## Flow

```
1. crawl_trends(frames) → trending_topics
2. propose_topic(trending_topics) → proposals
3. [USER GATE: select topic, add framing]
4. write_draft(approved_proposal) → draft
5. fact_check(draft) → verification_report
6. IF fail: improve_draft(draft, issues) → goto 5
7. [USER GATE: approve/reject]
8. publish_post(final_draft) → deployed to Hugo site
```

## MCP Tools (Implemented)

- `create_frame` - Define topic frame with keywords
- `list_frames` - List active frames
- `crawl_trends` - Monitor RSS for frame matches
- `propose_topic` - Generate content proposals
- `write_draft` - Create draft content
- `fact_check` - Verify claims
- `improve_draft` - Iterate on issues
- `publish_post` - Commit to Hugo/Git

## First Frame: Fourth Temple

**Concept:**
- 1st Temple → Solomon's (physical)
- 2nd Temple → Herod's (physical)
- 3rd Temple → We humans (body as temple)
- 4th Temple → Collective temple Christians must build

**Keywords:** Christianity, Freikirche, spiritual transformation, servant leadership, ecclesia, metanoia

**Audience:** Christians interested in deeper ecclesiology

## Infrastructure

- Hugo static site at xpollination.earth
- GitHub Actions for deployment
- Hetzner CX22 hosting

---

**Note:** This use case shares the MCP Server infrastructure with the agent-development-framework use case. Content pipeline tools are already implemented; development pipeline tools are in design.
