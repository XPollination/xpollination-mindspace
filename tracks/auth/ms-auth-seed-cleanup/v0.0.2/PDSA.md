# PDSA: Seed Cleanup — Admin Bootstrap with Password & Invites

**Task:** `ms-auth-seed-cleanup`
**Priority:** Medium
**Group:** AUTH
**Parent PDSA:** [ms-auth-e2e-design D12](https://github.com/XPollination/xpollination-mindspace/blob/main/tracks/auth/ms-auth-e2e-design/v0.0.1/PDSA.md)
**Status:** Retroactive v0.0.2 (rework: per-task PDSA added post-implementation)
**Rework reason:** Task skipped PDSA planning — went directly to dev. This v0.0.2 provides the per-task PDSA documentation retroactively. Implementation verified at commit e9b5145.

## Context

The auth system needs an admin user bootstrapped at first run. The seed script previously contained test users (Robin, Maria, test@xpollination.dev) that should not exist in production. Thomas must be the sole admin with:
- Password login capability (bcrypt hash)
- Google OAuth email match for automatic account linking
- System admin privileges with unlimited invite quota

## Design Decisions

### D1: Remove all test users from seed

Delete Robin (`robin@xpollination.dev`), Maria (`maria@xpollination.dev`), and test (`test@xpollination.dev`) from both the seed array and the database via `DELETE FROM users WHERE email IN (...)`.

**Rationale:** Test users in production are a security risk — they have predictable emails and may have known credentials.

### D2: Thomas email matches Google OAuth

Use `thomas.pichler@xpollination.earth` — this is Thomas's Google OAuth email. Account linking is automatic: when Google OAuth returns this email, it matches the existing seed user.

### D3: Password via environment variable

`ADMIN_PASSWORD` env var → `bcrypt.hashSync(password, 12)`. Default: `changeme`.

**Rationale:** Password must not be hardcoded in source. Bcrypt with 12 salt rounds provides strong hashing. Default `changeme` forces the admin to change it on first real deployment.

### D4: System admin with unlimited invites

`is_system_admin=1, invite_quota=999` on INSERT.

**Rationale:** Admin needs unlimited invites to bootstrap the alpha user base. `999` is effectively unlimited for a friend-to-friend alpha.

### D5: Idempotent COALESCE update

```sql
UPDATE users SET
  password_hash = COALESCE(NULLIF(password_hash, ''), ?),
  invite_quota = 999,
  is_system_admin = 1
WHERE email = ?
```

**Rationale:** Handles existing Thomas rows from prior seeds that lack `password_hash`. `COALESCE(NULLIF(..., ''), ?)` only sets if empty/null — preserves intentionally-set passwords.

## Acceptance Criteria

1. Seed array contains ONLY Thomas Pichler (`thomas.pichler@xpollination.earth`)
2. Test users (robin@, maria@, test@) deleted via DELETE statement
3. Thomas has `is_system_admin=1` and `invite_quota=999`
4. Password hash from `ADMIN_PASSWORD` env var, bcrypt with 12 rounds
5. COALESCE update handles existing rows without overwriting intentional values
6. Seed remains idempotent (`INSERT OR IGNORE` + conditional update)

## Test Plan

1. Run seed on empty database → verify Thomas created with correct fields
2. Run seed twice → verify idempotent (no duplicates, no errors)
3. Run seed with existing Thomas (no password) → verify COALESCE adds password
4. Run seed with existing Thomas (has password) → verify password NOT overwritten
5. Verify test user emails not present after seed

## Verification (Retroactive)

Implementation verified at `api/db/seed.ts` (commit e9b5145, feature/auth-e2e):
- AC1: ✅ Seed array = `[{ name: 'Thomas Pichler', email: 'thomas.pichler@xpollination.earth' }]`
- AC2: ✅ `DELETE FROM users WHERE email IN ('robin@...', 'maria@...', 'test@...')`
- AC3: ✅ `is_system_admin=1, invite_quota=999` in INSERT
- AC4: ✅ `bcrypt.hashSync(ADMIN_PASSWORD, 12)`, default `changeme`
- AC5: ✅ `COALESCE(NULLIF(password_hash, ''), ?)` update
- AC6: ✅ `INSERT OR IGNORE` ensures idempotency
