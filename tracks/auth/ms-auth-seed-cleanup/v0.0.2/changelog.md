# Changelog: ms-auth-seed-cleanup v0.0.2

## Summary
Seed cleanup: removed test users, set Thomas as admin with password + unlimited invites.

## Changes
- Removed Robin and Maria test users from seed array
- Added DELETE for robin@, maria@, test@ emails
- Thomas gets bcrypt password_hash via ADMIN_PASSWORD env var (default changeme, 12 salt rounds)
- Thomas gets invite_quota=999 and is_system_admin=1
- COALESCE update for existing Thomas rows missing password_hash
- Email thomas.pichler@xpollination.earth matches Google OAuth for automatic linking

## Commits
- xpollination-mcp-server: e9b5145 (feature/auth-e2e)

## Verification
- 11/11 tests pass (ms-auth-seed-cleanup.test.ts)
- QA: PASS
- PDSA: PASS (retroactive v0.0.2)
