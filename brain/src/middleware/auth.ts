import { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import { getDb } from "../services/database.js";

const JWT_SECRET = process.env.JWT_SECRET || "changeme";

interface MindspaceKeyRow {
  key_id: string;
  revoked_at: string | null;
  user_id: string;
  display_name: string;
}

interface BrainUserRow {
  qdrant_collection: string;
}

// Mindspace DB (read-only) — validates API keys from the Mindspace api_keys table.
// Mounted at /app/mindspace-data/mindspace.db in Docker.
const MINDSPACE_DB_PATH = process.env.MINDSPACE_DB_PATH || "/app/mindspace-data/mindspace.db";
let mindspaceDb: Database.Database | null = null;

function getMindspaceDb(): Database.Database | null {
  if (mindspaceDb) return mindspaceDb;
  try {
    mindspaceDb = new Database(MINDSPACE_DB_PATH, { readonly: true });
    return mindspaceDb;
  } catch {
    return null;
  }
}

export async function authHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Health and onboarding endpoints are exempt from auth
  if (request.url.startsWith("/api/v1/health") || request.url === "/health" || request.url === "/" || request.url.startsWith("/assets/")) {
    return;
  }

  const authorization = request.headers.authorization;
  if (!authorization || !authorization.toLowerCase().startsWith("bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authorization.slice("bearer ".length);

  // Validate against Mindspace api_keys table (SHA-256 hashed, revocable)
  const msDb = getMindspaceDb();
  if (!msDb) {
    reply.code(503).send({ error: "Auth database unavailable — mindspace.db not mounted" });
    return;
  }

  const keyHash = createHash("sha256").update(token).digest("hex");

  // Try API keys first
  let row = msDb.prepare(
    `SELECT ak.id AS key_id, ak.revoked_at, u.id AS user_id, u.name AS display_name
     FROM api_keys ak JOIN users u ON ak.user_id = u.id
     WHERE ak.key_hash = ?`
  ).get(keyHash) as MindspaceKeyRow | undefined;

  // If not an API key, try OAuth access tokens
  if (!row) {
    const oauthRow = msDb.prepare(
      `SELECT oat.revoked_at, oat.user_id, u.name AS display_name
       FROM oauth_access_tokens oat JOIN users u ON oat.user_id = u.id
       WHERE oat.token_hash = ? AND oat.expires_at > datetime('now')`
    ).get(keyHash) as any;
    if (oauthRow) {
      row = { key_id: "oauth", revoked_at: oauthRow.revoked_at, user_id: oauthRow.user_id, display_name: oauthRow.display_name };
    }
  }

  // Path 3: JWT session tokens (from A2A connect handshake)
  if (!row) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded.sub) {
        const jwtUser = msDb.prepare("SELECT id AS user_id, name AS display_name FROM users WHERE id = ?").get(decoded.sub) as any;
        if (jwtUser) {
          row = { key_id: "session-token", revoked_at: null, user_id: jwtUser.user_id, display_name: jwtUser.display_name };
        }
      }
    } catch { /* not a valid JWT */ }
  }

  if (!row) {
    reply.code(401).send({ error: "Invalid API key or token" });
    return;
  }

  if (row.revoked_at) {
    reply.code(401).send({ error: "Token has been revoked" });
    return;
  }

  // Resolve qdrant collection from brain's users table (auto-provision if new user)
  const brainDb = getDb();
  let brainUser = brainDb.prepare(
    "SELECT qdrant_collection FROM users WHERE user_id = ?"
  ).get(row.user_id) as BrainUserRow | undefined;

  if (!brainUser) {
    brainDb.prepare(
      "INSERT OR IGNORE INTO users (user_id, display_name, api_key, qdrant_collection) VALUES (?, ?, 'managed-by-mindspace', 'thought_space')"
    ).run(row.user_id, row.display_name);
    brainUser = { qdrant_collection: "thought_space" };
  }

  (request as any).user = {
    user_id: row.user_id,
    display_name: row.display_name,
    qdrant_collection: brainUser.qdrant_collection,
  };
}
