# PDSA: Initialize Node.js Project with Express.js

**Task:** ms-a0-1-express-setup
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-09

## Problem

The xpollination-mcp-server currently runs as an MCP server (Model Context Protocol) with a viz server for the mindspace dashboard. The Mindspace v0.0.7 requirement (REQ-API-001) calls for a REST API server built on Express.js to serve as the backend for the mindspace web application.

This task initializes the Express.js project structure within the existing repository, adds the health endpoint, and establishes the folder structure for future API routes, middleware, models, and services.

## Analysis

### Existing project context

The repo already has:
- `src/` — MCP server code (TypeScript)
- `viz/` — dashboard server (plain JS, http module)
- `package.json` — existing with MCP dependencies
- `tsconfig.json` — TypeScript configuration
- `vitest` — test framework already configured

### Design decisions

1. **Coexistence with MCP server**: The Express API server is a SEPARATE entry point from the MCP server (`src/index.ts`). It lives in a new `api/` directory at the project root to keep clear separation.

2. **TypeScript**: Use TypeScript (matching the existing project). The Express app follows the same `tsconfig.json` and build process.

3. **Folder structure**: Per requirement — `routes/`, `middleware/`, `models/`, `services/` inside `api/`.

4. **Port**: The Express server will bind to a configurable port (default 3100, configurable via `API_PORT` env var). This avoids conflicts with:
   - MCP server (stdin/stdout, no port)
   - Viz PROD (4100 after migration)
   - Viz TEST (4200)
   - Brain API (3200)

5. **Health endpoint**: `GET /health` returns `{ status: "ok", version: "0.0.7", uptime: N }` per A0.5 spec.

6. **No new dependencies for A0.1**: Express.js is the only new dependency. No database, auth, or logging in this task — those are A0.2, A0.4, A0.6.

## Design

### Change A: Install Express.js dependency

```bash
npm install express
npm install -D @types/express
```

### Change B: Create API folder structure

```
api/
├── server.ts          # Express app setup + listen
├── routes/
│   └── health.ts      # GET /health route
├── middleware/
│   └── .gitkeep       # Placeholder for future middleware
├── models/
│   └── .gitkeep       # Placeholder for future models
└── services/
    └── .gitkeep       # Placeholder for future services
```

### Change C: Create api/server.ts

```typescript
import express from 'express';
import { healthRouter } from './routes/health.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());
app.use('/health', healthRouter);

app.listen(PORT, () => {
  console.log(`Mindspace API server listening on port ${PORT}`);
});

export { app };
```

### Change D: Create api/routes/health.ts

```typescript
import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.0.7',
    uptime: process.uptime()
  });
});

export { healthRouter };
```

### Change E: Add npm scripts

Add to package.json scripts:

```json
{
  "api": "node dist/api/server.js",
  "api:dev": "tsx watch api/server.ts"
}
```

### Change F: Update tsconfig.json include

Ensure `api/` directory is included in TypeScript compilation:

```json
{
  "include": ["src/**/*", "api/**/*"]
}
```

### Files Changed

1. `package.json` — add express + @types/express, add api scripts
2. `api/server.ts` — new file, Express app entry point
3. `api/routes/health.ts` — new file, health endpoint
4. `api/middleware/.gitkeep` — new file, placeholder
5. `api/models/.gitkeep` — new file, placeholder
6. `api/services/.gitkeep` — new file, placeholder
7. `tsconfig.json` — add `api/` to include

### Testing

1. `api/server.ts` exists
2. `api/routes/health.ts` exists
3. `api/middleware/` directory exists
4. `api/models/` directory exists
5. `api/services/` directory exists
6. `express` is in package.json dependencies
7. `@types/express` is in package.json devDependencies
8. `npm run api` script exists in package.json
9. Server starts and listens on configured port
10. `GET /health` returns 200 with JSON body
11. Response contains `status: "ok"`
12. Response contains `version: "0.0.7"`
13. Response contains `uptime` as a number
14. `tsconfig.json` includes `api/**/*`
15. TypeScript compiles without errors (`npm run build`)
