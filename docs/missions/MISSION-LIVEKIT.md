# MISSION-LIVEKIT: Knowledge-Augmented Meetings

**Status:** Active | **Project:** xpollination-mindspace | **Created:** 2026-03-24

## Vision

Meetings are not preparation for work — **meetings ARE the work**. A single companion agent listens to the room, distills collective thoughts, and lets the group create and edit missions in real-time via voice commands. By the end of the call, the artifact exists — co-authored, provenance-tracked, and linked to the reasoning trail.

## Architecture Principle: Decentralization-First

The meeting room is a dumb pipe (LiveKit WebRTC). Intelligence lives in the A2A protocol. Any agent can connect. The default is efficient: one shared agent per room, token cost socialized.

## Three Capabilities (Simultaneous, Not Sequential)

### CAP-1: Thought Distillation

One agent per meeting listens to all speakers. LLM filters noise and distills meaningful group thoughts. Written to brain with anonymous group token.

**Flow:**
```
Speech (all speakers) → Buffer (3s pause) → LLM Distillation → Brain Write
                                                  ↓
                                          "Is this meaningful?"
                                          Yes → Distill to 1 clear statement
                                          No  → Discard
```

**Key decisions:**
- Contributor = anonymous group ID (not individual, not "Meeting Agent")
- Each person gets provenance credit internally
- Group membership is non-reversible externally (group signature scheme)
- LLM is the filter, not a parrot — raw "ähm, also ich denke..." becomes "Governance should follow decentralized pattern"

### CAP-2: Voice Commands ("Hey Mindspace")

Wake word triggers A2A actions. The group collectively authors artifacts during the call.

**Supported commands (mapped to existing A2A verbs):**

| Voice Intent | A2A Message Type | Example |
|-------------|-----------------|---------|
| "Create a mission..." | `OBJECT_CREATE` | "Hey Mindspace, create a mission in xpollination-governance called Decentralized Identity" |
| "Add to the description..." | `OBJECT_UPDATE` | "Hey Mindspace, add capability: group signature scheme for anonymous provenance" |
| "What missions do we have about..." | `OBJECT_QUERY` | "Hey Mindspace, show active missions about identity" |
| "Move this to ready" | `TRANSITION` | "Hey Mindspace, transition Decentralized Identity to ready" |

**Flow:**
```
"Hey Mindspace" (wake word) → Capture command speech → LLM Intent Parsing
        ↓                                                      ↓
  Command mode active                              A2A Message Type + Payload
  (visual indicator)                                           ↓
                                                    POST /a2a/message
                                                           ↓
                                                    Response → Chat card
```

**Key decisions:**
- LLM parses natural language → structured A2A message (intent + payload)
- A2A execution stays LLM-less (mechanical routing)
- Response rendered as chat card in meeting UI
- Thought trail auto-links to created/edited objects as provenance chain

### CAP-3: Group Provenance

Anonymous group token system for GDPR-compliant collective attribution.

**Properties:**
- Token issued at agent activation covering all current participants
- External: cannot trace group token → individual members
- Internal: system can compute per-person contribution credit
- Mathematical binding: group token ↔ participant set (verifiable, non-reversible)
- Provenance shared: value flows back to all contributors

**Model:**
```
Meeting activated → Participants enumerated → Group Token issued
                                                    ↓
                                        SHA-256(sorted_participant_ids + salt)
                                                    ↓
                                        group_token = "grp-a7f3e2..."
                                                    ↓
                        Stored: { group_token, participant_ids[], created_at, meeting_room }
                                        (server-side only, never exposed)
                                                    ↓
                        Brain writes use: contributor_id = group_token
                                                    ↓
                        Provenance query: system resolves group_token → credit per person
```

## System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MEETING ROOM (LiveKit)                       │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                         │
│  │ Thomas   │  │ Robin    │  │ Person N │  ← Authenticated users   │
│  │ (Safari) │  │ (Chrome) │  │ (any)    │    via Mindspace JWT     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                         │
│       │              │              │                               │
│       └──────────────┼──────────────┘                               │
│                      │                                              │
│              ┌───────▼────────┐                                     │
│              │ Companion Agent│  ← Activated by ANY participant     │
│              │  (in browser)  │    One per room, serves everyone    │
│              └───────┬────────┘                                     │
│                      │                                              │
│         ┌────────────┼────────────┐                                 │
│         │            │            │                                  │
│    Speech API   "Hey Mindspace"  Group Token                        │
│    (continuous)  (wake word)     (at activation)                    │
│         │            │            │                                  │
└─────────┼────────────┼────────────┼─────────────────────────────────┘
          │            │            │
          ▼            ▼            ▼
