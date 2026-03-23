---
name: xpo.claude.mindspace.brain
description: Query and contribute to the shared agent knowledge brain
user-invocable: true
allowed-tools: Bash, Read
---

# Agent Brain — Shared Knowledge Interface

Interact with the XPollination thought tracing system. Every agent can **query** for knowledge and **contribute** insights.

```
/xpo.claude.mindspace.brain <action> [args]
```

## Actions

### Query: Ask the brain a question

```
/xpo.claude.mindspace.brain query "your question or search terms"
```

### Contribute: Share an insight or learning

```
/xpo.claude.mindspace.brain contribute "your insight (must be >50 chars, declarative)"
```

### Contribute with context: Share with task context

```
/xpo.claude.mindspace.brain contribute "your insight" --context "what you're working on"
```

---

## Implementation

### Determine agent identity

Identify yourself from your role. Map to these values:

| Role | agent_id | agent_name |
|------|----------|------------|
| LIAISON | `agent-liaison` | `LIAISON` |
| PDSA | `agent-pdsa` | `PDSA` |
| DEV | `agent-dev` | `DEV` |
| QA | `agent-qa` | `QA` |

### Session tracking

Generate a session ID on first call and **reuse it** for all subsequent calls in this session. This enables implicit feedback (Section 3.10).

```bash
# Generate once per session, store in variable
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
```

### Execute: Query

```bash
RESPONSE=$(curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{
    \"prompt\": \"YOUR_QUESTION\",
    \"agent_id\": \"YOUR_AGENT_ID\",
    \"agent_name\": \"YOUR_AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\"
  }")
echo "$RESPONSE" | python3 -m json.tool
```

### Execute: Contribute

```bash
RESPONSE=$(curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{
    \"prompt\": \"YOUR_INSIGHT\",
    \"agent_id\": \"YOUR_AGENT_ID\",
    \"agent_name\": \"YOUR_AGENT_NAME\",
    \"context\": \"OPTIONAL_CONTEXT\",
    \"session_id\": \"$SESSION_ID\"
  }")
echo "$RESPONSE" | python3 -m json.tool
```

### Parse the response

The API returns `{result, trace}`:

**result** (for you to use):
- `response` — formatted text with top matches
- `sources` — array of `{thought_id, contributor, score, content_preview}`
- `highways_nearby` — most-trafficked knowledge paths
- `disambiguation` — if ambiguous, shows topic clusters to refine
- `guidance` — onboarding message for first-time agents

**trace** (for monitoring/logging):
- `operations` — what happened: contribute, retrieve, reinforce, onboard, disambiguate
- `thoughts_contributed` — 0 or 1
- `thoughts_retrieved` — count of results
- `contribution_threshold_met` — whether your input was stored
- `session_id` — your session tracking ID

### Present results to yourself

After parsing:
1. If `result.sources` has entries: use them as context for your current work
2. If `result.highways_nearby` has entries: these are the most important knowledge paths
3. If `result.disambiguation` is not null: refine your query using the suggested clusters
4. If `trace.contribution_threshold_met` is true: your insight was stored in the brain

---

## When to use the brain

### Always query when:
- Starting a new task (check if similar work was done before)
- Encountering a problem (check if others solved it)
- Making a design decision (check for established patterns)

### Always contribute when:
- You discover something non-obvious (>50 chars, declarative)
- You solve a problem that others might face
- You complete a task and have a key learning
- You find a pattern that should be reused

### Always refine when:
- You discover that an existing thought is outdated or incorrect
- You have a more precise version of a previous insight

### Always consolidate when:
- Multiple similar thoughts cover the same concept from different angles
- You can synthesize scattered knowledge into one clear statement

### Do NOT contribute:
- Questions (they won't be stored — threshold rejects interrogatives)
- Short phrases (<50 chars won't pass threshold)
- Follow-up references ("based on what you said..." won't pass threshold)

---

## Additional Actions

### Refine: Update an existing thought

```
/xpo.claude.mindspace.brain refine <thought_id> "updated insight"
```

Replaces a previous thought with an improved version. The old thought is marked as superseded. Retrieval will prefer the refined version.

### Consolidate: Merge multiple thoughts

```
/xpo.claude.mindspace.brain consolidate "<id1>,<id2>,..." "merged insight"
```

Merges multiple scattered thoughts into one coherent insight. All source thoughts are marked as superseded.

### History: View thought lineage

```
/xpo.claude.mindspace.brain history <thought_id>
```

Shows the full chain of refinements and consolidations for a thought.

---

## Implementation: Refine

```bash
RESPONSE=$(curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{
    \"prompt\": \"YOUR_UPDATED_INSIGHT\",
    \"agent_id\": \"YOUR_AGENT_ID\",
    \"agent_name\": \"YOUR_AGENT_NAME\",
    \"refines\": \"THOUGHT_ID_TO_REFINE\",
    \"session_id\": \"$SESSION_ID\"
  }")
echo "$RESPONSE" | python3 -m json.tool
```

The contribution threshold is **bypassed** for refinements — the thought is always stored.

## Implementation: Consolidate

```bash
RESPONSE=$(curl -s -X POST http://localhost:3200/api/v1/memory \
  -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
  -d "{
    \"prompt\": \"YOUR_MERGED_INSIGHT\",
    \"agent_id\": \"YOUR_AGENT_ID\",
    \"agent_name\": \"YOUR_AGENT_NAME\",
    \"consolidates\": [\"ID1\", \"ID2\"],
    \"session_id\": \"$SESSION_ID\"
  }")
echo "$RESPONSE" | python3 -m json.tool
```

Requires at least 2 thought IDs. Cannot be combined with `refines` in the same request.

## Implementation: History

Query the lineage of a thought by first retrieving it, then checking `refined_by` and `superseded` fields in the sources, or using the lineage_summary from trace when contributing a refinement.

---

## Refinement Suggestions

When you contribute a thought that is very similar (>85% similarity) to an existing one, the response will include a `guidance` note suggesting you use `/xpo.claude.mindspace.brain refine` instead. The contribution still goes through — it's a suggestion, not a block.

---

## API Details

- **Endpoint:** `POST http://localhost:3200/api/v1/memory`
- **Content-Type:** `application/json`
- **Max prompt:** 10,000 characters
- **Max context:** 2,000 characters
- **Contribution threshold:** >50 chars AND declarative AND not a follow-up (bypassed for refine/consolidate)

---

## Backward Compatibility

This skill was renamed from `brain` to `xpo.claude.mindspace.brain`. On install, a symlink is created:
```bash
ln -sf xpo.claude.mindspace.brain ~/.claude/skills/brain
```
Both `/brain` and `/xpo.claude.mindspace.brain` work.
