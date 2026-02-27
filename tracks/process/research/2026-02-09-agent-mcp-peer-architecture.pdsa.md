# PDSA: Cell-Based Agent Architecture — Push-Driven Multi-Agent Coordination

**Date:** 2026-02-09
**Type:** Design (Deep Architecture)
**Status:** DRAFT — Awaiting Thomas Review
**Author:** Liaison
**Supersedes:** Previous research draft of same date

---

## PLAN

### Thomas's Requirements (verbatim)

> "investigate a peer to peer structure. i want agents logon to the mcp server in a defined way. they need to exchange objects. its true object orientation where we are heading. the DNA is not supposed to be stored in a database. it is in a cell."

> "can we create programmatically a notifier, once the acceptance criterias have been reached, that sends a message to the agent that was 'logging in' to the server in a specific role?"

> "the process only works if (currently) 4 roles have logged into the mcp server that handles notification. no monitoring needed."

> "its the extension of me in the digital space, privacy protected as i am only using the agents capabilities."

> "in future the owner holds on to the data and grants corresponding access to the agents that are working on the tasks."

> "Cells can be serialized to disk for persistence, then reloaded on restart and reassociated with agents — that shows me exactly that you understood it!"

### Problem Statement

The current multi-agent system has three fundamental flaws:

1. **Database-centric model**: Agents query a relational database (`mindspace_nodes` table), interpret rows, and decide actions. The database is the architecture, not an implementation detail.

2. **Polling-based coordination**: `agent-monitor.cjs` polls every 30s, writes `/tmp/agent-work-{role}.json`, agents poll that file. A 4-step review chain has 2+ minutes of pure poll latency.

3. **Agent-interpreted process**: Agents must understand WORKFLOW.md, interpret state+role combinations, and decide transitions. They get confused, skip gates, make wrong transitions.

### Current State

```
┌─────────────────────────────────────────────────┐
│ SQLite Database (mindspace_nodes)               │
│ ┌────────┬────────┬──────┬───────────────────┐  │
│ │ slug   │ status │ role │ dna_json          │  │
│ ├────────┼────────┼──────┼───────────────────┤  │
│ │ task-a │ active │ dev  │ {"title":"..."}   │  │
│ │ task-b │ review │ qa   │ {"title":"..."}   │  │
│ └────────┴────────┴──────┴───────────────────┘  │
└─────────────────────────┬───────────────────────┘
                          │
    ┌─────────────────────┼──────────────────────┐
    │                     │                      │
    ▼                     ▼                      ▼
agent-monitor.cjs    interface-cli.js      viz/export-data.js
(polls 30s)          (agents call)         (dumps to JSON)
    │                     │                      │
    ▼                     ▼                      ▼
/tmp/agent-work-*.json   transitions          viz/data.json
    │                                            │
    ▼                                            ▼
Agent polls file                          Dashboard (static)
Agent interprets state
Agent decides action
```

### Proposed State (v1)

```
┌──────────────────────────────────────────────────────────┐
│ XPollination MCP Server (Streamable HTTP, port 9090)     │
│                                                          │
│ ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│ │ Cell Store   │  │ Agent        │  │ Quality Gate   │  │
│ │              │  │ Registry     │  │ Engine         │  │
│ │ cells = {    │  │              │  │                │  │
│ │  "task-a": { │  │ liaison: s1  │  │ validates DNA  │  │
│ │    dna,      │  │ pdsa:    s2  │  │ checks AC     │  │
│ │    state,    │  │ dev:     s3  │  │ enforces gates │  │
│ │    holder,   │  │ qa:      s4  │  │ routes cells   │  │
│ │    history   │  │              │  │                │  │
│ │  }           │  │ Each has SSE │  │ All coded,     │  │
│ │ }            │  │ connection   │  │ not agent-     │  │
│ │              │  │              │  │ interpreted    │  │
│ └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │
│        │                 │                   │           │
│        └─────────┬───────┴───────────────────┘           │
│                  │                                       │
│         ┌────────┴────────┐                              │
│         │ Notification    │                              │
│         │ Dispatcher      │                              │
│         │                 │                              │
│         │ On transition:  │                              │
│         │ → find holder   │                              │
│         │ → push via SSE  │                              │
│         └─────────────────┘                              │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Persistence Layer (cells serialized to disk)        │  │
│ │ /data/cells/{slug}.json — one file per cell         │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐  │
│ │ Visualization API (live, no export needed)          │  │
│ │ GET /api/state → agents + cells + holders           │  │
│ │ SSE /api/stream → real-time state changes           │  │
│ └─────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
     ↑SSE          ↑SSE          ↑SSE          ↑SSE
     │              │              │              │
 ┌───┴───┐    ┌────┴───┐    ┌────┴───┐    ┌────┴───┐
 │LIAISON│    │ PDSA   │    │  DEV   │    │  QA    │
 │Pane 0 │    │Pane 1  │    │Pane 2  │    │Pane 3  │
 └───────┘    └────────┘    └────────┘    └────────┘
  Claude Code instances (tmux, persistent)
  Connected via Streamable HTTP to shared MCP server
```

