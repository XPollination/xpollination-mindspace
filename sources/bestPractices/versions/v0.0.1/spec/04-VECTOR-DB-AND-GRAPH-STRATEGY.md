# XPollination — Vector Database & Knowledge Graph Strategy

## 1. Why Hybrid: Vector + Graph

The XPollination system requires BOTH semantic search AND relational reasoning. Neither alone is sufficient.

### What Each Provides

```
VECTOR DATABASE                     KNOWLEDGE GRAPH
─────────────────                   ─────────────────
"What feels similar?"               "How are things connected?"
Semantic fuzzy matching             Explicit typed relationships
Fast retrieval at scale             Multi-hop reasoning
Handles unstructured thought        Structured concept mapping
Language-agnostic (embeddings)      Relationship-rich traversal
Good for: finding resonance         Good for: tracing paths
```

### The Hybrid Query Pattern

A typical query flows through both systems:

```
User thinks: "How should I structure my CV for the DACH market?"

Step 1 — Vector Search:
  → Find thought traces semantically close to "CV + DACH + structure"
  → Returns: 12 related thought traces from 4 different thinkers
  
Step 2 — Graph Traversal:
  → From those 12 traces, traverse relationships:
    → DERIVES_FROM → original research sessions
    → CONVERGES_WITH → established best practices
    → ANCHORED_IN → foundational principles
  → Returns: 3 convergence zones, 2 best practice docs, 1 truth anchor
  
Step 3 — Compose Response:
  → Present the best practice (cv-design-dach.md)
  → Show the angles that contributed to it
  → Indicate which angles are strongly anchored
  → Note any open questions or emerging counter-patterns
```

## 2. Vector Database Design

### 2.1 Collection Structure

```
Collections (Qdrant terminology / equivalent in other VDBs):

┌─────────────────────────────────────────────────┐
│ thought_traces                                   │
│   Purpose: All individual thought units          │
│   Vectors: 1024-dim (BGE-M3 dense)             │
│   Payload: speaker, session, timestamp, angle,  │
│            confidence, truth_score, language     │
│   Index: HNSW with cosine similarity            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ convergence_zones                                │
│   Purpose: Clustered areas where paths meet      │
│   Vectors: centroid of contributing traces       │
│   Payload: contributing_count, angle_diversity,  │
│            truth_anchor_score, status            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ best_practices                                   │
│   Purpose: Crystallized knowledge (from .md)     │
│   Vectors: embedded from document content        │
│   Payload: file_path, topic, last_updated,      │
│            convergence_zone_refs                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ scripture_anchors                                │
│   Purpose: Biblical references for anchoring     │
│   Vectors: embedded scripture passages           │
│   Payload: book, chapter, verse, themes,        │
│            connected_convergence_zones           │
└─────────────────────────────────────────────────┘
```

### 2.2 Embedding Strategy

```yaml
embedding_config:
  model: "BAAI/bge-m3"
  
  why:
    - Multilingual: native German + English support
    - Long context: up to 8192 tokens per input
    - Multi-retrieval: dense + sparse + multi-vector simultaneously
    - Open-source: self-hostable, AGPL-compatible
    - Matryoshka: can reduce dimensions for speed vs. accuracy trade-off
  
  dimensions: 1024  # Default dense embedding size
  
  preprocessing:
    - Thought units: embed the decoded interpretation (not raw transcript)
    - Include angle metadata as prefix: "[angle: personal-experience] ..."
    - For bilingual content: embed in original language
    - Cross-lingual retrieval handled natively by BGE-M3
    
  indexing:
    algorithm: HNSW
    distance_metric: cosine
    ef_construct: 256    # Higher for better recall during build
    m: 16                # Connections per node
```

### 2.3 Search Patterns

```python
# Pattern 1: Find resonant thought traces
def find_resonance(new_thought: str, top_k: int = 20):
    embedding = embed(new_thought)
    results = vector_db.search(
        collection="thought_traces",
        vector=embedding,
        limit=top_k,
        filter={
            "confidence": {"$gte": 0.5}  # Only aligned traces
        }
    )
    return results

# Pattern 2: Find multi-angle convergence
def find_convergence(thought_embedding, min_angles: int = 3):
    nearby_traces = vector_db.search(
        collection="thought_traces",
        vector=thought_embedding,
        limit=50
    )
    
    # Group by angle
    angles = group_by(nearby_traces, key="angle")
    
    if len(angles) >= min_angles:
        return {
            "convergence_detected": True,
            "angles": angles,
            "centroid": calculate_centroid([t.vector for t in nearby_traces])
        }
    return {"convergence_detected": False}

# Pattern 3: Real-time context injection
def get_live_context(conversation_so_far: list[str]):
    """Called every time the human speaks during a session."""
    latest = conversation_so_far[-1]
    embedding = embed(latest)
    
    # Get thought traces
    traces = find_resonance(latest, top_k=10)
    
    # Get convergence zones
    zones = vector_db.search(
        collection="convergence_zones",
        vector=embedding,
        limit=5
    )
    
    # Get relevant best practices
    practices = vector_db.search(
        collection="best_practices",
        vector=embedding,
        limit=3
    )
    
    # Get truth anchors
    anchors = vector_db.search(
        collection="scripture_anchors",
        vector=embedding,
        limit=3,
        filter={"truth_score": {"$gte": 0.7}}
    )
    
    return {
        "related_traces": traces,
        "convergence_zones": zones,
        "best_practices": practices,
        "truth_anchors": anchors
    }
```

