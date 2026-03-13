import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "../../data/thought-tracing.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { verbose: undefined });
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS query_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      query_text TEXT NOT NULL,
      context_text TEXT,
      query_vector BLOB,
      returned_ids TEXT NOT NULL DEFAULT '[]',
      session_id TEXT NOT NULL,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      result_count INTEGER NOT NULL DEFAULT 0,
      knowledge_space_id TEXT NOT NULL DEFAULT 'ks-default'
    );

    CREATE INDEX IF NOT EXISTS idx_query_log_agent ON query_log(agent_id);
    CREATE INDEX IF NOT EXISTS idx_query_log_session ON query_log(session_id);
    CREATE INDEX IF NOT EXISTS idx_query_log_timestamp ON query_log(timestamp);

    CREATE TABLE IF NOT EXISTS users (
      user_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      api_key TEXT NOT NULL UNIQUE,
      ssh_fingerprint TEXT,
      qdrant_collection TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      active INTEGER NOT NULL DEFAULT 1
    );

    INSERT OR IGNORE INTO users (user_id, display_name, api_key, qdrant_collection)
    VALUES ('thomas', 'Thomas Pichler', 'MUST_SET_VIA_PROVISION', 'thought_space');

    CREATE TABLE IF NOT EXISTS agent_state (
      agent_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      session_id TEXT,
      ttl_hours INTEGER DEFAULT 72
    );
    CREATE INDEX IF NOT EXISTS idx_agent_state_updated ON agent_state(updated_at);

    CREATE TABLE IF NOT EXISTS agent_identity (
      agent_id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      responsibilities TEXT NOT NULL,
      recovery_protocol TEXT NOT NULL,
      platform_hints TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO agent_identity (agent_id, role, display_name, responsibilities, recovery_protocol)
    VALUES
      ('agent-liaison', 'liaison', 'LIAISON',
       'Bridge between human and agents. Creates tasks with complete DNA. Executes human-decision transitions (approve, reject, reopen). Presents work for review. Never does agent work.',
       '## Recovery Protocol for LIAISON

Step 1: Call GET /api/v1/recovery/agent-liaison to receive identity and working state.
Step 2: Read your working_state to understand current task, step, and human expectations.
Step 3: Review key_context for recent transition markers and decisions.
Step 4: Self-Test (MANDATORY) — Present to the human:
"I recovered my context. Here is what I understand:
- My role: LIAISON — bridge between human and agents
- Current task: {working_state.task_slug}
- Current step: {working_state.step}
- You expect: {working_state.human_expectation}
- Pending: {working_state.pending_items}
Is this correct? Should I continue from here?"
Wait for human confirmation before proceeding.
If no working state exists, say: "I have no working state. What should I work on?"'),

      ('agent-pdsa', 'pdsa', 'PDSA',
       'Plans, researches, designs. Produces PDSA documents. Verifies dev implementation matches design. Never implements code.',
       '## Recovery Protocol for PDSA

Step 1: Call GET /api/v1/recovery/agent-pdsa to receive identity and working state.
Step 2: Read your working_state to understand current task, step, and human expectations.
Step 3: Review key_context for recent transition markers and decisions.
Step 4: Self-Test (MANDATORY) — Present to the human:
"I recovered my context. Here is what I understand:
- My role: PDSA — plans, researches, designs
- Current task: {working_state.task_slug}
- Current step: {working_state.step}
- You expect: {working_state.human_expectation}
- Pending: {working_state.pending_items}
Is this correct? Should I continue from here?"
Wait for human confirmation before proceeding.
If no working state exists, say: "I have no working state. What should I work on?"'),

      ('agent-dev', 'dev', 'DEV',
       'Implements what PDSA designed. Reads DNA, builds, submits for review. Never plans. Never changes tests. If tests fail, fix implementation or escalate via DNA.',
       '## Recovery Protocol for DEV

Step 1: Call GET /api/v1/recovery/agent-dev to receive identity and working state.
Step 2: Read your working_state to understand current task, step, and human expectations.
Step 3: Review key_context for recent transition markers and decisions.
Step 4: Self-Test (MANDATORY) — Present to the human:
"I recovered my context. Here is what I understand:
- My role: DEV — implements what PDSA designed
- Current task: {working_state.task_slug}
- Current step: {working_state.step}
- You expect: {working_state.human_expectation}
- Pending: {working_state.pending_items}
Is this correct? Should I continue from here?"
Wait for human confirmation before proceeding.
If no working state exists, say: "I have no working state. What should I work on?"'),

      ('agent-qa', 'qa', 'QA',
       'Writes tests from approved designs. Reviews dev implementations by running tests. Never fixes implementation code — write failing tests, let dev fix.',
       '## Recovery Protocol for QA

Step 1: Call GET /api/v1/recovery/agent-qa to receive identity and working state.
Step 2: Read your working_state to understand current task, step, and human expectations.
Step 3: Review key_context for recent transition markers and decisions.
Step 4: Self-Test (MANDATORY) — Present to the human:
"I recovered my context. Here is what I understand:
- My role: QA — writes tests, reviews implementations
- Current task: {working_state.task_slug}
- Current step: {working_state.step}
- You expect: {working_state.human_expectation}
- Pending: {working_state.pending_items}
Is this correct? Should I continue from here?"
Wait for human confirmation before proceeding.
If no working state exists, say: "I have no working state. What should I work on?"');
  `);
}

export interface QueryLogEntry {
  id: string;
  agent_id: string;
  query_text: string;
  context_text: string | null;
  query_vector: Buffer | null;
  returned_ids: string;
  session_id: string;
  timestamp: string;
  result_count: number;
  knowledge_space_id: string;
}

export function insertQueryLog(entry: QueryLogEntry): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO query_log (id, agent_id, query_text, context_text, query_vector, returned_ids, session_id, timestamp, result_count, knowledge_space_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    entry.id,
    entry.agent_id,
    entry.query_text,
    entry.context_text,
    entry.query_vector,
    entry.returned_ids,
    entry.session_id,
    entry.timestamp,
    entry.result_count,
    entry.knowledge_space_id
  );
}

export function getAgentQueryCount(agentId: string): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as cnt FROM query_log WHERE agent_id = ?").get(agentId) as { cnt: number };
  return row.cnt;
}

export function getRecentQueriesByAgent(agentId: string, limit: number = 5): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT query_text FROM query_log WHERE agent_id = ? AND query_text != '' ORDER BY timestamp DESC LIMIT ?"
  ).all(agentId, limit) as Array<{ query_text: string }>;
  return rows.map((r) => r.query_text);
}

export function getSessionReturnedIds(sessionId: string): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT returned_ids FROM query_log WHERE session_id = ? ORDER BY timestamp DESC").all(sessionId) as Array<{ returned_ids: string }>;
  const allIds: string[] = [];
  for (const row of rows) {
    try {
      const ids = JSON.parse(row.returned_ids) as string[];
      allIds.push(...ids);
    } catch { /* skip malformed */ }
  }
  return [...new Set(allIds)];
}

export function getAgentIdentity(agentId: string): AgentIdentityRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM agent_identity WHERE agent_id = ?").get(agentId) as AgentIdentityRow | undefined;
}

export function getAgentState(agentId: string): AgentStateRow | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM agent_state WHERE agent_id = ?").get(agentId) as AgentStateRow | undefined;
}

export function upsertAgentState(agentId: string, stateJson: string, sessionId: string | null, ttlHours: number = 72): void {
  const db = getDb();
  db.prepare(
    "INSERT OR REPLACE INTO agent_state (agent_id, state_json, updated_at, session_id, ttl_hours) VALUES (?, ?, datetime('now'), ?, ?)"
  ).run(agentId, stateJson, sessionId, ttlHours);
}

export function cleanupExpiredAgentState(): number {
  const db = getDb();
  const result = db.prepare(
    "DELETE FROM agent_state WHERE datetime(updated_at, '+' || ttl_hours || ' hours') < datetime('now')"
  ).run();
  return result.changes;
}

export interface AgentIdentityRow {
  agent_id: string;
  role: string;
  display_name: string;
  responsibilities: string;
  recovery_protocol: string;
  platform_hints: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentStateRow {
  agent_id: string;
  state_json: string;
  updated_at: string;
  session_id: string | null;
  ttl_hours: number;
}
