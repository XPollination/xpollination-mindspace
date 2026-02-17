# XPollination — Integration Specification

## 1. Current State vs. Target State

### Current State (February 2026)

```
Thomas speaks → claude.ai (voice transcription) → Claude responds
                                                 → No persistence
                                                 → No server connection
                                                 → No thought tracing
                                                 → Manual documentation
                                                 → Best practices in git (markdown only)
```

### Target State (Phase 1)

```
Thomas speaks → Voice Interface → Speech-to-Text → Thought Decoder Agent
                                                          ↓
                                                   Real-time context
                                                   from Vector DB + Graph
                                                          ↓
                                                   Mirroring response ←→ Human refines
                                                          ↓
                                                   On alignment:
                                                   → Store in Vector DB
                                                   → Store in Knowledge Graph
                                                   → Update best-practices repo
                                                   → All on Thomas's server
```

## 2. Component Integration Map

### 2.1 Voice Interface → Server

```yaml
voice_pipeline:
  input: Microphone (any device — phone, desktop, tablet)
  
  speech_to_text:
    engine: "faster-whisper"  # Self-hosted, open-source
    model: "large-v3"
    languages: ["de", "en"]   # Auto-detect German/English
    mode: "streaming"         # Real-time transcription
    output: text chunks with timestamps
    
  transport:
    protocol: WebSocket       # Low-latency bidirectional
    endpoint: "wss://server:port/voice"
    auth: API key or session token
    
  note: >
    Current gap: Thomas uses claude.ai voice which transcribes 
    client-side. Target: self-hosted pipeline on Thomas's server
    that feeds directly into the Thought Decoder Agent.
```

### 2.2 Thought Decoder Agent (Claude Code on Server)

```yaml
thought_decoder:
  runtime: "Claude Code"      # Running on Thomas's server
  model: "claude-sonnet"      # Or opus for complex reasoning
  
  system_prompt_includes:
    - XPollination agent guidelines (03-AGENT-GUIDELINES.md)
    - Current conversation context
    - Real-time retrieved context from Vector DB
    - Relevant best practices from git repo
    
  input: Transcribed text stream
  
  processing:
    1. Receive text chunk
    2. Query Vector DB for relevant context (real-time)
    3. Decode thought: extract core assertions
    4. Generate mirror response
    5. Present to human for refinement
    6. On alignment: trigger storage pipeline
    
  output:
    - Mirror response (text, spoken back via TTS if desired)
    - Structured thought unit (for storage)
    - Documentation update (markdown)
```

### 2.3 Storage Pipeline

```yaml
storage_pipeline:
  trigger: "Convergence reached in mirroring loop"
  
  steps:
    - name: "Generate embedding"
      input: Decoded thought unit
      engine: BGE-M3 (self-hosted)
      output: 1024-dim vector
      
    - name: "Store in Vector DB"
      target: Qdrant (self-hosted)
      collection: "thought_traces"
      data: vector + metadata payload
      
    - name: "Update Knowledge Graph"
      target: Neo4j / FalkorDB (self-hosted)
      operations:
        - Create ThoughtUnit node
        - Create relationships (CONTRIBUTED, NEXT, APPROACHES_FROM)
        - Check for convergence (CONVERGES_AT)
        - Check truth anchoring (ANCHORED_IN)
        
    - name: "Update Best Practices"
      condition: "Convergence zone reaches 'established' status"
      target: Git repo (best-practices/)
      operations:
        - Generate or update markdown document
        - Git add, commit, push (atomic)
        
    - name: "Notify other agents"
      condition: "New convergence or best practice"
      method: Event bus or file-based signal
      data: References to new/updated knowledge
```

## 3. Server Architecture

### 3.1 Thomas's Server Setup

```
┌──────────────────────────────────────────────────────┐
│                  Thomas's Server                      │
│                                                       │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │  Faster-Whisper  │  │  Claude Code              │  │
│  │  (Speech-to-Text)│  │  (Thought Decoder Agent)  │  │
│  └────────┬─────────┘  └──────────┬───────────────┘  │
│           │                       │                    │
│           └───────────┬───────────┘                    │
│                       ▼                                │
│           ┌───────────────────────┐                    │
│           │  Orchestration Layer  │                    │
│           │  (manages data flow)  │                    │
│           └───────────┬───────────┘                    │
│                       │                                │
│           ┌───────────┼───────────┐                    │
│           ▼           ▼           ▼                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐        │
│  │  Qdrant   │  │  Neo4j / │  │  Git Repo    │        │
│  │  Vector DB│  │  FalkorDB│  │  (best-      │        │
│  │           │  │  Graph DB│  │   practices/) │        │
│  └──────────┘  └──────────┘  └──────────────┘        │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  BGE-M3 Embedding Service                     │    │
│  │  (generates vectors for all text inputs)      │    │
│  └──────────────────────────────────────────────┘    │
│                                                       │
│  ┌──────────────────────────────────────────────┐    │
│  │  Other Agents                                  │    │
│  │  ├── ProfileAssistant (CV generation)          │    │
│  │  ├── Social Media Agent (LinkedIn)             │    │
│  │  └── HomeAssistant (home automation)           │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 3.2 Deployment Strategy

```yaml
deployment:
  containerization: Docker Compose
  
  services:
    qdrant:
      image: qdrant/qdrant:latest
      ports: [6333, 6334]
      volumes: ["./qdrant_data:/qdrant/storage"]
      
    neo4j:
      image: neo4j:community
      ports: [7474, 7687]
      volumes: ["./neo4j_data:/data"]
      # Alternative: FalkorDB for lighter footprint
      
    embedding_service:
      build: ./embedding-service
      model: "BAAI/bge-m3"
      gpu: optional  # CPU works, GPU preferred
      ports: [8080]
      
    whisper:
      build: ./whisper-service
      model: "large-v3"
      gpu: required  # For real-time performance
      ports: [8081]
      
    orchestrator:
      build: ./orchestrator
      depends_on: [qdrant, neo4j, embedding_service]
      ports: [8000]
      volumes: ["./best-practices:/app/best-practices"]
