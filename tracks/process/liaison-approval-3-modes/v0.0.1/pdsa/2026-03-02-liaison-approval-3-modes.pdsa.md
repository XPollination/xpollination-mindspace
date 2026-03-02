# PDSA: Extend LIAISON Approval to 3 Modes

**Date:** 2026-03-02
**Task:** liaison-approval-3-modes
**Extends:** liaison-approval-mode (best-practices:e0af50bc)
**Status:** PLAN

## Plan

### Problem
Current implementation has 2 modes (manual, auto). Thomas wants a middle ground:
- **Auto** currently requires `liaison_reasoning` in DNA — too restrictive for trusted batches
- **Manual** requires viz click — too slow for routine approvals when Thomas is in chat

Need 3 modes: auto (fully free), semi (chat-based wait), manual (viz-required).

### Design

#### Mode Definitions

| Mode | Engine Enforcement | Agent Behavior | Human Interaction |
|------|-------------------|---------------|-------------------|
| **auto** | None — LIAISON transitions freely | Agent evaluates DNA, proceeds | None needed |
| **semi** | None — enforcement is at agent protocol level | Agent presents in chat, STOPS, waits for typed response | Types approve/rework in chat |
| **manual** | Requires `human_confirmed=true` in DNA | Agent cannot proceed without viz click | Clicks Confirm in mindspace viz |

#### Change 1: Mode gate in interface-cli.js
**File:** `xpollination-mcp-server/src/db/interface-cli.js` (line ~483)

Current code checks 2 modes. Replace with 3-mode logic:

```javascript
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  const ensureSettings = db.prepare("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
  ensureSettings.run();
  const mode = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
  const modeValue = mode?.value || 'manual';

  if (modeValue === 'manual') {
    // Manual mode: require human_confirmed in DNA (viz click)
    if (!dna.human_confirmed) {
      db.close();
      error(`LIAISON manual mode active. Set dna.human_confirmed=true via mindspace viz before executing ${transitionKey}. Human must click Confirm in viz UI.`);
    }
    delete dna.human_confirmed;
  }
  // Semi mode: no engine enforcement (agent protocol handles chat-based wait)
  // Auto mode: no engine enforcement (LIAISON proceeds freely)
}
```

**Key change:** Remove the `liaison_reasoning` requirement from auto mode. Remove the explicit `auto` branch entirely — both `semi` and `auto` pass through with no engine enforcement. Only `manual` has a hard gate.

**Why no engine gate for semi?** The semi-mode "wait for typed response" is an agent protocol behavior — LIAISON stops and waits in its chat session. The workflow engine cannot enforce "did the agent actually wait?" because it only sees the transition request. The enforcement is in the LIAISON agent's skill/prompt, not in the engine.

#### Change 2: Viz API validation
**File:** `xpollination-mcp-server/viz/server.js` (line ~308)

Change validation from `['manual', 'auto']` to `['manual', 'semi', 'auto']`:

```javascript
if (!body.mode || !['manual', 'semi', 'auto'].includes(body.mode)) {
  sendJson(res, { error: 'Invalid mode. Must be manual, semi, or auto' }, 400);
  return;
}
```

#### Change 3: Viz dropdown
**File:** `xpollination-mcp-server/viz/index.html` (line ~551-553)

Add semi option:

```html
<select id="liaison-mode" title="LIAISON Approval Mode" style="padding:2px 4px;font-size:11px;border-radius:3px;border:1px solid #555;background:#2a2a2a;color:#ccc;cursor:pointer;">
  <option value="manual">Manual</option>
  <option value="semi">Semi</option>
  <option value="auto">Auto</option>
</select>
```

#### Change 4: Update existing tests
**File:** `xpollination-mcp-server/src/db/__tests__/workflow-engine.test.ts`

- Update any tests that validate the mode values to include `semi`
- Remove test for `liaison_reasoning` requirement in auto mode (no longer required)
- Add test: semi mode allows LIAISON to transition without `human_confirmed` or `liaison_reasoning`
- Add test: auto mode allows LIAISON to transition without any special DNA

### Files Modified
| File | Change |
|------|--------|
| `src/db/interface-cli.js` | Remove auto-mode `liaison_reasoning` requirement; simplify to: manual=hard gate, semi/auto=pass |
| `viz/server.js` | Add `semi` to valid mode values |
| `viz/index.html` | Add Semi option to dropdown |
| `src/db/__tests__/workflow-engine.test.ts` | Update mode tests for 3 modes |

### NOT Changed
- `workflow-engine.js` (no changes to `requiresHumanConfirm` flags or transition rules)
- `system_settings` table schema (same key, just new valid value)
- Confirm endpoint in viz server (still needed for manual mode)
- Default mode stays `manual`

### Risks
- **Semi mode relies on agent discipline** — LIAISON might skip the chat wait in semi mode. Mitigation: brain markers and audit trail show if LIAISON actually presented before transitioning.
- **Auto mode is now fully ungated** — removing `liaison_reasoning` means auto-approved transitions leave no trace in DNA. Mitigation: brain markers (`TASK transition` markers) still fire on every transition. Thomas can review brain history.

## Do
(To be completed by DEV agent — all changes in xpollination-mcp-server repo)

## Study
- Auto mode: LIAISON transitions without any DNA requirements
- Semi mode: LIAISON transitions without engine enforcement (protocol handles wait)
- Manual mode: LIAISON blocked without human_confirmed (unchanged)
- Viz dropdown shows 3 options, API accepts all 3 values
- Default remains manual

## Act
- Monitor: does semi mode actually produce chat-based confirmations?
- Consider: audit log of mode changes with before/after values
- Consider: brain-based verification that LIAISON presented before semi-mode transitions
