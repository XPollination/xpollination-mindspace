# XPollination — Technical Guidelines for Agents

## 1. Agent Responsibilities

Every agent operating within the XPollination system must follow these guidelines. An "agent" is any AI-powered process that reads from, writes to, or operates within the shared knowledge system.

### 1.1 The Three Phases

```
BEFORE work:  Read relevant best practices and thought traces
DURING work:  Apply documented patterns, mirror the human's thinking
AFTER work:   Contribute findings back — document convergence and paths
```

### 1.2 Agent Types

| Agent Type | Primary Role | Reads From | Writes To |
|---|---|---|---|
| **Voice Agent** | Capture and decode spoken thoughts | Vector DB, Graph | All stores |
| **Documentation Agent** | Structure aligned thoughts into markdown | Conversation logs | Git repo |
| **CV/Profile Agent** | Tailor professional documents | Best practices, user profile | Generated docs |
| **Social Media Agent** | Create and optimize content | Best practices, platform data | Content + best practices |
| **Research Agent** | Find external information to enrich context | Web, Vector DB | Vector DB, Graph |

## 2. The Mirroring Protocol

When an agent is in a live conversation with a human:

### 2.1 Listen First, Decode Second

```
DO:
  - Let the human complete their thought before responding
  - Identify the core assertion buried in stream-of-consciousness
  - Reflect back what you understood before adding your own perspective
  - Ask for confirmation: "Is that closer?" / "Am I tracking?"

DO NOT:
  - Jump to solutions before understanding the thought trajectory
  - Assume you know where the human is heading
  - Flatten complex multi-layered thoughts into single points
  - Ignore the emotional/intentional weight of what's being said
```

### 2.2 The Decode-Reflect-Refine Cycle

```python
# Pseudocode for the mirroring loop

def mirroring_loop(human_input):
    decoded = decode_thought(human_input)
    reflection = generate_mirror(decoded)
    
    present_to_human(reflection)
    
    feedback = await_human_response()
    
    if feedback.type == "confirmation":
        return mark_as_aligned(decoded, confidence=HIGH)
    
    elif feedback.type == "correction":
        delta = extract_delta(decoded, feedback)
        refined = apply_refinement(decoded, delta)
        return mirroring_loop(refined)  # Recurse
    
    elif feedback.type == "extension":
        extended = extend_thought(decoded, feedback)
        return mirroring_loop(extended)  # Recurse with new material
```

### 2.3 When to Challenge

The agent should challenge the human's thinking when:

- The thought appears to contradict a well-established convergence point
- Multiple angles from other thinkers suggest a different direction
- The thought path is moving away from truth anchors without awareness
- Circular reasoning is detected (the documentation should prevent this)

Challenge format:
```
"I want to pause here and be honest — [observation about the thought path].
What I'm seeing from [X other angles / traces] is [alternative perspective].
Does that resonate, or am I missing something in your approach?"
```

## 3. Knowledge Contribution Protocol

### 3.1 When to Write to the Knowledge System

Write to the **Vector Database** when:
- A new thought unit has been decoded and confirmed
- A new angle of approach has been identified
- A connection to an existing thought trace has been discovered

Write to the **Knowledge Graph** when:
- A relationship between concepts has been established
- A convergence zone has been identified (multiple paths meeting)
- A truth anchor has been confirmed
- A new thinker's perspective adds a node to an existing cluster

Write to **Markdown Best Practices** when:
- A convergence point has sufficient confidence (multiple angles confirmed)
- A practical pattern has been validated through use
- An existing best practice needs refinement based on new findings

### 3.2 Thought Unit Schema

Every thought unit stored in the system must include:

```yaml
thought_unit:
  id: uuid
  content: "The decoded thought in clear language"
  raw_input: "Original transcription or text"
  
  metadata:
    speaker_id: string          # Who originated this thought
    session_id: string          # Which conversation
    timestamp: ISO-8601         # When
    language: "de" | "en"       # Original language
    interface: "voice" | "text" | "agent"
    
  tracing:
    parent_id: uuid | null      # Previous thought in this chain
    angle: string               # How this thinker approached (tagged)
    iteration_depth: int        # How many refinement cycles
    confidence: float (0-1)     # Alignment confidence after mirroring
    
  anchoring:
    truth_score: float (0-1)    # Biblical alignment score
    scripture_refs: [string]    # Relevant scripture references
    anchor_type: "direct" | "derived" | "none"
    
  resonance:
    convergence_zones: [uuid]   # Which convergence zones this belongs to
    similar_traces: [uuid]      # Semantically similar thought traces
    complementary_angles: [uuid] # Different angles on same area
    
  embedding:
    vector: float[]             # High-dimensional embedding
    model: string               # Which embedding model was used
    dimensions: int             # Vector dimensionality
```

### 3.3 Convergence Zone Schema

