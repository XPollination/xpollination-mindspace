# Theia Version Update Flow

## Strategy
Pin to Theia **quarterly stable** releases. Monthly releases exist but quarterly is more stable.

## Current Version
`~1.69.0` (all `@theia/*` packages at same version)

## Update Process

1. **Create branch**: `git checkout -b update/theia-1.XX.0`
2. **Bump version** in all package.json files:
   - `mindspace-ide/browser-app/package.json` — all `@theia/*` deps
   - `mindspace-ide/extensions/@mindspace/theia-a2a/package.json`
   - `mindspace-ide/extensions/@mindspace/theia-layouts/package.json`
   - `mindspace-ide/extensions/@mindspace/theia-branding/package.json`
3. **Install**: `cd mindspace-ide && yarn install`
4. **Build**: `yarn build`
5. **Test on beta**: Deploy to beta-mindspace, verify:
   - IDE loads on port 4200
   - Terminal opens and runs Claude Code
   - Git extension works (branch, commit, push)
   - Custom extensions load (check console for log messages)
   - A2A events flow to agent terminals
6. **If green**: Merge to `develop`, then `rc`, then `main`
7. **If red**: Revert package.json changes, rebuild

## Rollback
```bash
git revert HEAD  # Undo version bump
yarn install     # Restore previous deps
yarn build       # Rebuild with old version
```

## What NOT to Do
- Don't fork Theia — composition via package.json only
- Don't pin to `latest` — always pin to specific version
- Don't mix Theia versions — all `@theia/*` must be same version
- Don't skip beta testing — always verify before production