---

## ARCHITECTURE

### Part 1: The Cell Object

A cell is a self-contained unit of work that carries everything needed for any agent to understand and act on it. No external queries required.

#### 1.1 Cell Schema

```typescript
interface Cell {
  // === IDENTITY ===
  slug: string;                    // Human-readable unique ID: "implement-feature-x"
  type: "task" | "bug";           // Governs which transition rules apply
  workflow: "pdsa-design" | "liaison-content" | "bug-fix";  // Which path this follows

  // === CURRENT STATE ===
  state: string;                   // "active+dev", "review+qa", etc.
  holder: string | null;           // Role currently holding this cell, or null (unassigned)
  claimed_by_session: string | null; // Session ID of the agent holding this cell

  // === DNA (the work content) ===
  dna: {
    title: string;
    description: string;

    // PDSA fills these (design phase):
    requirements?: string;
    proposed_design?: string;
    acceptance_criteria?: AcceptanceCriterion[];
    pdsa_ref?: string;             // Link to PDSA document

    // QA fills these (testing phase):
    test_spec?: string;
    test_file?: string;            // Path to test file

    // DEV fills these (implementation phase):
    implementation?: string;
    files_changed?: string[];
    commit_sha?: string;

    // Review phases:
    qa_review?: ReviewResult;      // QA's review of dev work
    pdsa_review?: ReviewResult;    // PDSA's design-match verification
    liaison_review?: ReviewResult; // Liaison's presentation notes

    // Rework:
    rework_reason?: string;
    rework_from?: string;          // Which state triggered rework

    // Metadata:
    role?: string;                 // Current role assignment
    priority?: "low" | "medium" | "high";
    tags?: string[];
    [key: string]: unknown;        // Extensible
  };

  // === HISTORY (full audit trail, travels with the cell) ===
  history: HistoryEntry[];

  // === LIFECYCLE ===
  created_at: string;              // ISO 8601
  created_by: string;              // Role that created this cell
  updated_at: string;              // Last modification
  version: number;                 // Incremented on every change
}

interface AcceptanceCriterion {
  id: string;                      // "ac-1", "ac-2"
  description: string;             // What must be true
  met: boolean;                    // Checked by quality gate
  evidence?: string;               // How it was verified
}

interface ReviewResult {
  verdict: "pass" | "fail" | "rework";
  notes: string;
  reviewed_at: string;
  reviewed_by: string;             // Role
}

interface HistoryEntry {
  timestamp: string;               // ISO 8601
  from_state: string;
  to_state: string;
  actor: string;                   // Role that performed transition
  session_id: string;              // Which agent session
  action: string;                  // Human-readable: "claimed", "submitted design", etc.
  gate_result?: GateResult;        // Quality gate check result
  dna_snapshot?: Partial<Cell["dna"]>;  // What DNA looked like at this point
}

interface GateResult {
  gate_name: string;
  passed: boolean;
  checks: GateCheck[];
}

interface GateCheck {
  field: string;
  required: boolean;
  present: boolean;
  valid: boolean;
  message?: string;
}
```

#### 1.2 Cell Lifecycle

```
                    ┌──────────┐
                    │ CREATED  │ Liaison or system creates cell
                    │ (pending)│ holder: null
                    └────┬─────┘
                         │ ready (liaison activates)
                         ▼
                    ┌──────────┐
                    │ INBOX    │ Cell waits in unassigned pool
                    │ (ready)  │ holder: null, routed to role
                    └────┬─────┘
                         │ claim (matching role)
                         ▼
                    ┌──────────┐
                    │ HELD     │ Agent holds cell, works on it
                    │ (active) │ holder: "pdsa" (or dev, qa, liaison)
                    └────┬─────┘
                         │ submit (agent completes work)
                         │ quality gate check
                         ▼
              ┌──────────┴──────────┐
              │                     │
         GATE PASS              GATE FAIL
              │                     │
              ▼                     ▼
        ┌──────────┐          ┌──────────┐
        │ ROUTED   │          │ RETURNED │
        │ to next  │          │ to agent │
        │ role     │          │ with     │
        │          │          │ error    │
        └──────────┘          └──────────┘
```

#### 1.3 Cell Persistence

Cells are serialized to disk as individual JSON files:

```
/data/cells/
├── implement-feature-x.cell.json
├── fix-login-bug.cell.json
├── design-homepage.cell.json
└── ...
```

Each file contains the complete serialized `Cell` object. On server start:
1. Read all `*.cell.json` files from `/data/cells/`
2. Load into in-memory cell store
3. Cells with `holder` set wait for that role to reconnect
4. Cells with `holder: null` go to unassigned pool