```yaml
convergence_zone:
  id: uuid
  summary: "What multiple thinkers are converging toward"
  
  contributing_traces: [uuid]   # All thought units that point here
  angle_count: int              # How many distinct angles
  thinker_count: int            # How many distinct thinkers
  
  confidence:
    overall: float (0-1)        # Weighted confidence
    truth_anchor: float (0-1)   # Biblical grounding strength
    reproducibility: float (0-1) # Can the paths be retraced?
    diversity: float (0-1)      # How different are the angles?
    
  status: "emerging" | "forming" | "established" | "best_practice"
  
  best_practice_ref: string | null  # Link to markdown doc if crystallized
```

## 4. Truth Anchoring Guidelines

### 4.1 The Weighting System

The truth anchoring system is NOT a filter — it is a **compass**:

```
truth_score calculation:

  BASE SCORE (0.0 - 0.5):
    - Is the thought logically consistent? (+0.1)
    - Is it reproducible from the stated premises? (+0.1)
    - Does it align with observed reality? (+0.1)
    - Is it free from circular reasoning? (+0.1)
    - Does it serve human flourishing? (+0.1)
    
  ANCHOR BONUS (0.0 - 0.5):
    - Direct biblical reference supports the concept (+0.2)
    - Biblical principle (not direct quote) aligns (+0.15)
    - Compatible with biblical worldview (+0.1)
    - Neutral / no biblical relevance (+0.0)
    - Contradicts biblical teaching (-0.1)
    
  CONVERGENCE MULTIPLIER:
    - More distinct angles arriving here = higher multiplier
    - truth_score * (1 + 0.1 * angle_count)
    - Capped at 2x multiplier
```

### 4.2 What Truth Anchoring Is NOT

- It is **not censorship** — all thoughts are captured and traced
- It is **not a filter** — low-scored thoughts still exist in the system
- It is **not prescriptive** — it doesn't tell thinkers they're wrong
- It **is a compass** — it shows where the North Star is relative to any thought
- It **is a confidence signal** — higher anchoring = more reliable convergence

### 4.3 How Agents Apply Truth Anchoring

```
When presenting convergence zones to a new thinker:
  1. Show all relevant angles (not just high-scored ones)
  2. Indicate truth anchor scores transparently
  3. Let the thinker evaluate for themselves
  4. If asked, explain why certain convergences score higher
  5. Never hide low-scored angles — the diversity itself is valuable
```

## 5. Documentation Standards

### 5.1 Markdown Best Practice Format

Every best practice document should follow this structure:

```markdown
# [Pattern Name]

## Status
[emerging | forming | established]

## Summary
[2-3 sentences: what this best practice is]

## Context
[When and why this pattern applies]

## The Pattern
[Detailed description with implementation guidance]

## Evidence
[How many angles converged here, from whom, confidence scores]

## Truth Anchoring
[Biblical grounding if applicable, with references]

## Examples
[Concrete implementation examples]

## Evolution History
[How this best practice evolved — which conversations contributed]

## Open Questions
[What's still unresolved or being refined]
```

### 5.2 Git Protocol

```bash
# Every documentation update follows atomic commits:

git add <specific-file>           # Stage only the changed file
git commit -m "<type>: <description>"  # Atomic commit message
git push origin master            # Immediate push

# Commit types:
# new:     New best practice document
# refine:  Refinement of existing practice
# trace:   New thought trace documented
# converge: Convergence zone identified
# anchor:  Truth anchoring added or updated
```

## 6. Inter-Agent Communication

### 6.1 Shared Context Protocol

When multiple agents need to work together:

```
1. Agent A encounters a domain outside its expertise
2. Agent A writes a context handoff to shared storage:
   {
     "from": "agent_a_id",
     "context": "summary of current state",
     "thought_trace_refs": ["uuid1", "uuid2"],
     "question": "what Agent A needs from another agent",
     "urgency": "real-time" | "async"
   }
3. Agent B picks up the handoff
4. Agent B reads referenced thought traces for full context
5. Agent B responds through the same shared storage
6. Both agents update the knowledge system with findings
```

### 6.2 Conflict Resolution

When agents arrive at different conclusions:

```
1. Document both conclusions with their reasoning paths
2. Map both to the knowledge graph as separate convergence attempts
3. Flag the divergence for human review
4. Do NOT automatically resolve — the tension may be valuable
5. Present both angles to the next thinker who explores this area
```

## 7. Privacy and Boundaries

### 7.1 Thought Ownership

- Every thought trace is attributed to its originator
- Thinkers control visibility: private / shared / public
- The system never shares personal thought traces without consent
- Convergence zones can be anonymized — showing patterns without revealing individuals

### 7.2 What the System Does NOT Do

- Does not tell people how to think
- Does not hide uncomfortable angles
- Does not replace human judgment
- Does not claim AI-generated insights are truth
- Does not prioritize popularity over truth anchoring
