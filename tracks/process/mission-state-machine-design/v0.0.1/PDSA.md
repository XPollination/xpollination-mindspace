# PDSA: Mission State Machine
## Plan
States: draft→ready→active→complete→deprecated. Missions follow same workflow pattern as tasks but simpler.
- draft: mission being defined
- ready: mission defined, ready for capability work
- active: capabilities being worked on
- complete: all capabilities delivered
- deprecated: superseded by new mission

Transitions: liaison creates in draft, activates to ready. Work begins → active. All capabilities complete → complete.
## Do
Add mission_status column or use existing status field with new CHECK constraint.
## Study
Verify: transition validation, status display in viz.
## Act
Reuse existing workflow engine patterns for mission-level transitions.
