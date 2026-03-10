# Changelog: ms-a11-8-central-skill

## v0.0.1 — Initial Design

- PDSA design for central agent connect skill (/xpo.agent.connect/)
- Role extraction from invocation suffix (.pdsa, .dev, .qa, .liaison)
- 8-step bootstrap: role → discover → twin → connect → SSE → heartbeat → handler → disconnect
- Client-side only — uses existing A2A endpoints (Agent Card, connect, stream, message)
- 1 file: skills/xpo.agent.connect/SKILL.md (NEW)
- 14 test cases
