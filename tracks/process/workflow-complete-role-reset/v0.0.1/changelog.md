# Changelog: workflow-complete-role-reset v0.0.1

## Initial Design

- **Safety net**: Force `role=liaison` on ANY transition to `complete` status in `cmdTransition`
- **3 lines of code**: After rule lookup, before DNA write — `if (newStatus === 'complete') newRole = 'liaison'`
- **Cleanup migration**: One-time script to fix 69 existing complete tasks with wrong roles
- **Workflow v17**: Version bump with changelog documenting the safety net principle
- **Defense-in-depth**: Rules already define `newRole: 'liaison'` for complete transitions; safety net prevents future omissions