## 3. Knowledge Graph Design

### 3.1 Node Types

```
(:Thinker)            — A person who contributes thoughts
(:ThoughtUnit)        — A single decoded thought
(:ConversationSession) — A complete dialogue session
(:ConceptCluster)     — A group of related concepts
(:ConvergenceZone)    — Where multiple paths meet
(:BestPractice)       — Crystallized knowledge document
(:ScriptureAnchor)    — Biblical reference point
(:Angle)              — A distinct approach direction
(:Topic)              — A domain area (layout, cv, social-media, etc.)
```

### 3.2 Relationship Types

```
(:Thinker)-[:CONTRIBUTED]->(:ThoughtUnit)
(:ThoughtUnit)-[:PART_OF]->(:ConversationSession)
(:ThoughtUnit)-[:NEXT]->(:ThoughtUnit)              # Sequence in conversation
(:ThoughtUnit)-[:REFINED_BY]->(:ThoughtUnit)         # Refinement chain
(:ThoughtUnit)-[:APPROACHES_FROM]->(:Angle)          # Angle of approach
(:ThoughtUnit)-[:BELONGS_TO]->(:ConceptCluster)
(:ThoughtUnit)-[:CONVERGES_AT]->(:ConvergenceZone)

(:ConvergenceZone)-[:CRYSTALLIZED_AS]->(:BestPractice)
(:ConvergenceZone)-[:ANCHORED_IN]->(:ScriptureAnchor)
(:ConvergenceZone)-[:WITHIN_TOPIC]->(:Topic)

(:BestPractice)-[:EVOLVED_FROM]->(:BestPractice)     # Version chain
(:BestPractice)-[:REFERENCES]->(:ScriptureAnchor)

(:ConceptCluster)-[:RELATES_TO]->(:ConceptCluster)
(:ConceptCluster)-[:PART_OF_TOPIC]->(:Topic)
```

### 3.3 Example Graph Queries (Cypher)

```cypher
-- Find all angles that contributed to a convergence zone
MATCH (t:Thinker)-[:CONTRIBUTED]->(tu:ThoughtUnit)
      -[:CONVERGES_AT]->(cz:ConvergenceZone {id: $zone_id})
MATCH (tu)-[:APPROACHES_FROM]->(a:Angle)
RETURN t.name, a.description, tu.content, tu.confidence
ORDER BY tu.confidence DESC

-- Trace the evolution of a best practice
MATCH path = (bp1:BestPractice)-[:EVOLVED_FROM*]->(origin:BestPractice)
WHERE bp1.id = $practice_id
RETURN path

-- Find convergence zones with strong truth anchoring
MATCH (cz:ConvergenceZone)-[:ANCHORED_IN]->(sa:ScriptureAnchor)
WHERE cz.truth_score > 0.7
RETURN cz, sa, cz.angle_count
ORDER BY cz.angle_count DESC

-- Find thinkers who are exploring similar territory
MATCH (t1:Thinker)-[:CONTRIBUTED]->(tu1:ThoughtUnit)
      -[:BELONGS_TO]->(cc:ConceptCluster)
      <-[:BELONGS_TO]-(tu2:ThoughtUnit)
      <-[:CONTRIBUTED]-(t2:Thinker)
WHERE t1 <> t2
RETURN t1, t2, cc, count(cc) AS shared_concepts
ORDER BY shared_concepts DESC
```

## 4. Synchronization Between Vector DB and Knowledge Graph

The two systems must stay in sync:

```
On new thought unit:
  1. Generate embedding → store in Vector DB (thought_traces)
  2. Create node → store in Knowledge Graph (:ThoughtUnit)
  3. Link both records via shared UUID
  
On convergence detected:
  1. Calculate centroid → store in Vector DB (convergence_zones)
  2. Create node → store in Knowledge Graph (:ConvergenceZone)
  3. Create CONVERGES_AT edges for all contributing thought units
  4. Check truth anchoring → create ANCHORED_IN edges if applicable
  
On best practice crystallized:
  1. Generate markdown → commit to git repo
  2. Embed document → store in Vector DB (best_practices)
  3. Create node → store in Knowledge Graph (:BestPractice)
  4. Create CRYSTALLIZED_AS edge from convergence zone
```

## 5. Scalability Considerations

### Phase 1: Single User (Current — Thomas)
- Qdrant single-node, in-memory mode
- Neo4j Community Edition or FalkorDB
- BGE-M3 running locally or on server
- Git repo for markdown (existing best-practices repo)

### Phase 2: Small Community (<100 thinkers)
- Qdrant with persistent storage
- Neo4j with proper disk-backed storage
- Shared embedding service
- Access control layer for thought privacy

### Phase 3: Open Platform (future vision)
- Qdrant cluster for horizontal scaling
- Neo4j Enterprise or distributed graph
- Edge caching for real-time context injection
- Federated model — communities can run their own instances
- Cross-instance resonance discovery (the XPollination vision)

## 6. Data Retention and Evolution

### Nothing Is Deleted

Thought traces are never deleted — they represent the journey. Even superseded best practices remain in the graph as historical nodes, connected via EVOLVED_FROM edges.

### Organic Pruning

Over time, thought traces that:
- Were never confirmed (low confidence)
- Led to dead ends (no convergence)
- Were explicitly retracted by the thinker

...get their **visibility** reduced but not their **existence**. They remain in the graph for reproducibility.
