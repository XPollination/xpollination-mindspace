# PDSA: Register Capability Seed Vectors in Brain

**Task:** `graph-capability-brain-vectors`
**Version:** v0.0.1
**Status:** Design

## Plan

Contribute 9 seed thoughts to Brain (Qdrant) — one per PLATFORM-001 capability. Enables semantic discovery: "I need authentication" → CAP-AUTH.

### Approach

Use Brain API (`POST /api/v1/memory`) to contribute each capability as a thought. Each thought:
- `thought_category`: `design_decision`
- `topic`: `capability-seed`
- `context`: capability ID
- Content: rich description of what the capability solves, keywords, use cases

### Script: `scripts/seed-capability-vectors.js`

A Node.js script that:
1. Iterates over the 9 capabilities
2. Contributes each to Brain via API
3. Verifies with 2 test queries:
   - "I need authentication" → should return CAP-AUTH
   - "I need task workflow" → should return CAP-TASK-ENGINE

### Seed Thoughts Content

Each thought follows this template:
```
Capability: {CAP-ID} — {Title}
Version: v1.0 (initial seed)
Mission: {primary mission}
Solves: {problem description in natural language}
Keywords: {comma-separated search terms}
```

| Cap ID | Seed Content Summary |
|--------|---------------------|
| cap-auth | Authentication, login, registration, JWT, sessions, invite, access control |
| cap-task-engine | Workflow state machine, transitions, PDSA gates, DNA objects, task lifecycle |
| cap-agent-protocol | Agent monitor, wake-up, recovery, brain memory, continuity, A2A |
| cap-foundation | Database, server, deployment, migrations, versioning, infrastructure |
| cap-quality | Test gates, version bump, PDSA review, QA process, liaison approval |
| cap-graph | Traversable context, hierarchy, mission-to-task navigation, graph nodes |
| cap-viz | Dashboard, kanban, hierarchy view, drill-down, agent status bar |
| cap-provenance | Authorship tracking, contribution history, change attribution, audit |
| cap-token | Token economics, value attribution, collaboration rewards |

### Brain API Call Pattern

```bash
curl -s -X POST ${BRAIN_API_URL}/api/v1/memory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d '{
    "prompt": "Capability: CAP-AUTH — Authentication and Access Control\nVersion: v1.0\nMission: Agent-Human Collaboration\nSolves: Users need to register, login, manage sessions. Projects need invite-based access control with role permissions.\nKeywords: authentication, login, registration, JWT, session, invite, access control, password, OAuth",
    "agent_id": "system",
    "agent_name": "System",
    "session_id": "capability-seed-session",
    "context": "capability: cap-auth",
    "thought_category": "design_decision",
    "topic": "capability-seed"
  }'
```

## Do

DEV creates `scripts/seed-capability-vectors.js` that:
1. Reads capability data (hardcoded or from DB)
2. Calls Brain API 9 times
3. Runs 2 verification queries
4. Outputs results

## Study

Verify:
- "I need authentication" query returns CAP-AUTH in top results
- "I need task workflow" query returns CAP-TASK-ENGINE in top results
- 9 thoughts contributed with correct category/topic
- Script is idempotent (Brain handles duplicate contributions)

## Act

### Design Decisions
1. **Script, not migration**: Brain vectors are not in SQLite. A script talks to the Brain API.
2. **thought_category = design_decision**: Capabilities are design decisions about what the platform does.
3. **topic = capability-seed**: Enables filtering seed vectors from operational thoughts.
4. **Rich natural language**: Descriptions use natural language + keywords so vector search matches varied queries.
5. **Idempotent**: Brain's similarity detection prevents exact duplicates. Re-running is safe.
