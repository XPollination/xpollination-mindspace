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
- **Discovery:** MCP `initialize` handshake returns `serverInfo: { name, version }` — this is the protocol-level identity
- **Gap found:** No cryptographic verification. Server claims a name, but nothing proves it's authentic.
- **Use case identified:** UC-01 — Server Identity Verification
- **Decision needed:** Is `serverInfo.name === "xpollination-mcp-server"` sufficient for v1? Or do we need signed identity?

---

## Use Cases Discovered

| ID | Use Case | Discovered At | Status |
|----|----------|---------------|--------|
| UC-01 | Server Identity Verification | T2 | OPEN — needs decision |

---

## STUDY

(To be filled after simulation complete)

## ACT

(To be filled after simulation complete)
