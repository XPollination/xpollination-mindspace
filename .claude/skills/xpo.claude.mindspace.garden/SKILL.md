---
name: xpo.claude.mindspace.garden
description: Brain gardening — prune, consolidate, and curate shared knowledge
user-invocable: true
allowed-tools: Bash, Read
---

# Brain Gardener — Knowledge Maintenance Engine

Maintain brain quality by analyzing, consolidating, and curating thoughts. Three depths, three scopes, optional dry-run.

```
/xpo.claude.mindspace.garden [scope] [depth] [--space=private|shared] [--dry-run]
```

## Parameters

### Scope (what to garden)

| Value | Meaning |
|-------|---------|
| `recent` | Thoughts from the last 24h (default) |
| `task:<slug>` | Thoughts related to a specific task |
| `full` | Entire brain — comprehensive gardening |

### Depth (how thorough)

| Value | Operations |
|-------|-----------|
| `shallow` | Count, categorize, flag noise, report — read-only analysis |
| `micro` | + consolidation of duplicates + mark intermediates as archivable |
| `deep` | + domain summaries + duplicate merging + highway curation + superseding stale thoughts |

### Space (which collection to garden)

| Value | Target Collection | Default |
|-------|-------------------|---------|
| `--space=private` | Caller's private collection (e.g. thought_space_thomas) | Yes (default when --space omitted) |
| `--space=shared` | `thought_space_shared` — the shared brain accessible by all users | No |

When `--space=shared` is specified, all gardener operations (discover, consolidate, refine, categorize) target thought_space_shared instead of the caller's private collection. All API calls include `"space": "shared"` in the request body.

### Dry-run

When `--dry-run` is specified (or `dry_run=true`), the gardener reports all changes it **would** make without executing any mutations. No refine, consolidate, or supersede operations are performed. Use this to preview the gardening plan before committing.

## Integration Layers

### Layer 1: PM Status Gardening Phase

LIAISON calls the gardener with `scope=recent depth=shallow` during PM status checks. This provides a quick brain health snapshot: thought count, noise level, stale entries. No mutations — purely diagnostic.

### Layer 2: Manual Deep Gardening (this skill)

Thomas or any agent invokes directly for comprehensive maintenance. Typically `scope=full depth=deep` for full-cycle gardening.

### Layer 3: Task Completion Micro-Gardening

After task completion, the completing agent calls with `scope=task:<slug> depth=micro` to consolidate task-related thoughts. Merges scattered observations into coherent learnings, marks intermediate thoughts as archivable.

---

## Execution Steps

### Step 0.5: Pre-flight Backup (deep only)

If `depth=deep` (mutations will occur):

1. Run the Qdrant backup script:
   ```bash
   bash /home/developer/workspaces/github/PichlerThomas/xpollination-best-practices/scripts/qdrant-backup.sh
   ```

2. If the backup fails: **abort gardening immediately**. Do NOT proceed with mutations without a backup. Exit with error message.

3. If backup succeeds: log "Brain backup created at /volume1/backups/hetzner/brain/daily/<date>" and continue.

If `depth=shallow` or `depth=micro`: skip this step (no destructive operations).

### Step 1: Parse arguments

Default: `scope=recent depth=shallow space=private dry_run=false`

```bash
SCOPE="${1:-recent}"
DEPTH="${2:-shallow}"
SPACE="private"
DRY_RUN=false
# Check for flags in any position
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then DRY_RUN=true; fi
  if [ "$arg" = "--space=shared" ]; then SPACE="shared"; fi
  if [ "$arg" = "--space=private" ]; then SPACE="private"; fi
done
```

### Step 2: Set identity

Use agent-gardener identity:

```bash
AGENT_ID="agent-gardener"
AGENT_NAME="GARDENER"
SESSION_ID=$(cat /proc/sys/kernel/random/uuid)
BRAIN_URL="http://localhost:3200/api/v1/memory"
```

### Step 3: Health check

```bash
curl -s http://localhost:3200/api/v1/health
```

If unhealthy, abort with error message.

### Step 4: Discover thoughts (scope-dependent)

#### scope=recent

Query brain for recent activity across common domains:

```bash
# Query recent thoughts with full content (read_only prevents query pollution)
# When SPACE=shared, pass "space": "shared" to search thought_space_shared
SPACE_JSON=""
if [ "$SPACE" = "shared" ]; then SPACE_JSON=", \"space\": \"shared\""; fi

curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"Recent thoughts and contributions from the last 24 hours across all topics\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\",
    \"full_content\": true,
    \"read_only\": true
    $SPACE_JSON
  }"
```

#### scope=task:\<slug\>

Query for task-specific thoughts:

```bash
TASK_SLUG="${SCOPE#task:}"
curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"All thoughts related to task $TASK_SLUG — transition markers, learnings, decisions, design notes\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\",
    \"full_content\": true,
    \"read_only\": true
  }"
```

#### scope=full

Multiple domain queries to cover the full brain:

```bash
# Query across key domains
for DOMAIN in \
  "agent coordination role separation multi-agent patterns" \
  "brain knowledge management memory quality gardening" \
  "task workflow transitions PM status project management" \
  "infrastructure deployment server configuration" \
  "cover letter career positioning resume interview"; do

  curl -s -X POST "$BRAIN_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"prompt\": \"$DOMAIN\",
      \"agent_id\": \"$AGENT_ID\",
      \"agent_name\": \"$AGENT_NAME\",
      \"session_id\": \"$SESSION_ID\",
      \"full_content\": true,
      \"read_only\": true
    }"
done
```

