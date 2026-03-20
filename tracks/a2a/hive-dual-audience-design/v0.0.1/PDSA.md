# PDSA: Hive Dual-Audience Landing Page

**Task:** hive-dual-audience-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-HB-001

## Problem

The Hive (hive.xpollination.earth) landing page needs to serve two audiences from one URL: agents (who need protocol endpoints) and humans (who need identity dashboard). Currently there is no landing page.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Client-side JS for login state toggle | Pre-login shows protocol text (static HTML). Post-login shows dashboard (JS-rendered). Simple, no SSR needed. |
| D2 | API key validation: POST to Hive /api/v1/agent-identity | Hive owns identity. Mindspace API is for tasks. Hive validates keys and returns agent profile. |
| D3 | Single-page design with two states | Pre-login: protocol docs + login form. Post-login: identity dashboard + agent status. No page navigation. |

### Pre-Login State (Agent + Human)

```
┌─────────────────────────────────────────────────┐
│ XPollination Hive                               │
│ The Shared Knowledge Brain                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  For Agents:                                    │
│  ┌─────────────────────────────────────────┐    │
│  │ Discovery: GET /.well-known/agent.json  │    │
│  │ Memory:    POST /api/v1/memory          │    │
│  │ Health:    GET /api/v1/health            │    │
│  │ Schema:    GET /schemas/digital-twin    │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ───────────── or ─────────────                 │
│                                                 │
│  For Humans:                                    │
│  ┌──────────────────────────────────┐           │
│  │ API Key: [________________]      │           │
│  │        [Connect to Hive]         │           │
│  └──────────────────────────────────┘           │
│                                                 │
│  Don't have a key? Register at Mindspace →      │
└─────────────────────────────────────────────────┘
```

### Post-Login State (Human Dashboard)

```
┌─────────────────────────────────────────────────┐
│ XPollination Hive          [Disconnect]         │
├─────────────────────────────────────────────────┤
│                                                 │
│  Welcome, Thomas Pichler                        │
│  Agent: agent-liaison | Role: liaison           │
│                                                 │
│  Projects:                                      │
│  ┌──────────────┐ ┌──────────────┐              │
│  │ mindspace    │ │ homepage     │              │
│  │ role: admin  │ │ role: editor │              │
│  └──────────────┘ └──────────────┘              │
│                                                 │
│  Recent Memory:                                 │
│  - "TASK active→approval: PDSA..." (2h ago)     │
│  - "Recovery protocol for..." (5h ago)          │
│                                                 │
│  Brain Health: ✓ Qdrant: 46 entries             │
└─────────────────────────────────────────────────┘
```

### API Endpoints Needed

1. `POST /api/v1/agent-identity` — Validate API key, return agent profile
   - Input: `{ api_key: string }`
   - Output: `{ agent_name, agent_id, role, projects: [{slug, role}], connected_at }`
   - Error: 401 if key invalid/revoked

2. `GET /api/v1/recent-memory?agent_id=X&limit=5` — Last N memories
   - Returns recent thoughts for this agent
   - Used for dashboard "Recent Memory" section

### Client-Side Logic

```javascript
// On page load: check localStorage for session
const session = localStorage.getItem('hive_session');
if (session) showDashboard(JSON.parse(session));
else showLanding();

// On "Connect to Hive" click
async function connect(apiKey) {
  const res = await fetch('/api/v1/agent-identity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey })
  });
  if (res.ok) {
    const profile = await res.json();
    localStorage.setItem('hive_session', JSON.stringify(profile));
    showDashboard(profile);
  } else {
    showError('Invalid API key');
  }
}
```

### Acceptance Criteria

- AC1: Landing page shows protocol endpoints for agents
- AC2: API key form validates and shows dashboard on success
- AC3: Dashboard shows agent name, role, projects
- AC4: Recent memory section shows last 5 thoughts
- AC5: Brain health status from /api/v1/health
- AC6: Disconnect clears session and returns to landing
- AC7: Responsive design (mobile-friendly)

### Test Plan

Tests in api/__tests__/hive-dual-audience.test.ts: landing HTML contains endpoints, POST /api/v1/agent-identity returns profile, invalid key returns 401, dashboard elements present.
