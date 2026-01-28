/**
 * Database Client
 *
 * Initializes SQLite database and provides repository instances.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DatabaseContext {
  db: Database.Database;
  frameRepo: FrameRepository;
  draftRepo: DraftRepository;
  trendRepo: TrendRepository;
  workflowRepo: WorkflowRepository;
}

// Placeholder repository interfaces
// TODO: Implement these in db/repositories/
export interface FrameRepository {
  create(frame: unknown): Promise<string>;
  findById(id: string): Promise<unknown>;
  findActive(): Promise<unknown[]>;
  update(id: string, data: unknown): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface DraftRepository {
  create(draft: unknown): Promise<string>;
  findById(id: string): Promise<unknown>;
  findByStatus(status: string): Promise<unknown[]>;
  update(id: string, data: unknown): Promise<void>;
}

export interface TrendRepository {
  create(trend: unknown): Promise<string>;
  findByFrame(frameId: string): Promise<unknown[]>;
  update(id: string, data: unknown): Promise<void>;
}

export interface WorkflowRepository {
  create(workflow: unknown): Promise<string>;
  findByDraft(draftId: string): Promise<unknown>;
  updateState(id: string, state: string, previousState: string, trigger: string): Promise<void>;
  incrementIteration(id: string): Promise<void>;
}

/**
 * Initialize the database and return context with repositories
 */
export async function initDatabase(): Promise<DatabaseContext> {
  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/xpollination.db');

  // Create database connection
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Run schema if tables don't exist
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Create repository instances
  // TODO: Implement actual repository classes
  const frameRepo: FrameRepository = {
    create: async () => 'not-implemented',
    findById: async () => null,
    findActive: async () => [],
    update: async () => {},
    delete: async () => {}
  };

  const draftRepo: DraftRepository = {
    create: async () => 'not-implemented',
    findById: async () => null,
    findByStatus: async () => [],
    update: async () => {}
  };

  const trendRepo: TrendRepository = {
    create: async () => 'not-implemented',
    findByFrame: async () => [],
    update: async () => {}
  };

  const workflowRepo: WorkflowRepository = {
    create: async () => 'not-implemented',
    findByDraft: async () => null,
    updateState: async () => {},
    incrementIteration: async () => {}
  };

  return {
    db,
    frameRepo,
    draftRepo,
    trendRepo,
    workflowRepo
  };
}