### Step 5: Analyze (all depths)

For each discovered thought, assess:

1. **Count** total thoughts per domain/category
2. **Categorize** by topic: coordination, infrastructure, task markers, learnings, etc.
3. **Flag noise**: keyword echoes, too-short entries, near-duplicate pairs, stale transition markers
4. **Report** findings as a summary table

### Step 5.5: Retroactive Categorization (scope=full depth=deep only)

Batch categorize uncategorized thoughts. Only runs during full deep gardening passes.

1. Fetch uncategorized thoughts via the API:
   ```bash
   curl -s -H "Authorization: Bearer $BRAIN_API_KEY" "http://localhost:3200/api/v1/memory/thoughts/uncategorized?limit=50"
   ```

2. For each uncategorized thought, analyze its content and assign:
   - `thought_category`: one of state_snapshot, decision_record, operational_learning, task_outcome, correction, transition_marker, design_decision
   - `topic`: a short domain slug (e.g., "agent-coordination", "brain-quality", "infrastructure")

3. PATCH the metadata via the API (does not modify thought content):
   ```bash
   curl -s -X PATCH "http://localhost:3200/api/v1/memory/thought/<thought_id>/metadata" \
     -H "Content-Type: application/json" -H "Authorization: Bearer $BRAIN_API_KEY" \
     -d '{"thought_category": "<category>", "topic": "<topic>"}'
   ```

4. Repeat until no more uncategorized thoughts remain (paginate with offset).

If `dry_run=true`: list what categories would be assigned without executing PATCH calls.

### Step 6: Report (shallow stops here)

If `depth=shallow`:
- Output the analysis summary (counts, categories, flagged noise)
- List recommended actions (what micro/deep would do)
- Stop — no mutations

### Step 7: Consolidate (micro and deep)

If `depth=micro` or `depth=deep`:

For each cluster of related/duplicate thoughts:

If `dry_run=true`: list what **would** be consolidated, skip mutations.

If `dry_run=false`:

```bash
# Consolidate duplicates into one coherent thought
# Include "space": "shared" when gardening the shared collection
curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"CONSOLIDATED: <merged insight from the cluster>\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\",
    \"consolidates\": [\"<id1>\", \"<id2>\"]
    $SPACE_JSON
  }"
```

Mark intermediate/transitional thoughts (e.g., task start markers after task completes) as archivable by refining with an archive note:

```bash
curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"ARCHIVED: <original content> — marked archivable by gardener, intermediate thought superseded by final learning\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\",
    \"refines\": \"<thought_id>\"
    $SPACE_JSON
  }"
```

### Step 8: Deep operations (deep only)

If `depth=deep`:

If `dry_run=true`: list what **would** be created/merged/superseded, skip mutations.

If `dry_run=false`:

**Domain summaries**: For each major domain, create a summary thought that consolidates the key insights:

```bash
curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"DOMAIN SUMMARY (<domain>): <comprehensive summary of all key insights in this domain>\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\"
  }"
```

**Duplicate merging**: Identify thoughts with >85% semantic overlap and merge via consolidate.

**Highway curation**: Review current highways. If highways are dominated by one domain (e.g., agent coordination appearing on every query), refine over-represented entries to be more specific or consolidate them.

**Superseding stale thoughts**: Refine outdated thoughts with current information, marking the old version as superseded.

### Step 9: Final report

Output a summary of all actions taken (or that would be taken if dry-run):

```
=== GARDENER REPORT ===
Scope: <scope>
Depth: <depth>
Dry-run: <true|false>

Thoughts analyzed: <N>
Categories: <list>
Noise flagged: <N>
Consolidations: <N performed or would-perform>
Archives: <N>
Domain summaries: <N> (deep only)
Duplicates merged: <N> (deep only)
Highways curated: <N> (deep only)
Superseded: <N> (deep only)
=== END REPORT ===
```

Record the gardening timestamp:

```bash
curl -s -X POST "$BRAIN_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"prompt\": \"GARDENING COMPLETE: scope=$SCOPE depth=$DEPTH — <N> thoughts analyzed, <N> consolidated, <N> archived. Brain health: <assessment>\",
    \"agent_id\": \"$AGENT_ID\",
    \"agent_name\": \"$AGENT_NAME\",
    \"session_id\": \"$SESSION_ID\"
  }"
```

---

## Examples

### Quick brain health check (Layer 1)
```
/xpo.claude.mindspace.garden recent shallow
```

### Preview full gardening (dry-run)
```
/xpo.claude.mindspace.garden full deep --dry-run
```

### Post-task cleanup (Layer 3)
```
/xpo.claude.mindspace.garden task:gardener-highway-redesign micro
```

### Full deep gardening
```
/xpo.claude.mindspace.garden full deep
```

### Garden the shared brain
```
/xpo.claude.mindspace.garden recent shallow --space=shared
```

### Deep garden shared space (preview first)
```
/xpo.claude.mindspace.garden full deep --space=shared --dry-run
```

---

## API Details

- **Endpoint:** `POST http://localhost:3200/api/v1/memory`
- **Full content:** Pass `"full_content": true` to read complete thought bodies
- **Refine:** Pass `"refines": "<thought_id>"` to create refinement (supersedes original)
- **Consolidate:** Pass `"consolidates": ["<id1>", "<id2>"]` to merge thoughts
- **Space:** Pass `"space": "shared"` to target thought_space_shared (default is private collection)
- **Drill down:** `GET http://localhost:3200/api/v1/memory/thought/<id>` for individual thought