On every cell mutation:
1. Update in-memory state
2. Write cell to disk (atomic write: write to `.tmp`, rename)
3. Push notification to relevant agent

**Why not SQLite?** SQLite adds a query layer between the object and the agent. With JSON files:
- One file = one object = one truth
- No ORM, no mapping, no query interpretation
- Direct serialization of the exact object agents receive
- Easy backup (rsync), easy inspection (`cat file.json | jq`)
- Easy migration (copy files)

**Data integrity:**
- Atomic writes (write-to-temp, rename) prevent corruption
- Server holds canonical copy in memory; disk is persistence
- On conflict: in-memory wins (it's the live state)
- Version field prevents stale writes

---

### Part 2: The MCP Server

#### 2.1 Server Architecture

```typescript
// server.ts — Main entry point

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamablehttp.js";
import { createServer } from "http";

const PORT = 9090;

// === IN-MEMORY STATE ===

interface AgentSession {
  sessionId: string;
  role: string;
  connectedAt: string;
  transport: StreamableHTTPServerTransport;  // For sending notifications
  subscriptions: Set<string>;               // Resource URIs subscribed
}

interface ServerState {
  agents: Map<string, AgentSession>;        // role → session
  cells: Map<string, Cell>;                 // slug → cell
}

const state: ServerState = {
  agents: new Map(),
  cells: new Map(),
};
```

#### 2.2 HTTP Server + MCP Transport

```typescript
const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:${PORT}`);

  if (url.pathname === "/mcp") {
    // MCP Streamable HTTP endpoint
    // Handles JSON-RPC requests + SSE for notifications
    await mcpTransport.handleRequest(req, res);
  }
  else if (url.pathname === "/api/state") {
    // Visualization API — live system state
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    });
    res.end(JSON.stringify(getSystemState()));
  }
  else if (url.pathname === "/api/stream") {
    // SSE stream for live viz updates
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    vizClients.add(res);
    req.on("close", () => vizClients.delete(res));
  }
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`XPollination MCP Server on http://10.33.33.1:${PORT}`);
});
```

#### 2.3 MCP Tools

**Agent Lifecycle Tools:**

| Tool | Input | Behavior | Returns |
|------|-------|----------|---------|
| `login` | `{ role: string }` | Register session as role. Reject if role already taken. Load held cells from store. | `{ ok, held_cells: Cell[] }` |
| `logout` | `{}` | Deregister session. Held cells go to unassigned pool (holder=null). | `{ ok }` |

**Cell Operations:**

| Tool | Input | Behavior | Returns |
|------|-------|----------|---------|
| `claim` | `{ slug: string }` | Take cell from inbox. Cell must be in agent's inbox (matching role). Atomic. Sets holder + claimed_by_session. | `{ cell: Cell }` |
| `release` | `{ slug: string }` | Return cell to inbox without completing. Preserves state, clears holder. | `{ ok }` |
| `get_cell` | `{ slug: string }` | Read full cell. Any logged-in agent can read any cell. | `{ cell: Cell }` |
| `update_cell` | `{ slug: string, dna: Partial<DNA> }` | Update DNA fields on a held cell. Agent must be current holder. Increments version. | `{ cell: Cell }` |
| `submit` | `{ slug: string, results: object }` | Complete work and hand off. Merges results into DNA. Runs quality gate. On pass: transitions state, routes to next role, pushes notification. On fail: returns error with missing fields. | `{ ok, gate_result: GateResult }` or error |
| `list_inbox` | `{}` | List cells waiting for agent's role. | `{ cells: CellSummary[] }` |
| `list_held` | `{}` | List cells currently held by this agent. | `{ cells: CellSummary[] }` |

**Task Creation:**

| Tool | Input | Behavior | Returns |
|------|-------|----------|---------|
| `create_cell` | `{ slug, type, dna, workflow }` | Create new cell. Only liaison and system. Sets state to "pending". | `{ cell: Cell }` |
| `activate_cell` | `{ slug }` | Move cell from pending to ready. Routes to first role per workflow. | `{ cell: Cell }` |

**System Tools:**

| Tool | Input | Behavior | Returns |
|------|-------|----------|---------|
| `system_status` | `{}` | Connected agents, cell counts by state, unassigned cells. | `{ agents: [...], stats: {...} }` |

#### 2.4 MCP Resources

| URI | Content | Purpose |
|-----|---------|---------|
| `workflow://agents` | Connected agents with their roles and held cell slugs | Viz, monitoring |
| `workflow://inbox/{role}` | Cells routed to this role but not yet claimed | Agent inbox |
| `workflow://cell/{slug}` | Full cell object | Agent reads cell |
| `workflow://status` | System overview (agent count, cell counts by state) | Dashboard |

Agents subscribe to their inbox resource. Server pushes `notifications/resources/updated` when cells arrive.

#### 2.5 Notification Flow

