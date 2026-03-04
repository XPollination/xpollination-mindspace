# PDSA: PM Status Auto Drill-In — v0.0.1

## PLAN

### Problem

After presenting the PM status summary table (Phase 1), LIAISON asks Thomas "shall I drill in?" before proceeding to Phase 2 task drill-down. Thomas always says yes — this is a wasted interaction that slows down the PM status flow.

### Root Cause

The skill file at `xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md` describes Step 2 (summary) and Step 3 (drill-down) as separate steps without explicit instruction to proceed automatically. LIAISON agents interpret the step boundary as a pause point.

### Design

Add explicit instruction at the end of Step 2 and beginning of Step 3 that LIAISON proceeds directly to drill-down without confirmation.

#### Change 1: End of Step 2 — Add auto-proceed instruction

After the summary table presentation text, add:

```
**IMPORTANT: Proceed directly to Step 3 after presenting the summary. Do NOT ask "shall I drill in?" or wait for confirmation. Thomas always wants drill-down — the summary is context, the drill-down is the value.**
```

#### Change 2: Beginning of Step 3 — Reinforce auto-proceed

Update the Step 3 header to read:

```
## Step 3: Phase 2 — Sequential Task Drill-Down (Auto-Proceed)
```

And add at the start:

```
**LIAISON proceeds immediately after presenting the summary table. No confirmation needed.**
```

### Changes Required

1. **`xpollination-best-practices/.claude/skills/xpo.claude.mindspace.pm.status/SKILL.md`** (~3 lines):
   - Add auto-proceed instruction after Step 2's summary format block (after line 81)
   - Update Step 3 heading to include "(Auto-Proceed)" (line 82)
   - Add reinforcement sentence at start of Step 3 (after line 83)

### What This Does NOT Do

- Does NOT change the summary table format
- Does NOT change the drill-down presentation format (6-part structured format stays)
- Does NOT change mode behavior (AUTO/SEMI/MANUAL still applies per task)
- Does NOT remove the summary step — summary is still shown first

### Acceptance Criteria

1. Skill file explicitly says to proceed directly from summary to drill-down
2. No "shall I drill in?" instruction exists in the skill
3. Summary table still presented before drill-down
4. Skill version documented in the change

## DO

Implementation by DEV agent. ~3 lines added to SKILL.md.

## STUDY

Next time LIAISON runs `/xpo.claude.mindspace.pm.status`, observe if it proceeds directly without asking.

## ACT

If Thomas confirms the change works: consider applying the same "no unnecessary confirmation" principle to other skill files.
