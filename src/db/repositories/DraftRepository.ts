/**
 * Draft Repository
 *
 * Data access layer for content drafts.
 */

import type { Database } from 'better-sqlite3';

export interface DraftRecord {
  id: string;
  frame_id: string;
  trend_id?: string;
  title: string;
  content: string;
  angle?: string;
  user_framing?: string;
  claims: string;        // JSON string
  version: number;
  status: string;
  metadata: string;      // JSON string
  created_at?: string;
  updated_at?: string;
}

export interface CreateDraftInput {
  id: string;
  frameId: string;
  trendId?: string;
  title: string;
  content: string;
  angle?: string | null;
  userFraming?: string | null;
  claims: string;
  version: number;
  status: string;
  metadata?: string;
}

export class DraftRepository {
  constructor(private db: Database) {}

  /**
   * Create a new draft
   */
  async create(draft: CreateDraftInput): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO drafts (id, frame_id, trend_id, title, content, angle, user_framing, claims, version, status, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      draft.id,
      draft.frameId,
      draft.trendId || null,
      draft.title,
      draft.content,
      draft.angle || null,
      draft.userFraming || null,
      draft.claims,
      draft.version,
      draft.status,
      draft.metadata || '{}'
    );

    return draft.id;
  }

  /**
   * Find a draft by ID
   */
  async findById(id: string): Promise<DraftRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM drafts WHERE id = ?');
    const result = stmt.get(id) as DraftRecord | undefined;
    return result || null;
  }

  /**
   * Find drafts by status
   */
  async findByStatus(status: string): Promise<DraftRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM drafts WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status) as DraftRecord[];
  }

  /**
   * Find drafts by frame
   */
  async findByFrame(frameId: string): Promise<DraftRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM drafts WHERE frame_id = ? ORDER BY created_at DESC');
    return stmt.all(frameId) as DraftRecord[];
  }

  /**
   * Update a draft
   */
  async update(id: string, data: Partial<{
    title: string;
    content: string;
    angle: string;
    userFraming: string;
    claims: string;
    version: number;
    status: string;
    metadata: string;
  }>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.content !== undefined) {
      fields.push('content = ?');
      values.push(data.content);
    }
    if (data.angle !== undefined) {
      fields.push('angle = ?');
      values.push(data.angle);
    }
    if (data.userFraming !== undefined) {
      fields.push('user_framing = ?');
      values.push(data.userFraming);
    }
    if (data.claims !== undefined) {
      fields.push('claims = ?');
      values.push(data.claims);
    }
    if (data.version !== undefined) {
      fields.push('version = ?');
      values.push(data.version);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.metadata !== undefined) {
      fields.push('metadata = ?');
      values.push(data.metadata);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE drafts SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Delete a draft
   */
  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM drafts WHERE id = ?');
    stmt.run(id);
  }
}
