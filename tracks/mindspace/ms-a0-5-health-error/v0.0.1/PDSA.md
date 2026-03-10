# PDSA: Health check endpoint + basic error handling middleware

**Task:** ms-a0-5-health-error
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-API-001

## Problem

The Express API server has no global error handling. Unhandled errors crash the process. Route-level try/catch is not sufficient — a middleware catch-all is needed for robustness.

### Existing Code

- `api/routes/health.ts` — returns `{status: 'ok', version: '0.0.7', uptime: N}`. Already satisfies the health check AC.
- `api/server.ts` — no error middleware registered.
- **ms-a0-2-sqlite-setup** (in parallel) adds DB status to health. This task focuses on error handling.

### Acceptance Criteria (from DNA)

1. Errors don't crash server
2. Health endpoint works

The health endpoint already works. This task's primary deliverable is the **error handling middleware**.

## Design

### Change A: Error handling middleware — `api/middleware/error-handler.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware.
 * Must be registered LAST (after all routes).
 * Express identifies error handlers by their 4-parameter signature.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log full error for debugging (structured JSON for future log pipeline)
  console.error(JSON.stringify({
    level: 'error',
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  }));

  // Return safe error response — never leak stack traces to client
  const statusCode = (err as any).statusCode || 500;
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    statusCode
  });
}
```

**Design decisions:**
- **4-parameter signature** — Express only calls error middleware when it has exactly `(err, req, res, next)`.
- **Structured JSON log** — logs `{level, message, stack, timestamp}` to stderr. A0.6 (logging framework) will replace `console.error` with a proper logger, but the format is forward-compatible.
- **Safe response** — 500 errors return a generic message, never the stack trace. Non-500 errors (e.g., 400, 404) can include the error message since those are intentional.
- **`statusCode` on error** — routes can `throw Object.assign(new Error('Not found'), { statusCode: 404 })` to control the HTTP status.

### Change B: 404 handler — `api/middleware/not-found.ts`

```typescript
import { Request, Response } from 'express';

/**
 * Catch-all 404 handler for unmatched routes.
 * Must be registered AFTER all routes, BEFORE error handler.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not found',
    statusCode: 404
  });
}
```

### Change C: Wire middleware into server — `api/server.ts`

Add after all route registrations (order matters):

```typescript
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';

// ... routes ...

// 404 catch-all (after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);
```

### Files Changed

1. `api/middleware/error-handler.ts` — **new** — global error catch-all, structured JSON logging, safe response
2. `api/middleware/not-found.ts` — **new** — 404 handler for unmatched routes
3. `api/server.ts` — **modified** — register middleware after routes

### Testing

1. `GET /health` returns 200 `{status: 'ok', version, uptime}`
2. `GET /nonexistent` returns 404 `{error: 'Not found', statusCode: 404}`
3. A route that throws returns 500 `{error: 'Internal server error', statusCode: 500}` — no stack trace in response
4. A route that throws with `statusCode: 400` returns 400 with error message in response
5. Error is logged to stderr as structured JSON with `{level, message, stack, timestamp}`
6. Server does not crash when a route throws
7. Async route errors are caught (Express 5 handles async errors automatically)
8. Error handler has 4 parameters (Express requirement for error middleware)
