# PDSA: Rework Version Enforcement Gate — v0.0.1

## PLAN

### Problem
When a task goes through rework, agents can:
1. Overwrite v0.0.1 in place (destroying the immutable learning artifact)
2. Skip quoting Thomas's feedback that triggered the rework
3. Set `pdsa_ref` to the old version instead of the new one

The versioning philosophy (Thomas directive 2026-02-25): versions are immutable snapshots. The drift between versions IS the learning artifact.

### Design

Add a **rework version enforcement gate** in `interface-cli.js` that fires on `active->approval` transitions when the task has been through rework (i.e., `dna.rework_count >= 1` or `dna.liaison_rework_reason` exists).

#### Gate Location
In `src/db/interface-cli.js`, between the existing DNA validation (line ~474) and the LIAISON approval mode gate (line ~480). This is where all pre-transition gates live.

#### Gate Logic (pseudocode)

```javascript
// REWORK VERSION GATE
// Fires on: active->approval (pdsa submitting reworked design)
// Condition: task has been through rework (liaison_rework_reason exists in DNA)
if (transitionKey === 'active->approval' && dna.liaison_rework_reason) {

  // 1. Determine expected version from pdsa_ref
  // pdsa_ref format: https://github.com/.../tracks/.../v0.0.N/pdsa/DESIGN.md
  const versionMatch = dna.pdsa_ref?.match(/v0\.0\.(\d+)/);
  if (!versionMatch) {
    error('pdsa_ref must contain a version path (v0.0.N)');
  }
  const currentVersion = parseInt(versionMatch[1]);

  // 2. Version must be > 1 (rework = new version, never v0.0.1)
  if (currentVersion <= 1) {
    error('Rework requires a new version (v0.0.2+). Never update v0.0.1 in place. Create a new version directory.');
  }

  // 3. Check that dna.rework_context contains human feedback
  // The PDSA agent must set this field with verbatim quotes
  if (!dna.rework_context) {
    error('Rework submissions require dna.rework_context with verbatim human feedback from liaison_rework_reason.');
  }

  // 4. Verify rework_context actually contains the human feedback
  // Simple: check that some substring of liaison_rework_reason appears in rework_context
  const feedback = dna.liaison_rework_reason;
  if (typeof feedback === 'string' && feedback.length > 20) {
    // Check first 50 chars of feedback appear somewhere in rework_context
    const snippet = feedback.substring(0, 50);
    if (!dna.rework_context.includes(snippet)) {
      error(`rework_context must quote the human feedback verbatim. Expected to find: "${snippet}..."`);
    }
  }
}
```

#### DNA Fields

| Field | Set By | When | Purpose |
|-------|--------|------|---------|
| `liaison_rework_reason` | LIAISON | `approval->rework` or `review->rework:liaison` | Thomas's verbatim feedback |
| `rework_context` | PDSA | Before `active->approval` (rework submission) | Contains verbatim quotes + agent response |
| `pdsa_ref` | PDSA | Before `active->approval` | Must point to v0.0.N+1 GitHub URL |

#### Pre-requisite: LIAISON Must Set `liaison_rework_reason`

When LIAISON sends a task to rework (`approval->rework`), the `clearsDna` already clears `memory_query_session` and `memory_contribution_id`. The LIAISON agent must set `liaison_rework_reason` in DNA before executing the rework transition. This is a protocol requirement, not an engine gate (LIAISON writes DNA, then transitions).

If `liaison_rework_reason` is empty when the rework gate fires, the gate simply doesn't enforce quote verification (gate is advisory for the rework_context content, mandatory for version increment).

#### Changes Required

1. **`src/db/interface-cli.js`** (~20 lines):
   - Add rework version gate block after DNA validation, before LIAISON approval mode gate
   - Gate fires on `active->approval` when `liaison_rework_reason` present
   - Checks: version in pdsa_ref > 1, `rework_context` exists, quotes present

2. **`src/db/workflow-engine.js`** (0 lines):
   - No changes. The workflow engine stays pure (transition rules, actors, DNA field requirements).
   - The rework gate is filesystem/content-aware logic that belongs in the CLI layer.

3. **Agent protocol update** (documentation only):
   - PDSA agent monitor skill: add rework handling instructions
   - LIAISON agent: must set `liaison_rework_reason` before rework transition

#### What This Does NOT Do

- Does NOT check filesystem immutability of old versions (would require git diff, too complex for v0.0.1)
- Does NOT enforce `abstract_ref` pointing to new version (that's a completion gate, not a rework gate)
- Does NOT modify the rework->active transition (that's the claiming step, not the submission step)

#### Risks

- **Low risk**: Gate only adds validation, doesn't change data flow
- **False positive risk**: If `liaison_rework_reason` contains very short feedback (<20 chars), quote verification is skipped (intentional — short feedback like "rejected" has no meaningful quote)

## DO

Implementation by DEV agent. Changes:
1. Add ~20 lines to `interface-cli.js` transition handler
2. Update agent documentation

## STUDY

After implementation:
- Verify gate fires on rework submissions
- Verify gate passes when version is incremented and quotes are present
- Verify gate rejects when version is not incremented
- Verify gate rejects when rework_context is missing

## ACT

If gate works: standardize for all projects. If too strict: relax quote matching to presence-only (no substring check).
