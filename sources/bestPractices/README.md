# bestPractices Context

> Context: bestPractices
> Project: XPollination Thought Tracing System
> First version: v0.0.1 (2026-02-17)

## What This Is

The specification and architecture for the XPollination Thought Tracing System — a real-time conversational knowledge system that captures human thinking trajectories, traces them through hybrid vector + graph storage, and surfaces multi-angle convergence grounded in biblical truth.

## Versioning

Follows the ProfileAssistant pattern:

```
sources/bestPractices/versions/
├── v0.0.1/
│   ├── spec/           # Specification documents
│   ├── deliverables/   # Compiled outputs (when applicable)
│   └── pdsa/           # Process documentation
├── v0.0.2/             # Next iteration
└── ...
```

## Relationship to Other Repos

```
xpollination-mcp-server/sources/bestPractices/  ← Platform spec (THIS)
  └── Defines the thought tracing system architecture

best-practices/                                  ← Output layer
  └── Human-readable best practice documents
  └── Agents read from and write to this

ProfileAssistant/                                ← Consumer
  └── Reads best-practices/layout/ and cv-content/
```

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v0.0.1 | 2026-02-17 | Initial spec import — 10 documents from voice conversation loops |