```
On submit("task-b", { proposed_design: "..." }):

1. Server validates: is caller the current holder? YES
2. Server merges: cell.dna.proposed_design = "..."
3. Server runs quality gate for active+pdsa → approval:
   ┌─────────────────────────────────────────┐
   │ Gate: pdsa-to-approval                  │
   │                                         │
   │ ✓ dna.proposed_design exists            │
   │ ✓ dna.acceptance_criteria exists         │
   │ ✓ dna.acceptance_criteria.length > 0    │
   │ ✓ dna.pdsa_ref exists                   │
   │                                         │
   │ Result: PASS                            │
   └─────────────────────────────────────────┘
4. Server transitions: active+pdsa → approval
5. Server sets: cell.holder = "liaison" (per WORKFLOW.md v12)
6. Server appends history entry with gate result
7. Server removes cell from PDSA session's held set
8. Server adds cell to LIAISON session's held set
9. Server persists cell to disk: /data/cells/task-b.cell.json
10. Server sends SSE to LIAISON:
    { "jsonrpc": "2.0",
      "method": "notifications/resources/updated",
      "params": { "uri": "workflow://inbox/liaison" } }
11. Server sends SSE to viz clients:
    { "event": "cell-moved", "data": { "slug": "task-b", "to": "liaison" } }
12. PDSA agent context freed — task-b is gone
13. LIAISON agent receives notification, reads inbox, sees task-b
```

---

### Part 3: Quality Gates (Coded)

Quality gates are the coded acceptance criteria that the server checks before allowing a transition. Agents cannot bypass them.

#### 3.1 Gate Definitions

```typescript
interface QualityGate {
  name: string;
  from_state: string;
  to_state: string;
  checks: GateCheckDefinition[];
}

interface GateCheckDefinition {
  field: string;              // dot-notation path in cell.dna
  type: "exists" | "non_empty" | "min_length" | "array_min" | "equals" | "custom";
  value?: unknown;            // For equals, min_length, etc.
  message: string;            // Error message if check fails
}
```

#### 3.2 Gate Registry

**PDSA Design Path Gates:**

| Transition | Gate Name | Required DNA Fields |
|-----------|-----------|-------------------|
| `active+pdsa → approval` | `pdsa-design-complete` | `proposed_design` (non_empty), `acceptance_criteria` (array, min 1), `pdsa_ref` (exists) |
| `approval → approved` | `human-approval` | `liaison_review.verdict` = "pass" |
| `testing → ready+dev` | `qa-tests-written` | `test_spec` (non_empty), `test_file` (exists) |
| `active+dev → review+qa` | `dev-implementation-complete` | `implementation` (non_empty), `files_changed` (array, min 1) |
| `review+qa → review+pdsa` | `qa-review-complete` | `qa_review.verdict` (exists), `qa_review.notes` (non_empty) |
| `review+pdsa → review+liaison` | `pdsa-design-match` | `pdsa_review.verdict` (exists), `pdsa_review.notes` (non_empty) |
| `review+liaison → complete` | `human-final-approval` | `liaison_review.verdict` = "pass" |

**Bug Fix Path Gates:**

| Transition | Gate Name | Required DNA Fields |
|-----------|-----------|-------------------|
| `active+dev → review+qa` | `bug-fix-complete` | `implementation` (non_empty) |
| `review+qa → complete` | `bug-verified` | `qa_review.verdict` = "pass" |

**Liaison Content Path Gates:**

| Transition | Gate Name | Required DNA Fields |
|-----------|-----------|-------------------|
| `active+liaison → review+liaison` | `content-complete` | `implementation` (non_empty) |
| `review+liaison → complete` | `content-approved` | `liaison_review.verdict` = "pass" |

**Rework Gates:**

| Transition | Gate Name | Required DNA Fields |
|-----------|-----------|-------------------|
| `review → rework` (any) | `rework-justified` | `rework_reason` (non_empty) |

#### 3.3 Gate Engine Implementation

```typescript
function checkGate(cell: Cell, fromState: string, toState: string): GateResult {
  const gate = GATE_REGISTRY.find(g =>
    g.from_state === fromState && g.to_state === toState
  );

  if (!gate) {
    // No gate defined = auto-pass (transition still needs WORKFLOW rules)
    return { gate_name: "none", passed: true, checks: [] };
  }

  const checks: GateCheck[] = gate.checks.map(checkDef => {
    const value = getNestedField(cell.dna, checkDef.field);
    let valid = false;

    switch (checkDef.type) {
      case "exists":     valid = value !== undefined && value !== null; break;
      case "non_empty":  valid = !!value && String(value).trim().length > 0; break;
      case "min_length": valid = Array.isArray(value) && value.length >= (checkDef.value as number); break;
      case "array_min":  valid = Array.isArray(value) && value.length >= (checkDef.value as number); break;
      case "equals":     valid = value === checkDef.value; break;
    }

    return {
      field: checkDef.field,
      required: true,
      present: value !== undefined && value !== null,
      valid,
      message: valid ? undefined : checkDef.message
    };
  });

  return {
    gate_name: gate.name,
    passed: checks.every(c => c.valid),
    checks
  };
}
```

