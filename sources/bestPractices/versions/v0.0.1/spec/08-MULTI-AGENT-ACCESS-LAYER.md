# XPollination — Multi-Agent Access Layer

> Loop 2 Documentation — 2026-02-17  
> Origin: Voice conversation, Thomas challenging Claude on how external AIs connect

## 1. The Core Problem

The XPollination best-practices system must be usable by **any AI, from any platform**. Not just Claude. Not just Claude Code. ChatGPT, Ollama, local models, any agent — they all need to be able to:

1. Enter the system
2. Be guided through a structured process
3. Contribute context and receive enriched knowledge back
4. Present findings to their human

This is **model-agnostic by design**.

## 2. The Guided Intake Process

### Why Guidance Is Needed

An AI agent arriving at the XPollination system doesn't know:
- What the system expects
- What context is required
- What format to submit in
- How long to wait
- What to do with the response

The system must **teach the agent how to use it** through the interaction itself. The agent learns by doing — the system asks, the agent responds, and through that back-and-forth, the agent understands the process.

### The State Machine

The interaction follows a strict state machine with explicit handoffs:

```
┌─────────────────────────────────────────────────┐
│                                                   │
│   STATE 1: ENTRY                                  │
│   "Hello. Welcome to XPollination Best Practices. │
│    I need context from you to proceed."           │
│                                                   │
│   System provides:                                │
│   - What this system is (1-2 sentences)           │
│   - What information is needed to proceed         │
│   - The format expected                           │
│                                                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│                                                   │
│   STATE 2: CONTEXT COLLECTION                     │
│   "Please provide the following..."               │
│                                                   │
│   Required fields (like a Java bean):             │
│   ┌─────────────────────────────────────────┐    │
│   │ intent:      What are you looking for?   │    │
│   │ domain:      Which topic area?           │    │
│   │ current_frame: What do you currently     │    │
│   │              understand about this?      │    │
│   │ angle:       From which perspective?     │    │
│   │ language:    de / en / other             │    │
│   │ depth:       surface / detailed / deep   │    │
│   └─────────────────────────────────────────┘    │
│                                                   │
│   Validation loop:                                │
│   WHILE (required fields incomplete):             │
│     → "I still need: [missing fields]"            │
│     → Agent provides additional context            │
│     → System validates                             │
│   END WHILE                                        │
│                                                   │
│   On complete: → "Context received. Processing."  │
│                                                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│                                                   │
│   STATE 3: PROCESSING                             │
│   "Please wait. Here is what I'm doing..."        │
│                                                   │
│   Live feedback to the agent:                     │
│   - "Searching vector database..."                │
│   - "Found 7 related thought traces"              │
│   - "Checking convergence zones..."               │
│   - "Evaluating truth anchoring..."               │
│   - "Composing response..."                       │
│                                                   │
│   The agent does NOT hang. It receives            │
│   continuous status updates so it knows           │
│   the system is working, not stuck.               │
│                                                   │
│   Timeout guidance:                               │
│   "This may take up to [X] seconds.              │
│    Please observe this channel for updates."      │
│                                                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│                                                   │
│   STATE 4: RETURN                                 │
│   "Here are my findings."                         │
│                                                   │
│   Structured response includes:                   │
│   - Matching best practices (with links/content)  │
│   - Related thought traces (summarized)           │
│   - Convergence zones identified                  │
│   - Truth anchoring scores                        │
│   - Angles not yet explored                       │
│   - Suggested next steps                          │
│                                                   │
│   Agent presents to human.                        │
│   Human decides direction.                        │
│                                                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│                                                   │
│   STATE 5: CONTRIBUTION (Optional)                │
│   "Would you like to contribute your findings?"   │
│                                                   │
│   If the conversation produced new insights:      │
│   - Agent can submit a new thought trace          │
│   - Goes through the same intake validation       │
│   - Gets traced and stored in the system          │
│   - Enriches the knowledge for future queries     │
│                                                   │
└─────────────────────────────────────────────────┘
```

## 3. The Context Bean (Structured Input)

Inspired by Thomas's Java bean analogy — a simple, structured object that must be populated before the system can process:

```yaml
inquiry_context:
  # Required fields — system will ask until these are filled
  required:
    intent: string          # "research" | "challenge" | "contribute" | "explore"
    domain: string          # Topic area: "layout", "cv", "social-media", etc.
    current_frame: string   # What the agent/human currently understands
    language: string        # "de" | "en" | other
    
  # Optional but enriching fields
  optional:
    angle: string           # Perspective/approach being taken
    depth: string           # "surface" | "detailed" | "deep"
    related_session: uuid   # If continuing from a previous inquiry
    specific_question: string  # If there's a precise question
    source_ai: string       # Which AI platform is calling
    
  # System-generated fields (not from agent)
  system:
    inquiry_id: uuid
    timestamp: ISO-8601
    intake_complete: boolean
    processing_status: string
    result_ready: boolean
```

## 4. Communication Protocol Options

### Option A: MCP Server (Model Context Protocol)

```
Pros:
  - Native integration with Claude Code
  - Standardized tool definition
  - AI agents naturally understand tool-calling patterns
  - Growing ecosystem support

Cons:
  - Not yet universally supported across all AI platforms
  - Requires the AI to have MCP capability
  
Implementation:
  - XPollination exposes an MCP server
  - Tools defined: search_best_practices, contribute_thought, 
    get_convergence_zones, check_truth_anchoring
  - Any MCP-compatible AI can discover and use these tools
```

