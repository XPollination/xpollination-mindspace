# MISSION-LIVEKIT: Knowledge-Augmented Meetings

**Status:** Active | **Project:** xpollination-mindspace | **Created:** 2026-03-24 | **Version:** 3

## Vision

Meetings are not preparation for work — **meetings ARE the work**. A single companion agent listens to the room, synthesizes collective thoughts, and serves as a **voice-powered mission editor** — Jarvis for mission architecture. The group creates, evolves, and rewrites missions in real-time by speaking. By the end of the call, the artifact isn't just created — it's been debated, revised, and is linked to the full reasoning trail of how it came to be.

## Architecture Principle: Decentralization-First

The meeting room is a dumb pipe (LiveKit WebRTC). Intelligence lives in the A2A protocol. Any agent can connect. The default is efficient: one shared agent per room, token cost socialized.

## System Architecture

![Meeting Companion Agent — System Architecture](docs/missions/diagrams/meeting-agent-system.svg)

## Three Capabilities (Simultaneous, Coupled)

All three capabilities share the same speech stream and context. CAP-1 provides the conversational memory that makes CAP-2 work. CAP-3 wraps everything in GDPR-compliant attribution.

### CAP-1: Thought Synthesis

One agent per meeting listens to all speakers. The LLM detects **topic boundaries** (not time-based pauses) and synthesizes multi-speaker dialogue into distilled group thoughts.

A meaningful thought emerges over 30-60 seconds across speakers — Thomas frames, Robin challenges, Thomas resolves. The synthesis captures the result that no individual stated alone.

**Flow:**

![Thought Synthesis Flow](docs/missions/diagrams/thought-synthesis-flow.svg)

**Key decisions:**
- **Topic-boundary detection**, not time-based buffering — conversations shift topics, the agent detects the shift and synthesizes what came before
- **Cross-speaker synthesis** — input is 30-60s of multi-speaker dialogue, output is one coherent group thought
- Contributor = anonymous group ID (not individual, not "Meeting Agent")
- LLM outputs **per-synthesis attribution**: which speakers shaped which parts of the distilled thought
- The synthesis is the shared context for CAP-2 voice editing

### CAP-2: Voice Mission Editor ("Hey Mindspace")

Wake word activates a **Jarvis-like voice editor** for the entire mission hierarchy. Not a command-line with speech — a conversational co-author that understands context, resolves references, and rewrites content.

**Five roles of the voice editor:**

| Role | What it does | Example |
|------|-------------|---------|
| **Creator** | Builds new missions, capabilities, requirements | *"Hey Mindspace, create a mission called Platform Governance"* |
| **Writer** | Sets or rewrites content sections by title | *"Hey Mindspace, that's the vision — write it"* (resolves "that" from conversation) |
| **Reviser** | Rewrites existing sections with new framing | *"Hey Mindspace, change the Architecture chapter — the projection is now federation-first, not decentralization"* |
| **Reader** | Renders structure and reads back content | *"Hey Mindspace, show me this mission"* → renders tree in chat |
| **Navigator** | Transitions, moves, restructures | *"Hey Mindspace, move this to ready"* |

**The Reviser is the key differentiator.** Creating objects is step one. But missions are **living documents** that evolve through conversation. A framing change in one chapter cascades:

- The agent rewrites the requested section with the new framing
- Surfaces implications: *"This changes the assumptions in CAP-3 — should I update?"*
- Links the revision to the thought that caused it (from CAP-1)
- Bumps `content_version` — every revision tracked

**Use cases:**

