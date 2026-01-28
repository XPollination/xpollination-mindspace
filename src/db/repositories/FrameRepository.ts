/**
 * Frame Repository
 *
 * Data access layer for content frames.
 */

import type { Database } from 'better-sqlite3';

export interface FrameRecord {
  id: string;
  name: string;
  description: string;
  keywords: string;      // JSON string
  sources: string;       // JSON string
  audience: string;
  tone: string;
  exclusions: string;    // JSON string
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateFrameInput {
  id: string;
  name: string;
  description: string;
  keywords: string;
  sources: string;
  audience: string;
  tone: string;
  exclusions: string;
  status: string;
}

export class FrameRepository {
  constructor(private db: Database) {}

  /**
   * Create a new frame
   */
  async create(frame: CreateFrameInput): Promise<string> {
    const stmt = this.db.prepare(`
      INSERT INTO frames (id, name, description, keywords, sources, audience, tone, exclusions, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      frame.id,
      frame.name,
      frame.description,
      frame.keywords,
      frame.sources,
      frame.audience,
      frame.tone,
      frame.exclusions,
      frame.status
    );

    return frame.id;
  }

  /**
   * Find a frame by ID
   */
  async findById(id: string): Promise<FrameRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM frames WHERE id = ?');
    const result = stmt.get(id) as FrameRecord | undefined;
    return result || null;
  }

  /**
   * Find all active frames
   */
  async findActive(): Promise<FrameRecord[]> {
    const stmt = this.db.prepare("SELECT * FROM frames WHERE status = 'active' ORDER BY created_at DESC");
    return stmt.all() as FrameRecord[];
  }

  /**
   * Find all frames (including inactive)
   */
  async findAll(): Promise<FrameRecord[]> {
    const stmt = this.db.prepare("SELECT * FROM frames WHERE status != 'deleted' ORDER BY created_at DESC");
    return stmt.all() as FrameRecord[];
  }

  /**
   * Update a frame
   */
  async update(id: string, data: Partial<Omit<FrameRecord, 'id' | 'created_at'>>): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      values.push(data.description);
    }
    if (data.keywords !== undefined) {
      fields.push('keywords = ?');
      values.push(data.keywords);
    }
    if (data.sources !== undefined) {
      fields.push('sources = ?');
      values.push(data.sources);
    }
    if (data.audience !== undefined) {
      fields.push('audience = ?');
      values.push(data.audience);
    }
    if (data.tone !== undefined) {
      fields.push('tone = ?');
      values.push(data.tone);
    }
    if (data.exclusions !== undefined) {
      fields.push('exclusions = ?');
      values.push(data.exclusions);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE frames SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
  }

  /**
   * Soft delete a frame (set status to 'deleted')
   */
  async delete(id: string): Promise<void> {
    await this.update(id, { status: 'deleted' });
  }

  /**
   * Pause a frame (set status to 'paused')
   */
  async pause(id: string): Promise<void> {
    await this.update(id, { status: 'paused' });
  }

  /**
   * Activate a frame (set status to 'active')
   */
  async activate(id: string): Promise<void> {
    await this.update(id, { status: 'active' });
  }
}
