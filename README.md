# xpollination-mindspace

Mindmap-based project management for human-agent alignment.

## Overview

Mindspace is a project management tool built around the **mindmap** metaphor: trees of shared thought that both humans and agents always understand. Each node in the tree represents a project, thought, or task — with sub-nodes for deeper decomposition and PDSA cycles for execution.

## Top-Level Nodes

- **HomeAssistant** — Infrastructure (Hetzner CX22, Synology DS218, VPN)
- **xpollination-mcp-server** — Content pipeline
- **xpollination-mindspace** — This tool / the mindmap itself

## Key Concepts

- **PDSA (Plan-Do-Study-Act)** — Every significant operation documented as a PDSA cycle
- **Dual-link pattern** — Each link has a human-readable form (git URLs) and an agent-readable form (local filesystem paths)
- **Intrinsic quality gates** — Entry/exit criteria (Definition of Ready / Definition of Done) are properties of the node itself
- **Graph traversal** — Navigate the full graph; drag-and-drop nodes between branches as thinking evolves

## Structure

```
xpollination-mindspace/
├── README.md
├── CLAUDE.md
└── docs/
    └── pdsa/
```
