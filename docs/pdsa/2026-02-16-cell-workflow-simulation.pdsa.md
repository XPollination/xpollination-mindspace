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