| Use Case | Voice Input | Agent Action |
|----------|-----------|--------------|
| Create mission | *"Hey Mindspace, create a mission in governance about identity federation"* | OBJECT_CREATE → mission in xpollination-governance |
| Write vision from discussion | *"Hey Mindspace, that's the vision — write it"* | Resolves "that" from transcript → OBJECT_UPDATE content_md |
| Add capability | *"Hey Mindspace, add a capability: Group Signature Scheme"* | OBJECT_CREATE capability under current mission |
| Add requirement | *"Hey Mindspace, under onboarding, add: invite-only with sponsor accountability"* | Navigate to capability → OBJECT_CREATE requirement |
| Revise chapter | *"Hey Mindspace, change the provenance model — credit is contribution-to-synthesis, not speech volume"* | Find section by title → LLM rewrites with new framing → OBJECT_UPDATE |
| Cascade revision | *"Hey Mindspace, that changes the architecture too — update it"* | Identify affected sections → rewrite with new framing → OBJECT_UPDATE |
| Read back | *"Hey Mindspace, show me this mission"* | OBJECT_QUERY → render tree in chat |
| Navigate | *"Hey Mindspace, what capabilities does governance have?"* | OBJECT_QUERY with hierarchy |
| Transition | *"Hey Mindspace, this is ready — move it"* | TRANSITION → ready |
| Record decision | *"Hey Mindspace, add that decision to the notes"* | Append to content_md + link to thought trail |

**Conversational context is critical:**
- *"that"* → resolves to last discussed topic from transcript
- *"write it"* → resolves to what someone just said
- *"the second one"* → resolves to positional reference in last query result
- *"what Robin just said"* → resolves from speaker-attributed transcript
- *"update it too"* → resolves cascade from previous edit

**Flow:**

![Voice Mission Editor Flow](docs/missions/diagrams/voice-editor-flow.svg)

### CAP-3: Group Provenance

Anonymous group token system for GDPR-compliant collective attribution. Credit model evolved: not speech volume, but **contribution-to-synthesis**.

**Properties:**
- Token issued at agent activation covering all current participants
- External: cannot trace group token → individual members
- Internal: system computes per-person credit via synthesis attribution
- Each distilled thought carries attribution: which speakers' input shaped it

**Credit model:**
```
LLM synthesis output:
{
  thought: "Federation-first governance enables sovereign nodes with mandatory interop",
  attributions: [
    { speaker: "thomas", contribution: "initial framing" },
    { speaker: "robin", contribution: "challenge that refined to federation model" }
  ]
}
```

Credit isn't who spoke more — it's who contributed to the insight.

## Meeting Lifecycle

![Meeting Lifecycle — From Join to Provenance](docs/missions/diagrams/meeting-lifecycle-v2.svg)

## Provenance Model

![Group Provenance — Anonymous Attribution Model](docs/missions/diagrams/group-provenance.svg)

## What's Already Built (v0.0.37)

| Component | Status | Notes |
|-----------|--------|-------|
| LiveKit meeting page | Done | Feature-flagged, multi-device, 3 join modes |
| WebRTC video/audio | Done | Screen share, fullscreen, PiP, background blur |
| Chat (data channels) | Done | Real-time, renders in sidebar |
| Companion agent button | Done | Activates speech recognition |
| Speech recognition | Done | German, continuous, keyword extraction |
| Brain query (read) | Done | Context cards with drill-down |
| Kick/mute | Done | Via LiveKit RoomServiceClient |
| Participant identity | Done | Mindspace user → LiveKit identity |

## What Needs Building

| Component | Capability | Notes |
|-----------|-----------|-------|
| Topic-boundary detection | CAP-1 | Replace 3s timer with semantic shift detection |
| Cross-speaker synthesis | CAP-1 | LLM: multi-speaker dialogue → one group thought |
| Per-synthesis attribution | CAP-1 + CAP-3 | LLM outputs which speakers shaped the thought |
| Group token issuance | CAP-3 | SHA-256(sorted IDs + salt) at activation |
| Brain write with group_token | CAP-1 | Remove read_only, persistent session_id |
| Wake word detection | CAP-2 | "Hey Mindspace" client-side trigger |
| Dialogue context manager | CAP-2 | Track conversation state, resolve references |
| LLM content generation | CAP-2 | Section rewriting with new framing |
| Cascade detection | CAP-2 | Identify affected sections when framing changes |
| Read-back rendering | CAP-2 | Mission tree → chat card / voice response |
| A2A OBJECT_CREATE impl | CAP-2 | Currently stub |
| A2A OBJECT_UPDATE impl | CAP-2 | Currently stub |
| Content versioning trail | CAP-2 + CAP-3 | Each edit linked to thought that caused it |
| Contribution-to-synthesis credit | CAP-3 | Replace speech-volume with attribution model |