```

## 4. API Design

### 4.1 Voice Input Endpoint

```
WebSocket: wss://server/api/v1/voice

Client → Server:
{
  "type": "audio_chunk",
  "data": "<base64 audio>",
  "session_id": "uuid",
  "language_hint": "de"  // optional
}

Server → Client:
{
  "type": "transcription",
  "text": "What I'm seeing is...",
  "is_final": false,       // streaming partial results
  "session_id": "uuid"
}

{
  "type": "mirror_response",
  "decoded_thought": "You're describing a system where...",
  "context_used": ["trace-uuid-1", "practice-uuid-2"],
  "truth_anchors": ["Ephesians 4:25"],
  "session_id": "uuid"
}
```

### 4.2 Thought Storage Endpoint

```
POST /api/v1/thoughts

{
  "content": "Decoded thought content",
  "raw_input": "Original transcription",
  "session_id": "uuid",
  "speaker_id": "thomas",
  "angle": "systems-architecture",
  "confidence": 0.85,
  "parent_id": "previous-thought-uuid" // null if first in chain
}

Response:
{
  "thought_id": "uuid",
  "embedding_stored": true,
  "graph_updated": true,
  "convergence_detected": false,
  "similar_traces": [
    {"id": "uuid", "similarity": 0.87, "angle": "different-angle"}
  ]
}
```

### 4.3 Context Retrieval Endpoint

```
POST /api/v1/context

{
  "query": "Current thought or question",
  "session_id": "uuid",
  "max_traces": 10,
  "max_practices": 3,
  "include_truth_anchors": true
}

Response:
{
  "traces": [...],
  "convergence_zones": [...],
  "best_practices": [...],
  "truth_anchors": [...],
  "suggested_angles": ["angle not yet explored"]
}
```

### 4.4 Best Practice Generation Endpoint

```
POST /api/v1/best-practices/generate

{
  "convergence_zone_id": "uuid",
  "target_path": "layout/new-pattern.md",
  "auto_commit": true
}

Response:
{
  "file_path": "layout/new-pattern.md",
  "content": "# Pattern Name\n\n...",
  "committed": true,
  "commit_hash": "abc123"
}
```

## 5. Migration Path from Current to Target

### Step 1: Bridge Phase (Immediate)

```
Use claude.ai as interface (current)
  → Copy conversation outputs manually
  → Structure into markdown documents
  → Commit to best-practices repo
  → This is what we're doing RIGHT NOW in this conversation
```

### Step 2: Server Foundation

```
Set up on Thomas's server:
  → Docker Compose with Qdrant + Neo4j/FalkorDB
  → BGE-M3 embedding service
  → Basic REST API for thought storage and retrieval
  → Git integration for best-practices repo
  → Claude Code as the agent backbone
```

### Step 3: Voice Integration

```
Add voice pipeline:
  → Faster-Whisper for speech-to-text
  → WebSocket endpoint for streaming
  → Connect to Thought Decoder Agent
  → Real-time context injection from Vector DB
```

### Step 4: Full Loop

```
Close the loop:
  → Voice in → decode → mirror → refine → store → crystallize
  → All on Thomas's server
  → All agents reading from shared knowledge
  → Best practices evolving organically
```

### Step 5: Multi-Thinker (Future)

```
Open to other thinkers:
  → Authentication and access control
  → Privacy layers (private / shared / public thoughts)
  → Cross-thinker resonance discovery
  → The XPollination vision realized
```

## 6. Integration with Existing XPollination Projects

### ProfileAssistant

```
Reads from:
  - best-practices/layout/cv-design-dach.md
  - best-practices/cv-content/recruiter-screening.md
  - Vector DB: thought traces tagged "cv" or "profile"
  
Contributes:
  - New patterns discovered during CV generation
  - Recruiter feedback patterns
  - ATS optimization findings
```

### Social Media Agent

```
Reads from:
  - best-practices/social-media/linkedin/*
  - Vector DB: thought traces tagged "social-media"
  
Contributes:
  - Algorithm changes observed
  - Engagement pattern updates
  - Bilingual posting findings
```

### HomeAssistant

```
Reads from:
  - best-practices/knowledge-management/synaptic-folder-structure.md
  - Vector DB: thought traces tagged "automation"
  
Contributes:
  - Automation patterns
  - Integration findings
```
