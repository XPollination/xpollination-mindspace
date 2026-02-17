# XPollination — Core Architecture & Data Flow

## 1. System Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERFACE LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Voice Input   │  │ Chat Input   │  │ Agent Interface   │  │
│  │ (Speech-to-   │  │ (Text-based  │  │ (Claude Code /   │  │
│  │  Text Live)   │  │  claude.ai)  │  │  Server CLI)     │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         └─────────────────┼───────────────────┘             │
│                           ▼                                  │
│              ┌────────────────────────┐                      │
│              │   THOUGHT DECODER      │                      │
│              │   (AI Mirroring Agent) │                      │
│              └────────────┬───────────┘                      │
└───────────────────────────┼─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              THOUGHT TRACING ENGINE                     │ │
│  │                                                         │ │
│  │  1. Segment thought into atomic concepts                │ │
│  │  2. Generate vector embeddings per concept              │ │
│  │  3. Map relationships between concepts (knowledge graph)│ │
│  │  4. Detect angle of approach                            │ │
│  │  5. Score truth anchoring (biblical alignment)          │ │
│  │  6. Find resonance with existing thought traces         │ │
│  │  7. Identify convergence zones                          │ │
│  └────────────────────────┬───────────────────────────────┘ │
└───────────────────────────┼─────────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   PERSISTENCE LAYER                          │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  Vector Database  │  │  Knowledge Graph Database        │ │
│  │  (Embeddings +    │  │  (Relationships + Convergence    │ │
│  │   Semantic Search) │  │   Maps + Truth Anchors)          │ │
│  └────────┬─────────┘  └──────────────┬───────────────────┘ │
│           └──────────────┬────────────┘                      │
│                          ▼                                   │
│           ┌──────────────────────────┐                       │
│           │  Markdown Best Practices │                       │
│           │  (Human-readable output) │                       │
│           │  (/best-practices/ repo) │                       │
│           └──────────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

## 2. Data Flow: From Spoken Thought to Structured Knowledge

### Phase 1: Capture

```
Input:  Human speaks naturally (voice or text)
Output: Raw transcription + session metadata

Metadata includes:
  - timestamp (ISO 8601)
  - speaker_id (anonymous or identified)
  - session_id (conversation thread)
  - interface_type (voice / text / agent)
  - language (de / en / bilingual)
```

### Phase 2: Decode

```
Input:  Raw transcription
Output: Structured thought interpretation

The Thought Decoder (AI agent) performs:
  1. Parse the stream of consciousness into discrete thought units
  2. Identify the core assertion/insight per unit
  3. Detect the emotional/intentional weight
  4. Map to existing concept vocabulary where possible
  5. Flag novel concepts that extend the knowledge space
  6. Generate a structured mirror response for the human
```

### Phase 3: Refine (The Mirroring Loop)

```
Input:  Decoded thought + human feedback
Output: Refined convergence point

Loop mechanics:
  WHILE (human continues refining):
    1. AI presents decoded understanding
    2. Human corrects, extends, or confirms
    3. AI integrates delta into understanding
    4. Refinement score increases with each iteration
    5. When human confirms alignment → convergence reached
  
  On convergence:
    - Mark thought trace as "aligned"
    - Calculate confidence score based on iteration depth
    - Record the full refinement path (not just the endpoint)
```

### Phase 4: Embed & Store

```
Input:  Aligned thought trace (full path + convergence point)
Output: Vector embeddings + graph nodes + markdown documentation

Storage operations (parallel):
  
  A. Vector Database:
     - Embed each thought unit as a high-dimensional vector
     - Store with metadata: speaker, timestamp, angle, session
     - Enable semantic similarity search across all thought traces
  
  B. Knowledge Graph:
     - Create nodes for concepts, thinkers, convergence points
     - Create edges for relationships: 
       DERIVES_FROM, CONVERGES_WITH, ANCHORED_IN, REFINES
     - Store the angle of approach as edge metadata
     - Link to biblical truth anchors where applicable
  
  C. Markdown Best Practices:
     - When convergence reaches sufficient confidence:
       Generate/update a best-practice document
     - Human-readable, version-controlled (git)
     - Serves as the accessible surface layer
```

