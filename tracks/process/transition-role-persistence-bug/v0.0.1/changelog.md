# Changelog: transition-role-persistence-bug v0.0.1

## v0.0.1 — 2026-03-10

Initial design.

### Root cause analysis
- `db.prepare().run()` return value (`.changes`) never checked — silent 0-row updates
- No transaction around read-modify-write — TOCTOU vulnerability
- No busy_timeout — WAL contention fails immediately (busy_timeout=0 default)

### Fix design
- Check `.changes === 0` after every UPDATE and throw error
- Wrap read-modify-write in `db.transaction()` for atomicity
- Add verification read-back after role-changing transitions
- Set `busy_timeout = 5000` in `getDb()`
- 1 file changed: src/db/interface-cli.js (UPDATE)
- 10 test cases
