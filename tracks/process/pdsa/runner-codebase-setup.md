# PDSA: runner-codebase-setup

## Plan

Layer 0 codebase setup for the xp0 runner system. Establishes directory structure, config alignment, and dependency setup so all downstream runner-* tasks know where to write code.

**Decision: Option (a) — `src/xp0/` inside xpollination-mindspace**

Rationale:
- Keeps everything in one repo, avoids premature monorepo complexity
- Auto-included in existing `tsconfig.json` (`include: ["src/**/*"]`) and `vitest.config.ts` (`src/**/*.test.ts`)
- Clear namespace separation from existing `src/` modules (tools, services, db, etc.)
- Can extract to separate package later if needed

## Directory Structure

```
src/xp0/
  index.ts              — barrel export (empty stub)
  twin/
    index.ts            — kernel: create, validate, sign, evolve, CID
  storage/
    index.ts            — StorageAdapter interface + FileStorageAdapter
  auth/
    index.ts            — Ed25519 keygen, DID, delegation VC
  validation/
    index.ts            — 6-step transaction validator
  workflow/
    index.ts            — decentralized workflow engine
  runner/
    index.ts            — runner process, Claude Code bridge
  transport/
    index.ts            — libp2p: GossipSub, Bitswap, DHT (Phase 2)
  schemas/
    index.ts            — well-known schemas: runner, team, delegation-vc
  test/
    index.ts            — shared test utilities, mock Claude Code
```

## Config Changes

- **tsconfig.json:** NO CHANGES — `src/**/*` already includes `src/xp0/**/*`
- **vitest.config.ts:** NO CHANGES — `src/**/*.test.ts` already matches
- **package.json:** Add `@noble/ed25519` (needed by auth/identity tasks)

## Existing Assets

- `src/twins/cid.js` — existing CID computation. `src/xp0/twin/` will import from it.
- `multiformats`, `@ipld/dag-json`, `zod` — already in package.json
- Branch: `feature/host-agent-runtime` — already exists and checked out

## Acceptance Criteria

1. Directory structure exists with `index.ts` stubs in each dir
2. TypeScript compiles (strict mode, zero errors)
3. vitest runs (`src/xp0/twin/twin.test.ts` passes)
4. All runner-* tasks know where to write code

## Dev Instructions

1. Create all directories under `src/xp0/`
2. Create `index.ts` in each directory — minimal placeholder export (`export {}`)
3. Create `src/xp0/twin/twin.test.ts` with one `expect(true).toBe(true)` test
4. Run `npx tsc --noEmit` to verify compilation
5. Run `npx vitest run src/xp0/` to verify test passes
6. `npm install @noble/ed25519`
7. Git add each file, commit, push

## What NOT To Do

- Do NOT modify existing `tsconfig.json` or `vitest.config.ts`
- Do NOT create complex abstractions — stubs only
- Do NOT implement any actual logic (other runner-* tasks handle that)
- Do NOT touch existing `src/twins/cid.js`

## Study / Act

(Populated after implementation)
