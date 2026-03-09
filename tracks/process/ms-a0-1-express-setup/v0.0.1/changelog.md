# Changelog: ms-a0-1-express-setup v0.0.1

## Initial Design

- **Express.js project**: New `api/` directory at project root, separate from MCP server (`src/`)
- **Folder structure**: `api/routes/`, `api/middleware/`, `api/models/`, `api/services/`
- **Health endpoint**: `GET /health` returns `{ status: "ok", version: "0.0.7", uptime: N }`
- **Port**: Default 3100, configurable via `API_PORT` env var
- **Dependencies**: express + @types/express only (minimal for A0.1)
- **TypeScript**: Same tsconfig, same build process as existing project
