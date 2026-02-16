# PDSA: Cell-Based Workflow Simulation — Mapping All States & Use Cases

**Date:** 2026-02-16
**Type:** Design (Workflow Simulation)
**Status:** ACTIVE
**Author:** Liaison + Thomas (interactive)
**Depends on:** 2026-02-09-agent-mcp-peer-architecture.pdsa.md

---

## PLAN

### Goal

Walk through the entire cell-based workflow via interactive simulation with Thomas. Each prompt from Thomas triggers a state change. Every state is documented with a table showing where all objects are. The outcome: a fully mapped process with all use cases discovered.

### Thomas's Requirements

**T1:** "simulate it. create a table with all the states necessary and i will prompt you what happens and you tell me where the objects are at what moment in the workflow. that gives us an understanding of the workflow and about the usecases"

### New Requirement (from T1 context)

> "data cannot be changed asynchronously, it needs to be done by a verified server"
> "data itself is ultimately stored with the user"
> "agents are started in different roles, receiving the data and connecting to the mcp server"

---

## DO — Simulation Log

### T0: Empty System
- Server running on 9090, no agents, no cells

### T1: Liaison Connects
- Thomas starts Claude Code in tmux pane 0
- Liaison calls `login({ role: "liaison" })` → registered as `sess-L001`
- No held cells, no inbox → idle, waiting
- SSE channel open

### T2: Thomas asks Liaison to verify server identity
- **Action:** Liaison needs to confirm it's connected to verified "xpollination-mcp-server"
- **Discovery:** MCP `initialize` handshake returns `serverInfo: { name, version }` — protocol-level identity
- **Gap found:** No cryptographic verification. Server self-reports name, nothing proves authenticity.
- **Use case identified:** UC-01 — Server Identity Verification

**Thomas's Decision (T2):**
> "for V1 we do not need this feature at all but i want to design the full process"
> "the solution needs to be d) identity in our control. self certified."
> "as i - Thomas - can certify any xpollination-mcp-server, i can verify if the servers where certified by me"
> "we will need a tooling for that full process in future"

**Design Decision: Thomas = Root of Authority (Self-Sovereign PKI)**

**Thomas's follow-up (T2b):**
> "explain to me the trust model. i need to zoom in to understand if your assumptions are correct. apply trivium thinking"

**Trivium Analysis — Corrected Model:**

Initial assumption was "Thomas → Server → Agent" (linear trust chain). This was WRONG.

**Grammar (facts):** 5 entities — Thomas (human/owner), Server (software/custodian), Agent (Claude/borrower), Cell (data/work), Certificate (signed claim). Thomas deploys both Server and Agent independently.

**Logic (tested relationships):** There is NO trust between Server and Agent. Neither trusts the other. Both verify the other was authorized by the same root (Thomas). Trust is replaced by enforcement + mutual verification.

**Corrected model — Authorization is a tree, not a chain:**
```
           Thomas (root of authority)
          /                          \
    certifies                    authorizes
    (server cert)                (delegation token)
        ↓                            ↓
     Server ◄── mutual verification ──► Agent
     (custodian)                      (borrower)
```

**Three layers:**

| Layer | Question | Mechanism |
|-------|----------|-----------|
| Identity | "Who are you?" | Thomas certifies Server (cert), Thomas authorizes Agent (token) |
| Verification | "Prove it." | Mutual — Agent checks server cert, Server checks agent token. Both against Thomas's authority. |
| Authority | "What can you do?" | Server = custodian (hold, validate, persist, route). Agent = borrower (read, work, submit). Server enforces boundaries. |

