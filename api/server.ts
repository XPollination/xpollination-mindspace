import express from 'express';
import { healthRouter } from './routes/health.js';
import { a2aStreamRouter } from './routes/a2a-stream.js';
import { agentCardRouter } from './routes/agent-card.js';
import { twinSchemaRouter } from './routes/twin-schema.js';
import { authRouter } from './routes/auth.js';
import { keysRouter } from './routes/keys.js';
import { oauthRouter } from './routes/oauth.js';
import { projectsRouter } from './routes/projects.js';
import { agentsRouter } from './routes/agents.js';
import { a2aConnectRouter } from './routes/a2a-connect.js';
import { startAgentSweep } from './routes/agent-status-sweep.js';
import { a2aMessageRouter } from './routes/a2a-message.js';
import { marketplaceAnnouncementsRouter } from './routes/marketplace-announcements.js';
import { marketplaceRequestsRouter } from './routes/marketplace-requests.js';
import { getDb, closeDb } from './db/connection.js';
import { invitesRouter } from './routes/invites.js';
import { settingsRouter } from './routes/settings.js';
import { livekitRouter } from './routes/livekit.js';
import { requireApiKeyOrJwt } from './middleware/require-auth.js';
import { requestLogger } from './middleware/request-logger.js';
import { notFoundHandler } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { logger } from './lib/logger.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { mindspaceOAuthProvider } from './routes/mcp-oauth.js';
import { nodeActionsRouter } from './routes/node-actions.js';
import { dataRouter } from './routes/data.js';
import { apiKeysRouter } from './routes/api-keys.js';
import { oauthProviderRouter } from './routes/oauth-provider.js';
import { startMonitor, stopMonitor } from './lib/heartbeat-monitor.js';
import { workspacesRouter } from './routes/workspaces.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3100', 10);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));  // OAuth /token uses application/x-www-form-urlencoded
app.use(requestLogger);

// MCP OAuth 2.1 authorization server (RFC 9728)
// Must be mounted at root — handles /.well-known/*, /authorize, /token, /register, /revoke
const ISSUER_URL = process.env.FRONTEND_URL || 'https://mindspace.xpollination.earth';
try {
  app.use(mcpAuthRouter({
    provider: mindspaceOAuthProvider,
    issuerUrl: new URL(ISSUER_URL),
    serviceDocumentationUrl: new URL(`${ISSUER_URL}/docs`),
    scopesSupported: ['brain:read', 'brain:write'],
    resourceName: 'XPollination Brain',
    resourceServerUrl: new URL(process.env.BRAIN_PUBLIC_URL || 'https://hive.xpollination.earth'),
  }));
  logger.info('MCP OAuth authorization server mounted');
} catch (err) {
  logger.warn({ err }, 'MCP OAuth router failed to mount — OAuth disabled');
}

// Initialize database before starting
const db = getDb();
logger.info('Database connected (WAL mode, migrations table ready)');

app.use('/health', healthRouter);
app.use('/a2a/stream', a2aStreamRouter);
app.use('/a2a/connect', a2aConnectRouter);
app.use('/.well-known/agent.json', agentCardRouter);
app.use('/schemas/digital-twin-v1.json', twinSchemaRouter);
app.use('/api/auth', authRouter);
app.use('/api/keys', requireApiKeyOrJwt, keysRouter);
app.use('/api/auth/oauth', oauthRouter);
app.use('/api/projects', requireApiKeyOrJwt, projectsRouter);
// Agent pool must be before agentsRouter (which has /:agentId catch-all)
app.get('/api/agents/pool', requireApiKeyOrJwt, (req, res) => {
  const db = getDb();
  try {
    const agents = db.prepare(
      "SELECT id, name, current_role, status, project_slug, last_seen FROM agents WHERE status != 'disconnected' ORDER BY last_seen DESC"
    ).all();
    res.json(agents);
  } catch { res.json([]); }
});
app.use('/api/agents', requireApiKeyOrJwt, agentsRouter);
app.use('/api/invites', requireApiKeyOrJwt, invitesRouter);
app.use('/a2a/message', a2aMessageRouter);
app.use('/api/marketplace/announcements', requireApiKeyOrJwt, marketplaceAnnouncementsRouter);
app.use('/api/marketplace/requests', requireApiKeyOrJwt, marketplaceRequestsRouter);
app.use('/api/settings', requireApiKeyOrJwt, settingsRouter);
app.use('/api/livekit', requireApiKeyOrJwt, livekitRouter);
app.use('/api/node', nodeActionsRouter);
app.use('/api/data', dataRouter);
app.use('/api/settings/api-keys', requireApiKeyOrJwt, apiKeysRouter);
app.use('/api/settings/workspaces', requireApiKeyOrJwt, workspacesRouter);
app.use(oauthProviderRouter);

// Global suspect-links stats endpoint (kanban calls /api/suspect-links/stats?project=all)
app.get('/api/suspect-links/stats', requireApiKeyOrJwt, (req, res) => {
  const db = getDb();
  const merged: Record<string, number> = { suspect: 0, cleared: 0, accepted_risk: 0, total: 0 };
  try {
    const projectSlug = req.query.project as string;
    let sql = 'SELECT status, COUNT(*) as count FROM suspect_links';
    const params: any[] = [];
    if (projectSlug && projectSlug !== 'all') { sql += ' WHERE project_slug = ?'; params.push(projectSlug); }
    sql += ' GROUP BY status';
    const rows = db.prepare(sql).all(...params) as any[];
    for (const row of rows) { if (merged[(row as any).status] !== undefined) merged[(row as any).status] += (row as any).count; merged.total += (row as any).count; }
  } catch { /* table may not exist */ }
  res.json(merged);
});

// Error handling (after routes)
app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, 'Mindspace API server listening');
  startAgentSweep();
  startMonitor();
  logger.info('Heartbeat monitor started (30s interval)');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  stopMonitor();
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

export { app };