### Option B: REST API with Guided Flow

```
Pros:
  - Universal — any AI that can make HTTP calls can use it
  - Simple, well-understood
  - Works with every platform

Cons:
  - Less "native" feeling — requires prompt engineering to use well
  - No built-in state management (needs session tracking)
  
Implementation:
  - Standard REST endpoints with session tokens
  - /api/v1/intake → starts the guided process
  - /api/v1/intake/{session}/context → submit context fields
  - /api/v1/intake/{session}/status → check processing status
  - /api/v1/intake/{session}/result → get findings
```

### Option C: Message Queue / Streaming

```
Pros:
  - True real-time communication
  - Natural for the "observe while processing" pattern
  - Supports the tmux-like live feedback model

Cons:
  - More complex to implement
  - Requires persistent connections
  
Implementation:
  - WebSocket or Server-Sent Events
  - Agent connects, receives guided prompts
  - Sends context incrementally
  - Receives live processing updates
  - Gets results streamed back
```

### Option D: Hybrid (Recommended starting point)

```
MCP server for Claude Code (primary interface)
  + REST API for universal access
  + WebSocket for live processing feedback

This covers:
  - Claude Code: native MCP tool calling
  - Any other AI: REST API
  - Live feedback: WebSocket upgrade during processing
```

## 5. The Live Feedback Mechanism

Thomas emphasized: the agent must NOT hang during processing. It must receive live feedback.

### Concept: Observable Processing

```
Analogy: Like a tmux session that the agent can observe.

The system opens a "processing channel" for each inquiry.
The agent watches this channel and sees:

  [11:42:01] Inquiry received. Starting processing.
  [11:42:02] Embedding your context...
  [11:42:03] Searching vector database: 14 candidates found
  [11:42:04] Filtering by domain: "layout" → 6 relevant
  [11:42:05] Traversing knowledge graph for relationships...
  [11:42:06] Found 2 convergence zones
  [11:42:07] Checking truth anchoring...
  [11:42:08] Composing response...
  [11:42:09] Response ready. Retrieving.

This serves two purposes:
  1. The agent knows the system isn't stuck
  2. The agent gets preliminary context it can start 
     thinking about before the full response arrives
```

### Implementation Approaches

```yaml
approach_1_websocket:
  description: "Dedicated WebSocket channel per inquiry"
  flow:
    - Agent opens WebSocket to /api/v1/process/{inquiry_id}/stream
    - Receives JSON messages with status updates
    - Final message contains full results
    - Connection closes

approach_2_sse:
  description: "Server-Sent Events (simpler, one-directional)"
  flow:
    - Agent connects to /api/v1/process/{inquiry_id}/events
    - Receives event stream with processing steps
    - Final event contains results
    
approach_3_polling:
  description: "Fallback for AIs that can't do streaming"
  flow:
    - Agent polls /api/v1/process/{inquiry_id}/status
    - Gets current state and progress percentage
    - When status = "complete", fetches results
```

## 6. How an AI Learns to Use the System

The system teaches through interaction, not documentation:

```
FIRST INTERACTION:
  System: "Welcome to XPollination Best Practices.
           I help you find and contribute knowledge
           across multiple perspectives.
           
           To proceed, I need:
           1. Your intent (research/challenge/contribute/explore)
           2. The domain you're interested in
           3. What you currently understand about the topic
           4. Your preferred language
           
           Please provide these, and I'll guide you from there."

  Agent provides partial info.

  System: "Thank you. I still need:
           - Your current understanding of the topic
             (this helps me find the right angles for you)
           
           Please provide this so I can proceed."

  Agent completes the context.

  System: "Context complete. Processing your inquiry.
           Watch this channel for updates..."

SECOND INTERACTION (same agent):
  The agent already knows the pattern.
  It provides all required fields upfront.
  System validates and proceeds immediately.
  
  The learning happened through the guided interaction itself.
```

## 7. Project Management Layer (Future Vision)

Thomas mentioned wanting a project management system within the best practices space — where AIs can collaborate on building something together.

### The Vision (Not Yet Implemented)

```
Current limitation:
  Each AI works in isolation. It has context for its own task
  but cannot see what other AIs are working on in parallel.

Future state:
  The XPollination system maintains a shared project board.
  AIs can:
  - See what tasks are in progress
  - Claim tasks they can contribute to  
  - Share intermediate findings
  - Build on each other's work
  
  This transforms AI from solo workers into team members
  operating within a shared context space.

Technical requirement:
  - Task/ticket system within the knowledge layer
  - Real-time visibility into what's being worked on
  - Handoff protocols between agents
  - Shared context that persists across agent sessions
```

> **Note**: This is documented for future reference. The immediate focus is on the single-agent guided intake process described above.

## 8. Open Questions from This Discussion

1. **Decentralization vs. Centralization** — See `09-DECENTRALIZATION-CHALLENGE.md` for the full analysis of this trade-off
2. **Which protocol first?** — MCP for Claude Code is the natural starting point, but REST API should follow quickly for universality
3. **Context bean evolution** — The required fields will evolve as we learn what the system actually needs to provide good responses
4. **Timeout and patience** — What's the acceptable processing time before an agent should be told "this will take longer"?
5. **Quality variance** — Different AIs produce different quality inputs. How does the system handle low-quality context submissions?