### Phase 5: Resurface

```
Input:  New thinker arrives with a question or thought
Output: Multi-angle context from existing thought traces

Retrieval process:
  1. Embed the new thought/question
  2. Vector search: find semantically similar thought traces
  3. Graph traversal: find related concepts and convergence zones
  4. Angle analysis: identify which existing traces approached
     from different directions than the new thinker
  5. Truth anchor check: prioritize traces with strong biblical grounding
  6. Compose response: present multiple angles without prescribing
```

## 3. Hybrid Storage Architecture

### Why Both Vector Database AND Knowledge Graph

Based on current best practices (2026), a hybrid approach is essential:

**Vector Database** handles:
- Semantic similarity search (finding thought traces that "feel" related)
- Fuzzy matching across languages (German/English bilingual support)
- Fast retrieval across large volumes of unstructured thought data
- Embedding the "texture" of thinking — not just keywords, but meaning

**Knowledge Graph** handles:
- Explicit relationships between concepts (A derives from B)
- Multi-hop reasoning (tracing a thought through 3+ connected concepts)
- Convergence mapping (where do multiple paths actually meet?)
- Truth anchoring (explicit links to biblical references)
- Reproducibility (you can always trace back through the graph to origins)

### Recommended Technology Stack

| Component | Recommended | Why |
|---|---|---|
| Vector DB | **Qdrant** or **Weaviate** | Open-source, self-hosted, hybrid search support |
| Knowledge Graph | **Neo4j** or **FalkorDB** | Open-source options, strong graph traversal |
| Embedding Model | **BGE-M3** (BAAI) | Multilingual (DE/EN), up to 8192 tokens, open-source |
| Markdown Store | **Git repository** | Version-controlled, human-readable, agent-accessible |
| Speech-to-Text | **Whisper** (OpenAI) or **Faster-Whisper** | Open-source, multilingual, real-time capable |
| AI Backbone | **Claude** (Anthropic) | Strong reasoning, long context, agent-capable |

> **Note on open-source preference**: All components should be self-hostable and open-source where possible, consistent with XPollination's AGPL-3.0 licensing and Thomas's preference for open-source solutions.

## 4. Real-Time Context Injection

The system must provide the AI agent with **live context during conversation**:

```
During active conversation:
  
  EVERY time the human speaks:
    1. Embed the new utterance in real-time
    2. Query vector DB for relevant existing traces (top-k)
    3. Query knowledge graph for connected concepts
    4. Inject this context into the AI's working memory
    5. AI responds with awareness of:
       - What other thinkers have explored nearby
       - Where convergence zones exist
       - What biblical anchors are relevant
       - What angles haven't been explored yet
```

This transforms the AI from a static responder into a **contextually aware thinking partner** that grows smarter within the conversation — not through model updates, but through persistent external memory.

## 5. The Documentation Loop

After each aligned conversation cycle:

```
1. AI generates structured documentation (markdown)
2. Documentation captures:
   - The convergence point (what we agreed on)
   - The thought paths (how we got there)
   - The angles explored (from which directions)
   - The truth anchoring (biblical grounding)
   - Technical implications (what to build)
   - Open questions (what's still unresolved)
3. Documentation is committed to the best-practices repo
4. Next conversation starts by loading relevant documentation
5. The loop continues — each cycle adds clarity
```

## 6. Multi-Agent Integration

The system supports multiple agents working from the same knowledge:

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Voice Agent  │  │ CV Agent    │  │ Social Media │
│ (Thought     │  │ (Profile    │  │ Agent        │
│  Capture)    │  │  Assistant) │  │ (LinkedIn)   │
└──────┬───────┘  └──────┬──────┘  └──────┬───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ▼
              ┌─────────────────────┐
              │  Shared Knowledge   │
              │  (Vector DB +       │
              │   Knowledge Graph + │
              │   Best Practices)   │
              └─────────────────────┘
```

All agents:
- **Read** from the shared knowledge before starting work
- **Apply** documented patterns during work
- **Contribute** new findings after completing work
- **Reference** the same truth anchors for consistency