---

### Part 4: Transition Engine (WORKFLOW.md v12 in Code)

The transition engine preserves all rules from `workflow-engine.js` but operates on cells instead of database rows.

#### 4.1 Transition Rules

The existing `ALLOWED_TRANSITIONS` whitelist is preserved verbatim. The engine:

1. Validates transition is in whitelist (rejects undefined transitions)
2. Checks actor permissions (role-specific rules)
3. Checks DNA requirements (field presence)
4. Runs quality gate (new — field completeness + validity)
5. Determines new role (from transition rule's `newRole`)
6. Determines new holder (from new role → registered agent)

```typescript
function executeTransition(
  cell: Cell,
  toStatus: string,
  actor: string,           // The role performing the transition
  sessionId: string,       // Which agent session
  results?: Partial<DNA>   // DNA updates from agent's work
): Cell | TransitionError {

  const fromStatus = cell.state.split("+")[0];  // e.g., "active" from "active+dev"
  const currentRole = cell.dna.role || cell.holder;

  // 1. WHITELIST CHECK (from workflow-engine.js)
  const transitionError = validateTransition(cell.type, fromStatus, toStatus, actor, currentRole);
  if (transitionError) return { error: transitionError };

  // 2. DNA REQUIREMENTS (from workflow-engine.js)
  const mergedDna = { ...cell.dna, ...results };
  const dnaError = validateDnaRequirements(cell.type, fromStatus, toStatus, mergedDna, currentRole);
  if (dnaError) return { error: dnaError };

  // 3. QUALITY GATE (NEW — coded acceptance criteria)
  const newRole = getNewRoleForTransition(cell.type, fromStatus, toStatus, currentRole) || currentRole;
  const targetState = `${toStatus}+${newRole}`;
  const gateResult = checkGate(cell, cell.state, targetState);
  if (!gateResult.passed) {
    return {
      error: `Quality gate "${gateResult.gate_name}" failed`,
      gate_result: gateResult,
      missing_fields: gateResult.checks.filter(c => !c.valid).map(c => c.field)
    };
  }

  // 4. EXECUTE TRANSITION
  const updatedCell: Cell = {
    ...cell,
    state: targetState,
    holder: newRole,
    claimed_by_session: null,  // Unclaimed until next agent picks it up
    dna: {
      ...cell.dna,
      ...results,
      role: newRole,
    },
    version: cell.version + 1,
    updated_at: new Date().toISOString(),
    history: [
      ...cell.history,
      {
        timestamp: new Date().toISOString(),
        from_state: cell.state,
        to_state: targetState,
        actor,
        session_id: sessionId,
        action: `Transition: ${fromStatus} → ${toStatus}`,
        gate_result: gateResult,
      }
    ]
  };

  return updatedCell;
}
```

#### 4.2 Routing Logic

After transition, the server routes the cell to the correct agent:

```typescript
function routeCell(cell: Cell): void {
  const targetRole = cell.holder;

  if (!targetRole) {
    // No role assigned — goes to unassigned pool
    return;
  }

  const targetAgent = state.agents.get(targetRole);

  if (targetAgent) {
    // Agent is connected — push notification
    notifyAgent(targetAgent, cell.slug);
  }
  // else: Agent not connected — cell waits in store
  // When agent reconnects and calls login(), they'll receive held cells
}

function notifyAgent(agent: AgentSession, cellSlug: string): void {
  // Send MCP resource-updated notification via SSE
  agent.transport.send({
    jsonrpc: "2.0",
    method: "notifications/resources/updated",
    params: { uri: `workflow://inbox/${agent.role}` }
  });
}
```

---

### Part 5: Agent Lifecycle

#### 5.1 Connection Flow

```
Agent starts in tmux pane
     │
     ▼
Claude Code loads .mcp.json
  → Connects to http://10.33.33.1:9090/mcp
  → Streamable HTTP transport established
  → SSE channel open for server → client push
     │
     ▼
Agent calls: login({ role: "dev" })
  → Server checks: is "dev" role available? (only 1 per role)
  → Server registers: agents["dev"] = { sessionId, transport, ... }
  → Server loads: cells where holder="dev" → returns to agent
  → Server logs: "DEV agent connected (session: abc-123)"
     │
     ▼
Agent calls: list_inbox()
  → Server returns: cells where state matches dev-monitored states
  → Agent sees what work is waiting
     │
     ▼
Agent subscribes: resources/subscribe("workflow://inbox/dev")
  → Server registers subscription for this session
  → From now on, server will push notifications when inbox changes
     │
     ▼
Agent WAITS (no polling, no monitoring)
     │
     ▼
Server pushes: notifications/resources/updated("workflow://inbox/dev")
  → New cell arrived for dev role
     │
     ▼