**Data custodian model:**
- Thomas = Owner (has authority, holds data ultimately)
- Server = Custodian (holds/protects data on Thomas's behalf, enforces rules)
- Agent = Borrower (works with data temporarily, returns to custodian, cannot mutate directly)

**Key insight:** No entity trusts another. Every interaction is verified against Thomas as common root. "Trust" is replaced by "enforcement + verification."

- NOT v1 scope — design only, implementation future
- No external CA dependency — full sovereignty
- Future tooling: `xpollination-cert-tool` (init, sign-server, verify, revoke, list)

**Simulation result:** For v1, VPN network trust is sufficient (10.33.33.1 only reachable via WireGuard). Full mutual verification is v2 scope.

### T3: Where is the data? (Thomas zoom-in)

**Thomas's prompt (T3):**
> "where are the data stored at each moment of the usecase? is the data moving? think about it."

**Trivium Analysis:**

**Grammar (possible data locations):**

| Location | Physical place | Nature |
|----------|---------------|--------|
| Thomas's disk | `/data/cells/*.cell.json` | Persistent, Thomas's machine |
| Server memory | RAM of MCP server process | Volatile, runtime cache |
| Network | HTTP between server and agent | Transient, milliseconds |
| Agent context | Claude Code conversation window | Volatile, dies with session |

**Logic (does data move?):**

**No. Data never moves. Only copies travel.**

- Thomas's disk = persisted truth (survives everything)
- Server memory = live truth (loaded from disk, canonical during runtime)
- Agent context = working copy (non-authoritative, read-only in canonical terms)
- Network = transport (data exists here for milliseconds)

The canonical data ALWAYS stays on Thomas's machine. The server process is software managing access to Thomas's files. Agents receive copies over the network. Copies are disposable — if agent crashes, canonical data is safe.

**Data flow per operation:**

| Operation | Agent context | Network | Server memory | Thomas's disk |
|-----------|---------------|---------|---------------|---------------|
| `create_cell()` | has input → sends | → POST | receives, validates, creates | ← writes `.cell.json` |
| `claim()` | receives copy ← | ← response | updates holder | ← writes update |
| `update_cell()` | sends changes → | → POST | validates, merges | ← writes update |
| `submit()` | sends results → | → POST | validates gate, transitions, routes | ← writes update |
| agent crash | **copy lost** | — | canonical intact | persisted intact |
| server restart | — | — | **reloads from disk** | canonical intact |

**Key insight:** Authority never moves. Copies travel. If anything volatile dies (agent context, server memory), the persisted truth on Thomas's disk survives and everything rebuilds from there.

---

### Updated Simulation Table (with Data Location)

#### T0: Empty System

| Entity | State | Data held | Canonical location |
|--------|-------|-----------|--------------------|
| Server | running | no cells | `/data/cells/` empty |
| Liaison | offline | — | — |
| PDSA | offline | — | — |
| Dev | offline | — | — |
| QA | offline | — | — |

#### T1: Liaison Connects

| Entity | State | Data held | Canonical location |
|--------|-------|-----------|--------------------|
| Server | running | session registry: `{liaison: sess-L001}` | server memory only (sessions are volatile) |
| Liaison | online | session ID in context | agent context (copy) |
| PDSA | offline | — | — |
| Dev | offline | — | — |
| QA | offline | — | — |

Cells: none. No data on disk.

#### T2–T3: After Trust Model + Data Location Analysis

Same as T1 — no state change, only design understanding deepened.

| Entity | State | Data held | Canonical location |
|--------|-------|-----------|--------------------|
| Server | running | session registry | server memory |
| Liaison | online | session ID | agent context (copy) |
| PDSA | offline | — | — |
| Dev | offline | — | — |
| QA | offline | — | — |

Cells: none. `/data/cells/` empty.

---

### T4: DRY — No Duplicates (Thomas zoom-in)

**Thomas's prompt (T4):**
> "you know of the DRY pattern? in an emergent state, duplicates always create chaos. so we do not want duplicates. if that is true, how can we solve it?"

**Analysis:**

Our T3 design has 3 representations of a cell: disk, server memory, agent context. DRY says: single authoritative representation. The "copies" we described WILL diverge in emergent conditions (agent holds stale copy, server crashes mid-write, two agents get references to same cell).

**Enterprise patterns that solve DRY for distributed state:**

1. **Actor Model** — Each entity has ONE owner (an actor). No shared state. Send messages, don't copy data. (Erlang/OTP, Akka, Orleans)
2. **Event Sourcing** — Truth is the append-only event log. Current state is derived by replaying events. Delete all projections, rebuild from events. (EventStoreDB, Axon)
3. **CQRS** — Separate write path (commands → single authoritative store) from read path (projections → derived, explicitly non-authoritative).

Combined: Actor owns state → emits events → event store is THE truth → projections are derived, deletable, rebuildable.

### T5: The API Problem — CORBA (Thomas zoom-in)

**Thomas's prompt (T5):**
> "the problem is the API. we need to rethink this. do you know of Corba?"

**CORBA (Common Object Request Broker Architecture, OMG 1991):**

Core principle: Objects live remotely. You get a REFERENCE, not the object. You call METHODS on the reference. Methods execute where the object lives.

| Component | What |
|-----------|------|
| IDL | Interface contract, language-neutral |
| ORB | Routes method calls to remote objects |
| Stub | Client-side proxy — looks like the real object |
| Skeleton | Server-side dispatcher — receives calls, invokes real object |
| Object Reference | Pointer to remote object, NOT the object |

**Our API is REST-like data-shipping, not CORBA-like method-invocation:**

| Data-shipping (current) | Method-invocation (needed) |
|-------------------------|---------------------------|
| `claim()` → returns full cell copy | `claim()` → returns reference |
| Agent holds mutable copy | Agent holds reference |
| Agent sends modified data back | Agent calls methods remotely |
| Duplicates exist by design | Zero duplicates by design |
| Validation AFTER data travels | Validation WHERE data lives |

### T6: TypeScript Implementation Plan

**Thomas's prompt (T6):**
> "we need to use typescript for it. evaluate how you can do this - in detail."

**Challenge:** TypeScript/Node.js has no native remote object support like Java RMI or Erlang PID. MCP's tool-call pattern is request/response. We need CORBA semantics through TypeScript + MCP.

**Solution: 6 layers that compose into a remote-object architecture.**

---

#### Layer 1: Interface Definition (IDL equivalent)

TypeScript interfaces ARE the IDL. They define the contract. Both client and server reference the same types. No code generation needed — TypeScript's type system IS the contract.

```typescript
// src/interfaces/cell.ts — THE contract

interface ICellMethods {
  // === READ OPERATIONS (return projections, not the object) ===
  readDna(): DNA;
  readField(field: string): unknown;
  readHistory(): HistoryEntry[];
  readSummary(): CellSummary;

  // === WRITE OPERATIONS (commands, execute on server) ===
  updateField(field: string, value: unknown): void;
  submit(results: Record<string, unknown>): GateResult;
  release(): void;
}

interface ICellRef {
  readonly slug: string;
  readonly version: number;
  readonly state: string;
}

interface IServer {
  login(role: string): { session: string; held: ICellRef[] };
  logout(): void;
  claim(slug: string): ICellRef;
  listInbox(): ICellRef[];
  listHeld(): ICellRef[];
  createCell(spec: CellSpec): ICellRef;
  activateCell(slug: string): ICellRef;
  status(): SystemStatus;
}
```

**Why this works as IDL:** TypeScript interfaces are:
- Language-level contracts (compile-time checked)
- Shared between client and server code
- Self-documenting (types ARE the specification)
- Extensible (add methods without breaking existing ones)

Unlike CORBA's IDL → code generation pipeline, TypeScript interfaces are directly usable. No compilation step. No stub generation. The interface IS the code.

---

#### Layer 2: Cell Actor (the remote object)

Each cell is a class instance that encapsulates state + behavior. State is private. All access goes through methods. This is the CORBA "skeleton" — the real object that methods execute on.

```typescript
// src/actors/cell-actor.ts

class CellActor {
  // State is PRIVATE — no external access
  private cell: Cell;
  private eventStore: EventStore;
  private gateEngine: QualityGateEngine;

  constructor(cell: Cell, eventStore: EventStore, gateEngine: QualityGateEngine) {
    this.cell = cell;
    this.eventStore = eventStore;
    this.gateEngine = gateEngine;
  }

  // === READ METHODS (return projections) ===

  readDna(): DNA {
    // structuredClone = deep copy. Agent gets a SNAPSHOT, not a reference
    // to the actor's internal state. Even in-process, no shared mutable state.
    return structuredClone(this.cell.dna);
  }

  readField(field: string): unknown {
    const value = this.cell.dna[field];
    return value !== undefined ? structuredClone(value) : undefined;
  }

  readHistory(): HistoryEntry[] {
    return structuredClone(this.cell.history);
  }

  readSummary(): CellSummary {
    return {
      slug: this.cell.slug,
      state: this.cell.state,
      holder: this.cell.holder,
      title: this.cell.dna.title,
      version: this.cell.version,
      updated_at: this.cell.updated_at,
    };
  }

  // === WRITE METHODS (commands, validated) ===

  updateField(field: string, value: unknown, actor: string, sessionId: string): void {
    // Authorization: only the current holder can write
    this.assertHolder(actor);

    // Mutate in place (the actor owns this state)
    this.cell.dna[field] = value;
    this.cell.version++;
    this.cell.updated_at = new Date().toISOString();

    // Emit event (append-only, immutable record)
    this.eventStore.append({
      type: 'DnaUpdated',
      cellSlug: this.cell.slug,
      payload: { field, value },
      actor,
      sessionId,
      version: this.cell.version,
    });

    // Persist to disk (atomic write)
    this.persist();
  }

  submit(results: Record<string, unknown>, actor: string, sessionId: string): GateResult {
    this.assertHolder(actor);

    // Merge results into DNA
    for (const [key, val] of Object.entries(results)) {
      this.cell.dna[key] = val;
    }

    // Quality gate check (server-enforced, not agent-interpreted)
    const gateResult = this.gateEngine.check(this.cell);
    if (!gateResult.passed) {
      // Rollback merge
      // (or: keep merge, return failure, let agent fix and resubmit)
      return gateResult;
    }

    // Transition state
    const prevState = this.cell.state;
    const newRole = this.gateEngine.getNextRole(this.cell);
    this.cell.state = `${gateResult.toStatus}+${newRole}`;
    this.cell.holder = newRole;
    this.cell.claimed_by_session = null;
    this.cell.version++;
    this.cell.updated_at = new Date().toISOString();

    // History entry
    this.cell.history.push({
      timestamp: this.cell.updated_at,
      from_state: prevState,
      to_state: this.cell.state,
      actor,
      session_id: sessionId,
      action: `Submitted: ${prevState} → ${this.cell.state}`,
      gate_result: gateResult,
    });

    // Event (THE truth)
    this.eventStore.append({
      type: 'CellSubmitted',
      cellSlug: this.cell.slug,
      payload: { results, from: prevState, to: this.cell.state, gateResult },
      actor,
      sessionId,
      version: this.cell.version,
    });

    // Persist
    this.persist();

    return gateResult;
  }

  release(actor: string, sessionId: string): void {
    this.assertHolder(actor);
    this.cell.holder = null;
    this.cell.claimed_by_session = null;
    this.cell.version++;
    this.eventStore.append({
      type: 'CellReleased',
      cellSlug: this.cell.slug,
      payload: {},
      actor,
      sessionId,
      version: this.cell.version,
    });
    this.persist();
  }

  // === INTERNAL ===

  private assertHolder(actor: string): void {
    if (this.cell.holder !== actor) {
      throw new Error(
        `Unauthorized: holder is "${this.cell.holder}", caller is "${actor}"`
      );
    }
  }

  private persist(): void {
    // Atomic write: write to .tmp, rename (prevents corruption on crash)
    const path = `data/cells/${this.cell.slug}.cell.json`;
    writeFileSync(path + '.tmp', JSON.stringify(this.cell, null, 2));
    renameSync(path + '.tmp', path);
  }
}
```

**Key properties:**
- `private cell` — State is encapsulated. Nothing outside the actor reads `cell` directly.
- `structuredClone()` on reads — Even in the same process, read methods return deep copies. No shared mutable references leak out.
- `assertHolder()` on writes — Authorization at the method level, not the API level.
- `persist()` after every write — Atomic write-to-temp-then-rename. If process crashes mid-write, the `.tmp` file is incomplete but the original `.cell.json` is untouched.

---

#### Layer 3: Method Dispatcher (ORB equivalent)

The dispatcher routes method calls to the correct cell actor. It maps `(slug, method, args)` → `cellActor.method(args)`. This is the CORBA ORB in ~40 lines.

```typescript
// src/dispatcher/method-dispatcher.ts

const READ_METHODS = ['readDna', 'readField', 'readHistory', 'readSummary'] as const;
const WRITE_METHODS = ['updateField', 'submit', 'release'] as const;
const ALL_METHODS = [...READ_METHODS, ...WRITE_METHODS] as const;
type CellMethod = typeof ALL_METHODS[number];

class MethodDispatcher {
  private actors: Map<string, CellActor> = new Map();

  register(slug: string, actor: CellActor): void {
    this.actors.set(slug, actor);
  }

  invoke(
    slug: string,
    method: string,
    args: Record<string, unknown>,
    actor: string,
    sessionId: string
  ): unknown {
    // Resolve actor
    const cellActor = this.actors.get(slug);
    if (!cellActor) throw new Error(`Cell not found: ${slug}`);

    // Validate method name (whitelist — prevents arbitrary method invocation)
    if (!ALL_METHODS.includes(method as CellMethod)) {
      throw new Error(`Unknown method: ${method}`);
    }

    // Dispatch
    switch (method) {
      // Read methods — no actor/session needed
      case 'readDna':     return cellActor.readDna();
      case 'readField':   return cellActor.readField(args.field as string);
      case 'readHistory': return cellActor.readHistory();
      case 'readSummary': return cellActor.readSummary();

      // Write methods — pass actor + session for authorization
      case 'updateField': return cellActor.updateField(
        args.field as string, args.value, actor, sessionId
      );
      case 'submit': return cellActor.submit(
        args.results as Record<string, unknown>, actor, sessionId
      );
      case 'release': return cellActor.release(actor, sessionId);
    }
  }
}
```

**Security:** The method whitelist is critical. Without it, an agent could call `persist()` or `assertHolder()` directly. The dispatcher IS the access control layer — only whitelisted methods are reachable.

---

#### Layer 4: MCP Tool (the transport binding)

One MCP tool = the entry point. It binds the MCP protocol to the method dispatcher. This is the thinnest layer — just protocol translation.

```typescript
// src/tools/cell.ts — Single MCP tool, acts as ORB

const cellTool = {
  name: 'cell',
  description:
    'Invoke a method on a cell object. The cell lives on the server. ' +
    'Read methods return projections. Write methods execute as commands.',
  inputSchema: {
    type: 'object',
    required: ['slug', 'method'],
    properties: {
      slug:   { type: 'string', description: 'Cell identifier' },
      method: {
        type: 'string',
        enum: ['readDna','readField','readHistory','readSummary',
               'updateField','submit','release'],
        description: 'Method to invoke'
      },
      args:   {
        type: 'object',
        description: 'Method arguments (field, value, results, etc.)',
        default: {}
      },
    },
  },
};

// Handler — routes MCP tool call to dispatcher
async function handleCellCall(
  params: { slug: string; method: string; args?: Record<string, unknown> },
  session: AgentSession
): Promise<unknown> {
  return dispatcher.invoke(
    params.slug,
    params.method,
    params.args || {},
    session.role,
    session.sessionId
  );
}
```

**Plus lifecycle tools** (thin, not method-dispatch):

```typescript
const loginTool = {
  name: 'login',
  description: 'Register as an agent role. Returns held cells.',
  inputSchema: {
    type: 'object',
    required: ['role'],
    properties: {
      role: { type: 'string', enum: ['liaison','pdsa','dev','qa'] }
    }
  }
};

const inboxTool = {
  name: 'inbox',
  description: 'List cells waiting in your inbox. Returns references, not full objects.',
  inputSchema: { type: 'object', properties: {} }
};

const claimTool = {
  name: 'claim',
  description: 'Claim a cell from your inbox. Returns a reference.',
  inputSchema: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: { type: 'string' }
    }
  }
};
```

**Tool count: 6** (down from 18 PM tools + 8 content tools = 26):

| Tool | Purpose | Returns |
|------|---------|---------|
| `login` | Register agent role | `{ session, held: CellRef[] }` |
| `logout` | Deregister | `{ ok }` |
| `inbox` | List waiting cells | `CellRef[]` (references, not objects) |
| `claim` | Take cell from inbox | `CellRef` (reference) |
| `cell` | Invoke method on cell | Method result (projection or gate result) |
| `status` | System overview | `{ agents, cells, stats }` |

The `cell` tool replaces ALL data-shipping tools. Every interaction with a cell goes through method invocation.

---

#### Layer 5: Event Store (source of truth)

Append-only JSONL file. One line per event. The canonical record of everything that happened. Cell files on disk are materialized projections — derived from events, deletable, rebuildable.

```typescript
// src/store/event-store.ts

interface DomainEvent {
  id: string;            // UUID
  cellSlug: string;      // Which cell
  type: string;          // CellCreated, DnaUpdated, CellSubmitted, etc.
  payload: Record<string, unknown>;
  actor: string;         // Role that caused this event
  sessionId: string;     // Which agent session
  timestamp: string;     // ISO 8601
  version: number;       // Cell version at time of event
}

class EventStore {
  private logPath: string;  // /data/events.jsonl

  append(event: Omit<DomainEvent, 'id' | 'timestamp'>): void {
    const full: DomainEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    // Append to JSONL (append-only, never modify existing lines)
    appendFileSync(this.logPath, JSON.stringify(full) + '\n');
  }

  // Replay: rebuild cell state from events
  getEvents(cellSlug: string): DomainEvent[] {
    const lines = readFileSync(this.logPath, 'utf-8')
      .split('\n')
      .filter(Boolean);
    return lines
      .map(line => JSON.parse(line) as DomainEvent)
      .filter(e => e.cellSlug === cellSlug);
  }

  // Full rebuild: event log → cell state (for recovery)
  rebuild(cellSlug: string): Cell {
    const events = this.getEvents(cellSlug);
    return events.reduce(applyEvent, createEmptyCell(cellSlug));
  }
}
```

**DRY relationship:**
- `/data/events.jsonl` = THE truth (append-only, immutable history)
- `/data/cells/*.cell.json` = materialized projection (derived, can be deleted)
- Server memory (CellActor state) = live cache (derived, volatile)
- Agent context = snapshot read (derived, ephemeral)

You can delete all cell JSON files and all server memory. Replay events → everything rebuilds. ONE source of truth.

---

#### Layer 6: ES6 Proxy for Client-Side Stubs (future)

TypeScript's `Proxy` object can intercept property access and method calls. This creates CORBA-like stubs — the client code looks like it's calling local methods, but every call goes to the server.

```typescript
// src/client/cell-ref.ts — Proxy-based stub (future use)

function createCellProxy(slug: string, mcpClient: MCPClient): ICellMethods {
  return new Proxy({} as ICellMethods, {
    get(_target, method: string) {
      // Special properties
      if (method === 'slug') return slug;
      if (method === 'then') return undefined;  // Prevent Promise auto-wrap

      // Every property access returns an async function
      // that forwards the call to the MCP server
      return async (args?: Record<string, unknown>) => {
        const result = await mcpClient.callTool('cell', {
          slug,
          method,
          args: args || {},
        });
        return JSON.parse(result.content[0].text);
      };
    }
  });
}

// Usage looks like LOCAL object access:
const cell = createCellProxy('task-a', client);
const dna = await cell.readDna();                           // → MCP tool call
await cell.updateField({ field: 'impl', value: '...' });   // → MCP tool call
const result = await cell.submit({ results: {...} });       // → MCP tool call
```

**This is the CORBA stub in 20 lines of TypeScript.** The ES6 Proxy intercepts every method call and forwards it to the MCP server. The cell never exists locally. The proxy IS the reference.

Not needed for v1 (Claude agents call MCP tools directly), but critical for v2 when JavaScript clients (dashboard, CLI tools, other services) need to interact with cells.

---

#### Architecture Summary

```
┌──────────────────────────────────────────────────────────────┐
│ XPollination MCP Server (TypeScript, Node.js)                │
│                                                               │
│  Layer 4: MCP Tools (transport binding)                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ login | logout | inbox | claim | cell | status          │ │
│  │                                                         │ │
│  │ cell(slug, method, args) ← single entry point           │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│  Layer 3: Method Dispatcher (ORB)                            │
│  ┌───────────────────────▼─────────────────────────────────┐ │
│  │ Routes (slug, method, args) → CellActor.method()        │ │
│  │ Whitelist: readDna, readField, updateField, submit, ... │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                          │                                    │
│  Layer 2: Cell Actors (remote objects)                       │
│  ┌───────────────────────▼─────────────────────────────────┐ │
│  │ task-a: CellActor { private cell, readDna(), submit() } │ │
│  │ task-b: CellActor { private cell, readDna(), submit() } │ │
│  │                                                         │ │
│  │ State is PRIVATE. All access through methods.           │ │
│  │ Read → structuredClone (projection).                    │ │
│  │ Write → validate, mutate, emit event, persist.          │ │
│  └───────────────┬────────────────────┬────────────────────┘ │
│                  │                    │                       │
│  Layer 5: Event Store          Atomic Persistence            │
│  ┌───────────────▼──────┐  ┌──────────▼───────────────────┐ │
│  │ /data/events.jsonl   │  │ /data/cells/*.cell.json      │ │
│  │                      │  │                              │ │
│  │ THE truth.           │  │ Materialized projections.    │ │
│  │ Append-only.         │  │ Derived from events.         │ │
│  │ Immutable.           │  │ Deletable. Rebuildable.      │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                               │
│  Layer 1: Interfaces (IDL)                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ICellMethods, ICellRef, IServer                         │ │
│  │ TypeScript interfaces = the contract                    │ │
│  │ Shared between server and client code                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  Layer 6: Proxy Stubs (future, for JS clients)               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ ES6 Proxy → intercepts method calls → MCP tool calls    │ │
│  │ createCellProxy(slug, client): ICellMethods             │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**How TypeScript achieves CORBA semantics without CORBA's weight:**

| CORBA Concept | TypeScript Equivalent | Lines of Code |
|---------------|-----------------------|---------------|
| IDL | TypeScript interfaces | ~30 |
| ORB | MethodDispatcher class | ~40 |
| Skeleton | CellActor class | ~150 |
| Stub | ES6 Proxy wrapper | ~20 |
| Object Reference | `{ slug, version, state }` | ~5 |
| IIOP (network protocol) | MCP over StreamableHTTP | SDK provided |

Total custom code: ~250 lines for the full remote-object architecture. CORBA needed thousands of lines of generated code plus runtime libraries. TypeScript's dynamic nature (Proxy, structuredClone, interfaces) makes this possible with minimal code.

**Node.js natural advantages for Actor Model:**

| Property | Why It Helps |
|----------|-------------|
| Single-threaded event loop | No race conditions within an actor. Method calls are naturally serialized. |
| `structuredClone()` (Node 17+) | Deep copy for read projections — no shared mutable references |
| `appendFileSync()` | Atomic append for event store |
| `writeFileSync() + renameSync()` | Atomic file replacement for cell persistence |
| ES6 Proxy | Client stubs with zero code generation |
| TypeScript interfaces | Compile-time contract verification, no IDL compiler needed |
| StreamableHTTP in MCP SDK | SSE push for notifications — no polling |

---

## Use Cases Discovered

| ID | Use Case | Discovered At | Status | V1? |
|----|----------|---------------|--------|-----|
| UC-01 | Server Identity Verification (Self-Certified PKI) | T2 | DESIGNED — v2 scope | No |
| UC-02 | Data Location Tracking (canonical vs copies) | T3 | UNDERSTOOD — design principle | Core |
| UC-03 | DRY Enforcement (no duplicate authoritative state) | T4 | DESIGNED — Actor + Event Sourcing + CQRS | Core |
| UC-04 | Remote Object Invocation (CORBA-like API) | T5 | DESIGNED — method dispatch via MCP tool | Core |
| UC-05 | TypeScript Implementation (6-layer architecture) | T6 | PLANNED — detailed code design | Core |

---

## STUDY

(To be filled after simulation complete)

## ACT

(To be filled after simulation complete)
