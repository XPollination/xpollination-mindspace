# Mindspace Overview — Visual Map

> Auto-generated from `mindspace-simulation.yaml`. This renders as a visual diagram on GitHub.

## The Mindmap Tree

```mermaid
mindmap
  root((XPollination Mindspace))
    mindspace[xpollination-mindspace]
      req(Requirements)
        vision["Vision PDSA<br/>ACTIVE — 4/5 gates pass<br/>owner: pdsa-agent"]
        schema["Node schema validation<br/>ACTIVE<br/>owner: pdsa-agent"]
        state_machine["State machine design<br/>ACTIVE<br/>owner: pdsa-agent"]
        dual_links["Dual-links pattern<br/>COMPLETE<br/>owner: pdsa-agent"]
      feat(Features — BLOCKED by Requirements)
        graph["Graph traversal"]
        dragdrop["Drag-and-drop"]
        dordod["DoR/DoD display"]
      infra(Infrastructure — BLOCKED)
        tech["Tech stack<br/>Hugo, Alpine.js, Tailwind"]
        migration["v2 data migration"]
    mcp[xpollination-mcp-server]
      mcp_req(Requirements)
        infra_pdsa["Infrastructure layer PDSA<br/>ACTIVE — 3/4 gates pass<br/>owner: pdsa-agent"]
        zero_knowledge["Zero-knowledge agent protocol<br/>PENDING<br/>owner: pdsa-agent"]
      mcp_feat(Features)
        pipeline["Content pipeline<br/>COMPLETE — all 8 tools"]
        state_api["State machine API<br/>PENDING — blocked"]
      mcp_infra(Infrastructure)
        existing["Node.js + SQLite + MCP SDK<br/>COMPLETE"]
        schema_ext["SQLite schema extension<br/>PENDING"]
        tests["Unit tests<br/>PENDING"]
```

## Status Legend

| Status | Meaning | Count |
|--------|---------|-------|
| COMPLETE | All quality gates pass, outputs delivered | 4 |
| ACTIVE | Work in progress, some gates pass | 4 |
| PENDING | Not yet started or blocked by dependencies | 10 |

## Current Focus (Scope Stack)

```
root → mindspace → Requirements → Vision PDSA ← YOU ARE HERE
```

## Dependency Flow

```mermaid
flowchart LR
    vision["Vision PDSA"] --> schema["Node Schema"]
    vision --> infra_pdsa["MCP Infra PDSA"]
    infra_pdsa --> zero_k["Zero-Knowledge Protocol"]
    infra_pdsa --> state_api["State Machine API"]
    schema --> features["Mindspace Features"]
    schema --> migration["v2 Data Migration"]
    features --> ms_infra["Mindspace Infrastructure"]
    schema --> ms_infra
    infra_pdsa --> schema_ext["SQLite Schema Extension"]
    schema --> schema_ext

    style vision fill:#f59e0b,color:#000
    style schema fill:#f59e0b,color:#000
    style infra_pdsa fill:#f59e0b,color:#000
    style zero_k fill:#94a3b8,color:#000
    style state_api fill:#94a3b8,color:#000
    style features fill:#94a3b8,color:#000
    style migration fill:#94a3b8,color:#000
    style ms_infra fill:#94a3b8,color:#000
    style schema_ext fill:#94a3b8,color:#000
```

**Legend:** Amber = active work | Gray = blocked/pending

## Node Detail: What Each Active Node Needs

### Vision PDSA (ms-vision)
- **What:** Synthesize Thomas's mindmap metaphor with v3 recursive tree design
- **DoR:** Thomas's vision input captured -- READY
- **DoD:** Thomas approves vision -- 4/5 gates PASS, awaiting Thomas approval
- **Output:** `docs/pdsa/2026-02-02-UTC-1300.mindspace-vision.pdsa.md`

### Node Schema (ms-node-schema)
- **What:** Validate the draft schema from Vision PDSA Section 4.1 by using it in the mockup
- **DoR:** Vision PDSA draft schema -- READY
- **DoD:** Schema represents all nodes with full DoR/DoD. Thomas confirms.
- **Output:** Validated schema or schema revision

### State Machine Design (ms-state-machine)
- **What:** Walk through the state machine with the mockup's nodes, verify transitions
- **DoR:** MCP Infrastructure PDSA Section 4 -- READY
- **DoD:** State machine handles all node lifecycle scenarios
- **Output:** Validated state machine or revision

### MCP Infrastructure Layer PDSA (mcp-infra-pdsa)
- **What:** Define MCP server's new role: API surface, state machine, data model
- **DoR:** Vision PDSA three-actor model -- READY
- **DoD:** Full API surface, state machine lifecycle, SQLite schema -- 3/4 gates PASS, awaiting Thomas approval
- **Output:** `xpollination-mcp-server/docs/pdsa/2026-02-02-UTC-1500.mcp-server-infrastructure-layer.pdsa.md`

## Agents

| Agent | Color | Active Nodes |
|-------|-------|-------------|
| Thomas | amber | Approval gates on Vision + MCP Infra |
| Orchestrator | indigo | mindspace, mcp-server (coordination) |
| PDSA | violet | Vision, Schema, State Machine, MCP Infra, Zero-Knowledge |
| Dev | emerald | Standing by (features/infra blocked by requirements) |
