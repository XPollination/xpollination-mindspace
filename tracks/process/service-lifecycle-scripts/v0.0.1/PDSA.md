# PDSA: Service Lifecycle Scripts

**Task:** `service-lifecycle-scripts`
**Version:** v0.0.1
**Status:** Design

## Plan

### Problem
Agents need infrastructure knowledge (ports, env vars, systemd, passwords) to restart services, deploy versions, or run migrations. This knowledge is scattered across CLAUDE.md, brain, and service files. When context is lost, agents reconstruct incorrectly.

### Solution
A single script (`scripts/service-lifecycle.js`) that encapsulates ALL infrastructure knowledge. Agents call `npm run restart:api` — no passwords, no env var reconstruction needed.

### Service Definitions (embedded in script)

```javascript
const SERVICES = {
  viz: {
    name: 'Mindspace Viz',
    port: 4200,
    command: 'node viz/server.js',
    healthUrl: 'http://localhost:4200/health',
    envRequired: ['JWT_SECRET', 'API_PORT'],
    workingDir: process.cwd()
  },
  api: {
    name: 'Mindspace API',
    port: 3100,
    command: 'npx tsx api/server.ts',
    healthUrl: 'http://localhost:3100/health',
    envRequired: ['JWT_SECRET', 'DATABASE_PATH'],
    workingDir: process.cwd()
  }
};
```

### Commands

| npm script | Function | Implementation |
|-----------|----------|---------------|
| `npm run restart:viz` | Restart viz server | Kill by port → start → health check |
| `npm run restart:api` | Restart API server | Kill by port → start → health check |
| `npm run deploy:viz -- v0.0.36` | Deploy viz version | Copy active → new version → update symlink → restart → health check → rollback on failure |
| `npm run migrate` | Run DB migrations | Read api/db/migrations/*.sql → check migrations table → execute pending |
| `npm run health` | Check all services | HTTP GET each health URL → output status table |

### Process Management

```javascript
// Kill by port (no sudo needed)
function killByPort(port) {
  const result = execSync(`lsof -t -i:${port}`, { encoding: 'utf8' }).trim();
  if (result) {
    result.split('\n').forEach(pid => process.kill(parseInt(pid), 'SIGTERM'));
    // Wait up to 5s for graceful shutdown
  }
}

// Start as background process
function startService(service) {
  const child = spawn('node', [service.command.split(' ').slice(1)], {
    cwd: service.workingDir,
    env: { ...process.env, ...loadEnv() },
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return child.pid;
}
```

### .env.example

```bash
# Mindspace Service Configuration
# Copy to .env and fill in values. Never commit .env.

# Required for both services
JWT_SECRET=your-jwt-secret-here

# API Server
DATABASE_PATH=./data/mindspace.db
API_PORT=3100
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://mindspace.xpollination.earth/api/auth/oauth/google/callback
FRONTEND_URL=https://mindspace.xpollination.earth

# Viz Server
VIZ_PORT=4200

# Brain API
BRAIN_API_URL=https://hive.xpollination.earth
BRAIN_API_KEY=your-brain-api-key
```

### package.json scripts

```json
{
  "scripts": {
    "restart:viz": "node scripts/service-lifecycle.js restart viz",
    "restart:api": "node scripts/service-lifecycle.js restart api",
    "deploy:viz": "node scripts/service-lifecycle.js deploy viz",
    "migrate": "node scripts/service-lifecycle.js migrate",
    "health": "node scripts/service-lifecycle.js health"
  }
}
```

## Do

DEV creates:
1. `scripts/service-lifecycle.js` — main script with all 5 commands
2. `.env.example` — template with comments
3. Updates `package.json` with npm scripts

## Study

Verify:
- `npm run health` outputs status table with all services
- `npm run restart:api` restarts API and health check passes
- `npm run migrate` runs pending migrations
- `npm run deploy:viz -- v0.0.36` copies, symlinks, restarts, checks health
- All commands work without sudo, without ssh
- Running twice is safe (idempotent)

## Act

### Design Decisions
1. **Single file**: One script for all lifecycle operations. No scattered shell scripts.
2. **dotenv**: Standard Node.js pattern. `.env` is gitignored, `.env.example` is committed.
3. **Kill by port**: No PID files needed. `lsof -t -i:PORT` finds the process.
4. **Health check after restart**: Automatic verification. Fail loudly if service doesn't come up.
5. **Rollback on deploy failure**: Save previous version symlink, restore if health check fails.
6. **No sudo**: All operations run as `developer` user. systemd service files are managed separately.
