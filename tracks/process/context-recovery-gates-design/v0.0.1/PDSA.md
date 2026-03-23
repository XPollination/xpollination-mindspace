# PDSA: Agent Context Recovery Hard Gates

## Plan
Three gates preventing context loss patterns:
1. **Mode gate**: Startup verifies autonomy mode from API before first transition. No cached values.
2. **Infrastructure gate**: Startup validates env vars (JWT_SECRET, DATABASE_PATH, BRAIN_API_KEY). Fail fast with clear error.
3. **Process gate**: Backlog status prevents premature pipeline entry. Tasks start in backlog, release to pending only via mission activation.

## Do
DEV implements 3 gates in agent-monitor.cjs and interface-cli.js.

## Study
Verify: agent without env vars → startup fails with clear message. Agent without mode check → transition blocked. Backlog tasks don't appear in monitor.

## Act
- Mode gate: query /api/settings/liaison-approval-mode on every transition (already in SKILL.md)
- Infra gate: validate env vars at startup, not at first use
- Process gate: backlog status + monitor exclusion (from backlog-status-design)
