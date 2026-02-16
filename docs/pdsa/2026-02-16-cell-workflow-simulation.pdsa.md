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

**Design Decision: Thomas = Root of Trust (Self-Sovereign PKI)**

Trust chain:
```
Thomas's Identity Key (root, private, never shared)
    → signs Server Certificates (one per MCP server instance)
        → verified by Agents (carry Thomas's public key)
```

- NOT v1 scope — design only, implementation future
- Agents trust Thomas, Thomas certifies servers, agents trust certified servers
- No external CA dependency — full sovereignty
- Future tooling: `xpollination-cert-tool` (init, sign-server, verify, revoke, list)
- Connects to: "owner holds data" (certificate = permission), "extension of me" (agents carry Thomas's pubkey)

**Simulation result:** For v1, Liaison trusts server via VPN network trust (10.33.33.1 = Hetzner box, only reachable via WireGuard). Server identity verification is a v2 feature with self-certified PKI.

---

## Use Cases Discovered

| ID | Use Case | Discovered At | Status | V1? |
|----|----------|---------------|--------|-----|
| UC-01 | Server Identity Verification (Self-Certified PKI) | T2 | DESIGNED — v2 scope | No |

---

## STUDY

(To be filled after simulation complete)

## ACT

(To be filled after simulation complete)
