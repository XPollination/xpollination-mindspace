# PDSA: Iterate claude-unblock.sh — Longer Commands, More Prompts

**Task:** ms-unblock-script-iteration | **Version:** v0.0.1 | **Status:** PLAN

## Problem
Longer DNA commands (liaison_review, Q&A, version_bump_ref) cause deeper wrapping in narrow tmux panes. Agents stuck more often despite 300-line capture fix.

## Plan
| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Audit new prompt patterns from recent task types | May have unrecognized patterns |
| D2 | Test 3s poll interval (down from 6s) for rapid permission bursts | Faster response to stuck agents |
| D3 | Increase capture depth to 500 lines if needed | Deeper wrapped commands need more lines |
| D4 | Add missed-prompt logging (detected prompt but couldn't find option) | Diagnostic for future iterations |
| D5 | Evaluate persistent background process per agent session | Reduce latency vs separate tmux session |

### Acceptance Criteria
- AC1: No unrecognized prompt patterns in current task types
- AC2: Poll interval optimized for responsiveness vs CPU
- AC3: Capture depth sufficient for longest DNA commands
- AC4: Missed prompts logged for diagnosis
- AC5: Agents unblocked within 10s of prompt appearance

### Files: `scripts/claude-unblock.sh`
