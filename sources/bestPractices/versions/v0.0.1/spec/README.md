# XPollination Thought Tracing System — Specification

> First documented: 2026-02-17  
> Status: Initial specification — Loop 1 complete  
> Origin: Live voice conversation between Thomas and Claude

## What Is This?

This is the requirement specification and technical architecture for the **XPollination Thought Tracing System** — a real-time conversational knowledge system that captures the trajectory of human thinking, traces it through a hybrid vector + graph database, and surfaces multi-angle convergence grounded in biblical truth.

This specification was generated through the system's own methodology: a live mirroring loop where Thomas spoke his vision and Claude decoded, reflected, and structured it into documentation.

## Documents

| # | Document | What It Covers |
|---|---|---|
| 01 | [System Vision](01-SYSTEM-VISION.md) | Why this system exists. The philosophy, the bubble problem, the organic growth model, truth anchoring as North Star |
| 02 | [Core Architecture](02-CORE-ARCHITECTURE.md) | How data flows from spoken thought to structured knowledge. System components, processing layers, the documentation loop |
| 03 | [Agent Guidelines](03-AGENT-GUIDELINES.md) | How agents must behave. The mirroring protocol, knowledge contribution rules, thought unit schema, conflict resolution |
| 04 | [Vector DB & Graph Strategy](04-VECTOR-DB-AND-GRAPH-STRATEGY.md) | Hybrid storage design. Qdrant + Neo4j/FalkorDB, embedding strategy, search patterns, scaling phases |
| 05 | [Truth Anchoring System](05-TRUTH-ANCHORING-SYSTEM.md) | The compass. Scoring mechanism, anchoring hierarchy, theological humility, generational reproducibility |
| 06 | [Integration Spec](06-INTEGRATION-SPEC.md) | How it all connects. Server architecture, API design, Docker deployment, migration path from current state |
| 07 | [Conversation Trace #001](07-CONVERSATION-TRACE-001.md) | The first traced conversation. Thought paths, convergence points, angles, open questions |

## How to Read This

**If you're a human**: Start with `01-SYSTEM-VISION.md` to understand the purpose, then browse by interest.

**If you're an agent**: Start with `03-AGENT-GUIDELINES.md` for your operating instructions, then read `02-CORE-ARCHITECTURE.md` for system context.

**If you're building**: Start with `06-INTEGRATION-SPEC.md` for the practical implementation path, referencing `04-VECTOR-DB-AND-GRAPH-STRATEGY.md` for database design.

## Relationship to Existing Repos

This specification describes the **platform** that the existing XPollination repositories plug into:

```
xpollination-spec/          ← THIS REPO (you are here)
  └── Defines the thought tracing platform

best-practices/             ← EXISTING REPO
  └── The human-readable output layer
  └── Agents read from and write to this
  └── Convergence zones crystallize into best practice docs here

profile-assistant/          ← EXISTING PROJECT
  └── CV/cover letter generation agent
  └── Reads best-practices/layout/ and best-practices/cv-content/

social-media-agent/         ← EXISTING PROJECT
  └── LinkedIn content agent
  └── Reads best-practices/social-media/
```

## Evolution

This specification is alive. Each conversation loop that reaches alignment triggers a documentation update. The specification grows the same way the knowledge system it describes grows — organically, through traced thought paths converging toward truth.

## License

Inherits the XPollination dual license:
- **Open Source**: AGPL-3.0
- **Commercial**: Contact office@xpollination.earth
