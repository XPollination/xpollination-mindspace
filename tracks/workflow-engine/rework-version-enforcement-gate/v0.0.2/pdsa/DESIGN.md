# PDSA: Rework Version Enforcement Gate — v0.0.2

## REWORK CONTEXT

> **Thomas observation (STUDY phase of v0.0.1):**
> The v0.0.1 gate only fires when `liaison_rework_reason` exists, covering LIAISON-initiated rework. But QA-initiated rework (`review→rework` by QA, sets `rework_reason` not `liaison_rework_reason`) bypasses the gate entirely. Also, first submissions have no versioning enforcement at all.

v0.0.1 was the experiment. This v0.0.2 is the standardization (ACT phase).

## PLAN

### Problem
The v0.0.1 gate (interface-cli.js:480-506) has three gaps:

1. **QA rework bypass**: QA sets `rework_reason` (not `liaison_rework_reason`), so the gate condition `dna.liaison_rework_reason` is false. Agent can overwrite v0.0.1 on QA-initiated rework.
2. **Dev submission gap**: The gate only fires on `active→approval` but dev submits via `active→review`. Dev rework submissions (after QA sends back to rework) bypass the gate.
3. **No first-submission enforcement**: First `active→approval` with no rework history has no versioning check. `pdsa_ref` could be missing the v0.0.N pattern entirely.

### Design

Replace the single-condition gate (lines 480-506) with a broader version enforcement block.

#### Gate Logic (replaces existing lines 480-506)

```javascript
// VERSION ENFORCEMENT GATE
// Fires on: active→approval OR active→review (any submission with pdsa_ref)
const isSubmission = (fromStatus === 'active' && (newStatus === 'approval' || newStatus === 'review'));

if (isSubmission && dna.pdsa_ref) {
  // Check pdsa_ref contains version pattern
  const versionMatch = (dna.pdsa_ref || '').match(/v0\.0\.(\d+)/);
  if (!versionMatch) {
    error('Version gate: pdsa_ref must contain a version path (v0.0.N).');
  }
  const currentVersion = parseInt(versionMatch[1]);

  // Detect rework: any rework indicator present
  const isRework = !!(dna.liaison_rework_reason || dna.rework_reason || (dna.rework_count && dna.rework_count >= 1));

  if (isRework) {
    // REWORK SUBMISSION: version must be > 1
    if (currentVersion <= 1) {
      error('Version gate: Rework requires a new version (v0.0.2+). Never update v0.0.1 in place — create a new version directory.');
    }

    // REWORK CONTEXT: must exist
    if (!dna.rework_context) {
      error('Version gate: rework_context required. Must describe what changed and why.');
    }

    // VERBATIM QUOTE CHECK: only for LIAISON-initiated rework (human feedback must be preserved)
    if (dna.liaison_rework_reason) {
      const feedback = dna.liaison_rework_reason;
      if (feedback.length > 20) {
        const snippet = feedback.substring(0, 50);
        if (!dna.rework_context.includes(snippet)) {
          error('Version gate: rework_context must quote human feedback verbatim.');
        }
      }
    }
  } else {
    // FIRST SUBMISSION: version must be exactly 1
    if (currentVersion !== 1) {
      error('Version gate: First submission must use v0.0.1. Higher versions are for rework iterations.');
    }
  }
}
```

#### Key Changes from v0.0.1

| Aspect | v0.0.1 | v0.0.2 |
|--------|--------|--------|
| Trigger transitions | `active→approval` only | `active→approval` AND `active→review` |
| Rework detection | `liaison_rework_reason` only | `liaison_rework_reason` OR `rework_reason` OR `rework_count >= 1` |
| First submission | No enforcement | Requires `pdsa_ref` contains `v0.0.1` |
| Quote check | All rework | Only LIAISON-initiated rework |
| Guard clause | Fires when `liaison_rework_reason` exists | Fires when `pdsa_ref` exists (broader) |

#### Gate Only Fires When pdsa_ref Exists

The guard clause is `dna.pdsa_ref` — the gate only applies to design tasks (which have pdsa_ref). Liaison content tasks, bugs without pdsa_ref, and operational tasks are unaffected.

#### Changes Required

1. **`src/db/interface-cli.js`** (~30 lines, replaces existing ~25 lines):
   - Replace lines 480-506 with broadened version enforcement block
   - Same location: after `validateDnaRequirements`, before LIAISON approval mode gate

#### What This Does NOT Do

- Does NOT check filesystem immutability (deferred to v0.0.3)
- Does NOT enforce abstract_ref versioning (separate concern)
- Does NOT add rework_count tracking (assumed set by workflow engine or agents)

#### Risks

- **Low risk**: Replaces existing gate with broader version, same location
- **Backward compatible**: v0.0.1 behavior preserved (LIAISON rework still enforced the same way)
- **New enforcement on first submission**: Requires pdsa_ref to contain `v0.0.1` — existing tasks that already have pdsa_ref with v0.0.1 are unaffected. Tasks without pdsa_ref skip the gate.

## DO

Implementation by DEV agent. Replace ~25 lines with ~30 lines in `interface-cli.js`.

## STUDY

After implementation:
- Verify QA-initiated rework triggers version enforcement
- Verify dev submissions (`active→review`) trigger version enforcement
- Verify first submissions require v0.0.1
- Verify LIAISON rework still requires verbatim quotes
- Verify all v0.0.1 tests still pass
- Verify tasks without pdsa_ref skip the gate

## ACT

If standardization works: this becomes the permanent versioning gate. Consider v0.0.3 for filesystem immutability checks.
