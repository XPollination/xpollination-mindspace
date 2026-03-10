# Changelog: ms-a7-2-agent-lease-bond v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Design decisions
- New `agent_bonds` table (010-agent-bonds.sql) with status, expiry, renewal tracking
- `agent-bond.ts` service: createBond, renewBond, expireBond, getActiveBond, sweepExpiredBonds
- Bond created on agent registration, renewed on heartbeat
- Old bonds expired on re-registration (one active bond per agent)
- AGENT_BOND_DURATION_MINUTES env var (default 60)
- sweepExpiredBonds() integrated into existing status sweep
- 4 files: 010-agent-bonds.sql (NEW), agent-bond.ts (NEW), agents.ts (UPDATE), agent-status-sweep.ts (UPDATE)
- 16 test cases