┌─────────────┐ ┌──────────┐ ┌───────────────┐
│ LLM         │ │ LLM      │ │ Group Token   │
│ Distillation│ │ Intent   │ │ Issuance      │
│             │ │ Parsing  │ │               │
│ "meaningful │ │ speech → │ │ participants  │
│  thought?"  │ │ A2A msg  │ │ → anon token  │
└──────┬──────┘ └────┬─────┘ └───────┬───────┘
       │             │               │
       ▼             ▼               │
┌────────────┐ ┌──────────┐         │
│ Brain API  │ │ A2A      │         │
│ (write     │ │ Message  │         │
│  thought,  │ │ Router   │         │
│  group_id) │ │          │         │
└────────────┘ └──────────┘         │
       ▲             │               │
       │             ▼               │
       │      ┌──────────┐          │
       │      │ Response │          │
       │      │ → Chat   │          │
       └──────│   card   │──────────┘
              └──────────┘    (all writes use group_token)
```

## Data Flow: Complete Meeting Lifecycle

```
BEFORE MEETING
  Participants log in → Mindspace JWT → LiveKit token → Join room

AGENT ACTIVATION (one person clicks 🤖)
  1. Enumerate current participants via LiveKit API
  2. Issue group token: SHA-256(sorted_ids + salt) → grp-xxxxx
  3. Store mapping server-side: grp-xxxxx → [thomas-id, robin-id, ...]
  4. Start speech recognition (continuous, all audio)
  5. Visual: "Agent listening — thoughts shared as group"

DURING MEETING (continuous, parallel)
  Thought Distillation (background):
    speech buffer → 3s pause → LLM: "distill or discard"
    → Brain POST: { contributor_id: grp-xxxxx, content: "distilled thought" }

  Voice Commands (on demand):
    "Hey Mindspace" detected → command mode
    → LLM: parse intent → A2A message
    → POST /a2a/message → response → chat card
    → Linked thought: "Group created mission X because [context]"

AFTER MEETING
  Query: "What did the group discuss?"
  → Brain: all thoughts with contributor_id = grp-xxxxx
  → Provenance: system resolves → Thomas contributed 60%, Robin 40%
  → Artifacts: missions/capabilities created during call, linked to thought trail
```

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

| Component | Capability | Dependency |
|-----------|-----------|------------|
| LLM distillation endpoint | CAP-1 | LLM API access |
| Group token issuance | CAP-3 | Server-side, no LLM |
| Brain write with group_id | CAP-1 | Remove read_only, add group_token |
| Wake word detection | CAP-2 | Client-side speech processing |
| LLM intent parsing | CAP-2 | LLM API access |
| A2A OBJECT_CREATE impl | CAP-2 | Currently stub |
| A2A OBJECT_UPDATE impl | CAP-2 | Currently stub |
| Response → chat card | CAP-2 | Frontend rendering |
| Provenance credit resolver | CAP-3 | Math/crypto, no LLM |
| Persistent meeting session_id | CAP-1 | Replace per-query session ID |

## Provenance Model Detail

```
External view (brain query):         Internal view (system):
┌─────────────────────┐              ┌─────────────────────────────────┐
│ contributor: grp-a7f│              │ group: grp-a7f                  │
│ thought: "Governance│              │ members: [thomas, robin]        │
│  should be decent..." │            │ contributions:                  │
│ topic: governance   │              │   thomas: 12 speech segments    │
│ meeting: room-xyz   │              │   robin: 8 speech segments      │
└─────────────────────┘              │ credit: thomas 60%, robin 40%   │
                                     │ objects_created: [mission-xyz]  │
  Anyone can see the thought.        │ salt: <random>                  │
  Nobody can see who was             └─────────────────────────────────┘
  in the group.
                                       System can prove to thomas:
                                       "You contributed to 47 group
                                        thoughts this month."
                                       Without telling robin what
                                       thomas's groups are.
```
