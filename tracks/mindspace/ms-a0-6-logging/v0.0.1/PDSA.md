# PDSA: Logging framework (structured JSON logs)

**Task:** ms-a0-6-logging
**Version:** v0.0.1
**Author:** PDSA agent
**Date:** 2026-03-10
**Requirement:** REQ-API-001

## Problem

The API server uses `console.log`/`console.error` for output. No structured logging, no request IDs, no log level control. Production needs structured JSON logs with per-request tracing.

### Acceptance Criteria (from DNA)

1. Every request logged with method, path, status, duration
2. Request ID per request
3. Log level configurable via env var

## Analysis

### Library choice: pino

| Criteria | pino | winston |
|----------|------|---------|
| Performance | ~5x faster (async, minimal overhead) | Slower (sync transforms) |
| JSON native | Yes (default output) | Requires format config |
| Express middleware | pino-http (battle-tested) | express-winston |
| Size | ~200KB | ~800KB |
| Node.js alignment | Used by Fastify, Node.js foundation | Older ecosystem |

**Decision: pino** — fastest, JSON-native, small footprint. `pino-http` provides request logging with auto-generated request IDs.

## Design

### Change A: Install dependencies

```bash
npm install pino pino-http
npm install -D @types/pino-http
```

### Change B: Logger module — `api/lib/logger.ts`

```typescript
import pino from 'pino';

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

export const logger = pino({
  level,
  // Human-readable timestamps in ISO format
  timestamp: pino.stdTimeFunctions.isoTime
});
```

**Design decisions:**
- **Single logger instance** — all modules import from `api/lib/logger.ts`.
- **Level from env** — `LOG_LEVEL` env var overrides. Default: `debug` in dev, `info` in production.
- **No transport configuration** — stdout only. Log aggregation/routing is infrastructure concern (systemd journal, log shipper).
- **ISO timestamps** — `pino.stdTimeFunctions.isoTime` for human-readable + machine-parseable.

### Change C: Request logging middleware — `api/middleware/request-logger.ts`

```typescript
import pinoHttp from 'pino-http';
import { logger } from '../lib/logger.js';

export const requestLogger = pinoHttp({
  logger,
  // Auto-generates req.id (UUID) per request
  genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
  // Custom serializers to control what's logged
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: { 'user-agent': req.headers['user-agent'] }
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  },
  // Log completed requests with duration
  customSuccessMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) =>
    `${req.method} ${req.url} ${res.statusCode}`
});
```

**Design decisions:**
- **`x-request-id` passthrough** — if upstream (nginx) provides a request ID, use it. Otherwise generate UUID.
- **Minimal serializers** — log method, URL, status, user-agent. No request body (security), no full headers (noise).
- **pino-http auto-logs** — automatically logs request completion with duration in `responseTime` field.

### Change D: Wire into server — `api/server.ts`

```typescript
import { requestLogger } from './middleware/request-logger.js';
import { logger } from './lib/logger.js';

// Request logging (before routes)
app.use(requestLogger);

// ... routes ...

// Replace console.log with logger
const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Mindspace API server listening');
});
```

### Change E: Update error handler to use logger — `api/middleware/error-handler.ts`

Replace `console.error(JSON.stringify(...))` with:

```typescript
import { logger } from '../lib/logger.js';

// In error handler:
logger.error({ err, statusCode }, err.message);
```

pino automatically serializes Error objects (message + stack).

### Log Output Example

```json
{"level":30,"time":"2026-03-10T12:00:00.000Z","msg":"Mindspace API server listening","port":3100}
{"level":30,"time":"2026-03-10T12:00:01.000Z","req":{"method":"GET","url":"/health"},"res":{"statusCode":200},"responseTime":2,"reqId":"abc-123","msg":"GET /health 200"}
{"level":50,"time":"2026-03-10T12:00:02.000Z","err":{"message":"DB error","stack":"..."},"statusCode":500,"msg":"DB error"}
```

### Files Changed

1. `package.json` — add `pino`, `pino-http`, `@types/pino-http`
2. `api/lib/logger.ts` — **new** — pino logger instance with level config
3. `api/middleware/request-logger.ts` — **new** — pino-http middleware with request ID + serializers
4. `api/server.ts` — **modified** — register requestLogger before routes, use logger for startup
5. `api/middleware/error-handler.ts` — **modified** — replace console.error with logger.error

### Testing

1. `GET /health` produces structured JSON log line with `method`, `url`, `statusCode`, `responseTime`, `reqId`
2. Request ID is UUID when no `x-request-id` header is present
3. Request ID is passthrough when `x-request-id` header is present
4. `LOG_LEVEL=warn` suppresses info/debug log lines
5. `LOG_LEVEL=debug` shows debug-level log lines
6. Error responses produce log lines with `level: 50` (error) and `err.stack`
7. Request body is NOT logged (security)
8. Server startup produces structured log with port number
9. Default level is `debug` when NODE_ENV is not `production`
10. Default level is `info` when NODE_ENV is `production`