Agent calls: claim("task-x")
  → Cell moved to agent's held set
  → Agent receives full cell with complete history
     │
     ▼
Agent does work (reads cell.dna, implements, etc.)
     │
     ▼
Agent calls: submit("task-x", { implementation: "...", files_changed: [...] })
  → Server checks quality gate
  → On pass: cell transitions, routes to next role
  → Agent context freed — cell is gone
     │
     ▼
Agent WAITS for next notification
```

#### 5.2 Reconnection Protocol

```
Agent crashes or restarts (/compact, /clear, context exhaustion)
     │
     ▼
Claude Code restarts in same tmux pane
  → Reconnects to MCP server (new session ID)
     │
     ▼
Agent calls: login({ role: "dev" })
  → Server: old dev session is stale → remove it
  → Server: register new session as dev
  → Server: load cells where holder="dev"
  → Returns: cells the agent was working on
     │
     ▼
Agent sees held cells with full history
  → Knows exactly where it left off
  → No handoff file needed
  → No context recovery protocol
  → The cells ARE the context
```

#### 5.3 Graceful Disconnect

```
Agent calls: logout()
  → OR: agent session closes (tmux pane closed, network drop)
     │
     ▼
Server detects disconnect
  → Cells held by this agent:
    Option A: Keep holder, wait for reconnection (default, 30min timeout)
    Option B: Release to inbox (holder=null) if timeout exceeded
  → Deregister session
  → Log: "DEV agent disconnected. 2 cells held, awaiting reconnection."
```

---

### Part 6: Visualization

#### 6.1 Live API (replaces export-data.js + static dashboard)

The viz dashboard connects to the same MCP server's HTTP API:

```typescript
function getSystemState(): SystemState {
  const agents = Array.from(state.agents.entries()).map(([role, session]) => ({
    role,
    status: "online",
    connected_at: session.connectedAt,
    held_cells: Array.from(state.cells.values())
      .filter(c => c.holder === role && c.claimed_by_session === session.sessionId)
      .map(c => ({ slug: c.slug, state: c.state, title: c.dna.title }))
  }));

  // Add offline roles
  const allRoles = ["liaison", "pdsa", "dev", "qa"];
  for (const role of allRoles) {
    if (!state.agents.has(role)) {
      agents.push({
        role,
        status: "offline",
        connected_at: null,
        held_cells: Array.from(state.cells.values())
          .filter(c => c.holder === role)
          .map(c => ({ slug: c.slug, state: c.state, title: c.dna.title }))
      });
    }
  }

  const cells = Array.from(state.cells.values()).map(c => ({
    slug: c.slug,
    type: c.type,
    state: c.state,
    holder: c.holder,
    title: c.dna.title,
    version: c.version,
    updated_at: c.updated_at,
    history_length: c.history.length
  }));

  const unassigned = cells.filter(c => c.holder === null);

  return { agents, cells, unassigned, timestamp: new Date().toISOString() };
}
```

#### 6.2 Dashboard Shows

```
┌──────────────────────────────────────────────────────────────┐
│ XPollination Flow                                  ⟳ Live   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  AGENTS                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │● LIAISON │ │● PDSA    │ │● DEV     │ │○ QA      │       │
│  │ 1 cell   │ │ 2 cells  │ │ 1 cell   │ │ offline  │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  CELLS                                                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ task-a  │ review+liaison │ LIAISON │ v8  │ 12:30 │ ▶   │ │
│  │ task-b  │ active+pdsa    │ PDSA    │ v3  │ 12:25 │ ▶   │ │
│  │ task-c  │ active+pdsa    │ PDSA    │ v2  │ 12:20 │ ▶   │ │
│  │ task-d  │ active+dev     │ DEV     │ v5  │ 12:15 │ ▶   │ │
│  │ task-e  │ review+qa      │ QA      │ v4  │ 12:10 │ ⏸   │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ⏸ = holder offline, cell waiting                            │
│                                                              │
│  INBOX (unclaimed)                                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ task-f  │ ready+dev  │ waiting for DEV  │ v1 │ 11:00  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  COMPLETED                                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ task-g  │ complete │ 14 transitions │ v14 │ yesterday  │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

#### 6.3 Real-Time Updates

The viz uses SSE (`/api/stream`) for live updates:

```typescript
// Server pushes to viz clients on every state change
function notifyViz(event: string, data: object): void {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of vizClients) {
    client.write(message);
  }
}

// Events:
// "agent-connected"   { role, session_id }
// "agent-disconnected" { role }
// "cell-created"      { slug, type, title }
// "cell-claimed"      { slug, holder }
// "cell-submitted"    { slug, from_state, to_state, gate_result }
// "cell-moved"        { slug, from_role, to_role }
```

---

### Part 7: Configuration

#### 7.1 Claude Code MCP Configuration

All 4 agents share the same `.mcp.json` (project-scoped):

```json
{
  "mcpServers": {
    "xpollination": {
      "type": "http",
      "url": "http://10.33.33.1:9090/mcp"
    }
  }
}
```

