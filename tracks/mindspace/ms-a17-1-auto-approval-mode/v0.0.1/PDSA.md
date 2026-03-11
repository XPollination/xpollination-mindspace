# PDSA: Split Auto Mode — Add Auto-Approval that Blocks Auto-Complete

**Task:** ms-a17-1-auto-approval-mode
**Status:** Design
**Version:** v0.0.1

## Plan

Add a new `auto-approval` LIAISON approval mode. In this mode, LIAISON can auto-approve designs (approval→approved) without human confirmation, but the workflow engine BLOCKS auto-complete (review→complete), requiring manual confirmation. This prevents rubber-stamping implementation reviews while keeping design approval fast.

### Dependencies

- None (modifies existing approval mode system)

### Investigation

**Current mode system (3 modes):**
- `manual` — all gated transitions require human_confirmed via viz UI
- `semi` — no engine enforcement; agent protocol handles chat-based confirmation
- `auto` — no enforcement; LIAISON proceeds freely on all transitions

**Code locations:**
1. `src/db/interface-cli.js` lines 625-655: LIAISON approval mode enforcement gate
2. `viz/server.js` line 329: valid modes array `['manual', 'semi', 'auto']`
3. `viz/server.js` line 163: default mode INSERT
4. `viz/index.html`: dropdown UI for mode selection

**Current gate logic (interface-cli.js:632-655):**
```
if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
  check mode:
    manual → require human_confirmed + human_confirmed_via='viz'
    semi → no enforcement
    auto → no enforcement
}
```

**Design decisions:**
- `auto-approval` = new 4th mode
- In `auto-approval` mode:
  - `approval→approved` transitions: NO enforcement (passes freely, like auto)
  - `review→complete` transitions: BLOCKED (requires human_confirmed like manual)
  - All other gated transitions: NO enforcement (like auto)
- The key distinction is which transitions are gated:
  - approval→approved = design approval (auto-approve OK)
  - review→complete = final completion (needs human eyes)

## Do

### File Changes

#### 1. `src/db/interface-cli.js` (UPDATE — lines 625-655)

Replace the mode gate logic:

```javascript
  // LIAISON approval mode enforcement gate
  const transitionKey = `${fromStatus}->${newStatus}`;
  // ... existing transition rule lookup ...

  if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
    // Check global LIAISON approval mode
    const ensureSettings = db.prepare("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
    ensureSettings.run();
    const mode = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
    const modeValue = mode?.value || 'auto';

    if (modeValue === 'manual') {
      // Manual mode: ALL gated transitions require human_confirmed via viz
      if (!dna.human_confirmed) {
        db.close();
        error(`LIAISON manual mode active. Set dna.human_confirmed=true via mindspace viz before executing ${transitionKey}.`);
      }
      if (dna.human_confirmed_via !== 'viz') {
        db.close();
        error(`LIAISON manual mode requires human_confirmed_via='viz'. Current value: '${dna.human_confirmed_via || 'none'}'.`);
      }
      delete dna.human_confirmed;
      delete dna.human_confirmed_via;
    } else if (modeValue === 'auto-approval') {
      // Auto-approval mode: approval→approved passes freely, review→complete is blocked
      const isCompletionTransition = (fromStatus === 'review' && newStatus === 'complete');
      if (isCompletionTransition) {
        if (!dna.human_confirmed) {
          db.close();
          error(`LIAISON auto-approval mode: review→complete requires human confirmation. Set dna.human_confirmed=true via viz. Design approvals (approval→approved) pass automatically.`);
        }
        if (dna.human_confirmed_via !== 'viz') {
          db.close();
          error(`LIAISON auto-approval mode requires human_confirmed_via='viz' for completion. Current value: '${dna.human_confirmed_via || 'none'}'.`);
        }
        delete dna.human_confirmed;
        delete dna.human_confirmed_via;
      }
      // All other gated transitions (including approval→approved) pass freely
    }
    // Semi mode: no engine enforcement (agent protocol handles chat-based confirmation)
    // Auto mode: no enforcement, liaison proceeds freely
  }
```

#### 2. `viz/server.js` (UPDATE — line 329)

Update valid modes array:

```javascript
if (!body.mode || !['manual', 'semi', 'auto-approval', 'auto'].includes(body.mode)) {
  sendJson(res, { error: 'Invalid mode. Must be "manual", "semi", "auto-approval", or "auto".' }, 400);
```

#### 3. `viz/index.html` (UPDATE — dropdown)

Add Auto-Approval option to the approval mode dropdown:

```html
<select id="approval-mode">
  <option value="manual">Manual</option>
  <option value="semi">Semi</option>
  <option value="auto-approval">Auto-Approval</option>
  <option value="auto">Auto</option>
</select>
```

## Study

### Test Cases (10 total)

**Auto-approval mode — design approval (3):**
1. approval→approved passes without human_confirmed when mode=auto-approval
2. approval→approved works with any actor (liaison)
3. LIAISON can freely approve designs

**Auto-approval mode — completion blocked (3):**
4. review→complete is BLOCKED without human_confirmed when mode=auto-approval
5. review→complete succeeds WITH human_confirmed+human_confirmed_via=viz
6. Error message mentions auto-approval mode and explains the distinction

**Existing modes unchanged (2):**
7. manual mode still blocks ALL gated transitions
8. auto mode still allows ALL transitions freely

**Viz integration (2):**
9. PUT /api/settings/liaison-approval-mode accepts 'auto-approval'
10. GET returns 'auto-approval' when set

## Act

### Deployment

- 3 files: interface-cli.js (UPDATE), viz/server.js (UPDATE), viz/index.html (UPDATE)
- No migration needed — uses existing system_settings table
- New mode value: 'auto-approval'
- Backward compatible — existing modes unchanged
