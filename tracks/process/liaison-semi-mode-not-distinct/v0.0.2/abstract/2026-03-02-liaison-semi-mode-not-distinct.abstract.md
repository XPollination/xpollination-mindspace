# Completion Abstract: liaison-semi-mode-not-distinct

**Date:** 2026-03-02
**Status:** Complete
**Project:** xpollination-mcp-server

## Outcome

Fixed LIAISON semi approval mode to behave distinctly from auto and manual modes. Previously, semi mode was identical to auto (silently approving). Now three distinct behaviors exist: AUTO executes immediately, SEMI presents summary then waits for typed response, MANUAL waits for viz click confirmation.

## Key Decisions

- **Text-based interaction for semi:** Avoids AskUserQuestion which has a known empty-answer serialization bug. SEMI mode uses direct text presentation instead.
- **Mode included in monitor output:** agent-monitor.cjs now emits `liaison_approval_mode` in JSON so LIAISON can read the current mode before every transition.
- **Cross-repo fix:** Monitor code in xpollination-mcp-server, skill instructions in best-practices.

## Changes

- `viz/agent-monitor.cjs`: Added `getLiaisonApprovalMode()` reading from system_settings DB table, included in LIAISON work output JSON for both background and --wait modes (commit e417431)
- `best-practices/.claude/skills/xpo.claude.monitor/SKILL.md`: LIAISON section rewritten with 3 distinct mode behaviors (commit f87d193)

## Test Results

- Behavioral/skill instruction change — no automated tests applicable
- QA PASS (verified code logic and skill documentation)
- PDSA PASS

## Related Documentation

- Origin: Thomas reported semi mode auto-approved credential-rotation-thomas at 17:30 without distinct behavior
