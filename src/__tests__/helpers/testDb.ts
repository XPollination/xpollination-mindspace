/**
 * Test Database Helper
 *
 * Creates an in-memory SQLite database for testing.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { FrameRepository } from '../../db/repositories/FrameRepository.js';
import { DraftRepository } from '../../db/repositories/DraftRepository.js';
import type { DatabaseContext } from '../../db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Create an in-memory test database
 */
export function createTestDb(): DatabaseContext {
  // Create in-memory database
  const db = new Database(':memory:');

  // Load schema
  const schemaPath = join(__dirname, '../../db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  db.exec(schema);

  // Create repositories
  const frameRepo = new FrameRepository(db);
  const draftRepo = new DraftRepository(db);

  // Stub repositories for trends and workflow
  const trendRepo = {
    create: async () => 'test-trend-id',
    findByFrame: async () => [],
    update: async () => {}
  };

  const workflowRepo = {
    create: async () => 'test-workflow-id',
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

/**
 * Close and clean up test database
 */
export function closeTestDb(ctx: DatabaseContext): void {
  ctx.db.close();
}

// Counter for unique test IDs
let testIdCounter = 0;

/**
 * Create a test frame
 */
export async function createTestFrame(
  repo: FrameRepository,
  overrides: Partial<{
    id: string;
    name: string;
    description: string;
    keywords: string[];
    sources: { rss?: string[] };
    audience: string;
    tone: string;
    exclusions: string[];
    status: string;
  }> = {}
): Promise<string> {
  const frame = {
    id: overrides.id || `test-frame-${Date.now()}-${++testIdCounter}`,
    name: overrides.name || 'Test Frame',
    description: overrides.description || 'A test frame for unit tests',
    keywords: JSON.stringify(overrides.keywords || ['test', 'keyword']),
    sources: JSON.stringify(overrides.sources || { rss: [] }),
    audience: overrides.audience || 'test audience',
    tone: overrides.tone || 'neutral',
    exclusions: JSON.stringify(overrides.exclusions || []),
    status: overrides.status || 'active'
  };

  return repo.create(frame);
}

/**
 * Create a test draft
 */
export async function createTestDraft(
  repo: DraftRepository,
  frameId: string,
  overrides: Partial<{
    id: string;
    title: string;
    content: string;
    angle: string;
    claims: { text: string; needsVerification: boolean }[];
    status: string;
    version: number;
  }> = {}
): Promise<string> {
  const draft = {
    id: overrides.id || `test-draft-${Date.now()}-${++testIdCounter}`,
    frameId,
    title: overrides.title || 'Test Draft',
    content: overrides.content || '# Test\n\nThis is test content.',
    angle: overrides.angle || null,
    userFraming: null,
    claims: JSON.stringify(overrides.claims || []),
    version: overrides.version || 1,
    status: overrides.status || 'draft',
    metadata: '{}'
  };

  return repo.create(draft);
}