Placed at:
- `/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/.mcp.json`
- `/home/developer/workspaces/github/PichlerThomas/HomePage/.mcp.json`
- `/home/developer/workspaces/github/PichlerThomas/HomeAssistant/.mcp.json`

Each Claude Code instance connects to the same server. Role is established by the `login()` tool call, not by configuration.

#### 7.2 Agent Startup (claude-session.sh update)

The role prompt files (`/tmp/claude-role-{role}.txt`) get updated to include:

```
You are the DEVELOPMENT agent. On startup:
1. Call the xpollination MCP tool: login({ role: "dev" })
2. Call: list_inbox() to see waiting work
3. Subscribe to workflow://inbox/dev for push notifications
4. Wait for notifications — do NOT poll
When you receive a cell, read its full DNA and history before starting work.
When done, call submit() with your results. The server handles routing.
```

#### 7.3 Server Startup

```bash
#!/bin/bash
# start-mcp-server.sh — Run as persistent service
source ~/.nvm/nvm.sh
cd /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server
node dist/server.js
```

Managed via systemd or nohup. Runs independently of Claude Code sessions.

---

### Part 8: Migration Plan

#### 8.1 Data Migration

Convert existing `mindspace_nodes` rows to cell files:

```typescript
// migrate.ts
import Database from "better-sqlite3";

const db = new Database("data/xpollination.db", { readonly: true });
const nodes = db.prepare("SELECT * FROM mindspace_nodes").all();

for (const node of nodes) {
  const dna = JSON.parse(node.dna_json);
  const cell: Cell = {
    slug: node.slug,
    type: node.type,
    workflow: dna.role === "liaison" ? "liaison-content" : "pdsa-design",
    state: `${node.status}+${dna.role || "liaison"}`,
    holder: dna.role || null,
    claimed_by_session: null,
    dna: dna,
    history: [{
      timestamp: node.created_at,
      from_state: "migrated",
      to_state: `${node.status}+${dna.role || "liaison"}`,
      actor: "system",
      session_id: "migration",
      action: "Migrated from SQLite mindspace_nodes"
    }],
    created_at: node.created_at,
    created_by: "system",
    updated_at: node.updated_at,
    version: 1
  };

  fs.writeFileSync(
    `data/cells/${node.slug}.cell.json`,
    JSON.stringify(cell, null, 2)
  );
}
```

#### 8.2 Phased Rollout

| Phase | What | Duration | Risk |
|-------|------|----------|------|
| **1. Build server** | New MCP server with HTTP transport, cell store, tools | 2-3 days | Low (additive) |
| **2. Quality gates** | Port `workflow-engine.js` rules + add gate checks | 1 day | Low (logic exists) |
| **3. Migrate data** | Convert `mindspace_nodes` → cell files | 1 hour | Low (scripted) |
| **4. Configure agents** | `.mcp.json` + update role prompts | 1 hour | Low |
| **5. Test with 1 agent** | Liaison connects, creates cell, hands off | 1 day | Medium |
| **6. Full 4-agent test** | All roles connected, full PDSA path end-to-end | 1 day | Medium |
| **7. Cut over** | Remove polling infrastructure, switch to new server | 1 hour | Medium |
| **8. Remove old** | Delete `agent-monitor.cjs`, `/tmp` files, `interface-cli.js` | After stability | Low |

---

### Part 9: Future Vision (v2 — Personal Object Space)

*Not implemented in v1. Documented for architectural alignment.*

#### 9.1 Owner-Held Data

In v2, Thomas (the owner) holds all data. Agents don't own cells — they borrow them:

```
Thomas's Personal Object Space
├── Active Cells (tasks in progress)
│   ├── task-a.cell.json  → currently lent to LIAISON
│   ├── task-b.cell.json  → currently lent to PDSA
│   └── task-c.cell.json  → currently lent to DEV
├── Completed Cells (archive, institutional memory)
│   ├── task-x.cell.json  → full history preserved
│   └── task-y.cell.json
├── Agent Memory Objects
│   ├── pdsa-memory.json  → PDSA methodology patterns, past designs
│   ├── qa-memory.json    → test patterns, known failure modes
│   ├── dev-memory.json   → codebase patterns, shortcuts
│   └── liaison-memory.json → process knowledge, human preferences
└── Identity
    └── thomas-identity.json → delegated auth tokens for agents
```

When an agent connects, Thomas grants access to:
- The agent's role memory object
- The cells assigned to that role

The MCP server enforces access: agent with role="dev" can only see cells where holder="dev" and the dev memory object. Not PDSA's memory, not other roles' cells.

#### 9.2 Agent Identity

```
Thomas (owner)
  → creates delegation token for "PDSA agent"
    → token carries: { owner: "thomas", role: "pdsa", permissions: [...], expires: "..." }
  → PDSA agent presents token to MCP server
    → server verifies: token is valid, issued by Thomas
    → server grants: access to pdsa-held cells + pdsa memory object
```

This maps to MCP's OAuth 2.1 support. The delegation token IS an OAuth access token.

#### 9.3 Cross-Service Object Flow

Cells can travel between MCP services:

```
Thomas's Object Space
     │
     ├── XPollination MCP Server (content pipeline)
     │   └── Agent uses cell to create content
     │
     ├── HomePage MCP Server (website management)
     │   └── Agent receives cell, deploys content
     │
     └── Future Services...
```

The cell carries everything. The service provides tools. The agent connects cell + tools.

---

## Acceptance Criteria

### v1 (Implementation)

- [ ] MCP server runs as persistent HTTP service on 10.33.33.1:9090
- [ ] Streamable HTTP transport with SSE for server→client notifications
- [ ] 4 Claude Code instances connect to same server via `.mcp.json`
- [ ] Agents register with role via `login()` — one role per session
- [ ] Cells are self-contained JSON objects with DNA, state, history
- [ ] Cells serialized to `/data/cells/{slug}.cell.json`
- [ ] On server restart: cells loaded from disk, reassociated with agents on reconnect
- [ ] Quality gates coded and enforced server-side on `submit()`
- [ ] Server pushes SSE notification when cells arrive in agent's inbox
- [ ] No polling, no file watching, no `agent-monitor.cjs`
- [ ] Viz dashboard reads live state from `/api/state`
- [ ] WORKFLOW.md v12 transition rules preserved in server logic
- [ ] Data migration script: `mindspace_nodes` → cell files
- [ ] Content pipeline tools (crawl_trends, write_draft, etc.) preserved
- [ ] Agent reconnection loads held cells automatically

### v2 (Future — not implemented)

- [ ] Owner-held data model (Thomas grants access)
- [ ] Agent memory objects (role-specific persistent knowledge)
- [ ] OAuth 2.1 delegation tokens for agent identity
- [ ] Cross-service cell flow
- [ ] Personal object space storage

---

## Thomas's Answers

| Question | Answer |
|----------|--------|
| Option 1 (long-polling)? | **Rejected** |
| Option 3 (tmux send-keys)? | **Rejected** |
| Persistence model? | **Cells serialized to disk, reloaded on restart** |
| Completed cells? | **v2: Owner holds data, grants access to agents** |
| Personal object space? | **v2 — agree, not v1** |
| Architecture approach? | **Deep PDSA approved — plan in detail** |

---

## DO

### Implementation Tasks (to be created after approval)

1. **Build HTTP MCP server** — New `server.ts` with Streamable HTTP transport, HTTP server on 9090, session management
2. **Build cell store** — In-memory cell store with JSON file persistence, atomic writes
3. **Port transition engine** — Move `workflow-engine.js` rules to cell-based operations, add quality gate engine
4. **Build MCP tools** — login, logout, claim, submit, get_cell, update_cell, list_inbox, list_held, create_cell, activate_cell, system_status
5. **Build MCP resources** — workflow://agents, workflow://inbox/{role}, workflow://cell/{slug}, workflow://status
6. **Build notification dispatcher** — SSE push to subscribed agents + viz clients
7. **Build viz API** — /api/state, /api/stream (SSE), /api/cell/{slug}
8. **Write migration script** — mindspace_nodes → cell files
9. **Configure agents** — .mcp.json for all projects, update role prompts in claude-session.sh
10. **Integration test** — Full 4-agent PDSA design path end-to-end

---

## STUDY

(To be filled after implementation)

## ACT

(To be filled after review)

---

**PDSA Ref (dual format):**
- Git: https://github.com/PichlerThomas/xpollination-mcp-server/blob/main/docs/pdsa/2026-02-09-agent-mcp-peer-architecture.pdsa.md
- Workspace: /home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/docs/pdsa/2026-02-09-agent-mcp-peer-architecture.pdsa.md

**Research Sources:**
- [Anthropic: Claude Opus 4.6](https://www.anthropic.com/news/claude-opus-4-6)
- [MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture)
- [MCP Transports (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Resources & Subscriptions](https://modelcontextprotocol.io/specification/2025-03-26/server/resources)
- [MCP Sampling](https://modelcontextprotocol.io/specification/2025-03-26/client/sampling)
- [MCP Auth (Permit.io)](https://www.permit.io/blog/the-ultimate-guide-to-mcp-auth)
- [Agent-to-Agent on MCP (Microsoft)](https://developer.microsoft.com/blog/can-you-build-agent2agent-communication-on-mcp-yes)
- [Agent Interoperability (AWS)](https://aws.amazon.com/blogs/opensource/open-protocols-for-agent-interoperability-part-1-inter-agent-communication-on-mcp/)
- [Claude Code Agent Teams](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Multi-Client MCP (MCPcat)](https://mcpcat.io/guides/configuring-mcp-servers-multiple-simultaneous-connections/)
