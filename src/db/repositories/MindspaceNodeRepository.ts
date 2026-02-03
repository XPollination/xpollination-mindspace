/**
 * Mindspace Node Repository
 *
 * Data access layer for PM tool DAG nodes.
 */

import type { Database } from 'better-sqlite3';
import { NodeType, NodeStatus, validateTransition } from '../../workflow/StateMachineValidator.js';
import { validateDna, NodeDna } from '../../workflow/mindspace/DnaValidator.js';
import { resolveLinks, NodeLookupFn, LinkResolutionResult } from '../../workflow/mindspace/DnaLinkResolver.js';

/**
 * Database record for mindspace_nodes table
 */
export interface MindspaceNodeRecord {
  id: string;
  type: NodeType;
  status: NodeStatus;
  parent_ids: string | null;  // JSON array
  slug: string;
  dna_json: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Input for creating a new node
 */
export interface CreateNodeInput {
  id: string;
  type: NodeType;
  slug: string;
  parent_ids?: string[];
  dna: NodeDna;
}

/**
 * Input for updating a node
 */
export interface UpdateNodeInput {
  status?: NodeStatus;
  parent_ids?: string[];
  slug?: string;
  dna?: NodeDna;
}

/**
 * Result of node operations
 */
export interface NodeOperationResult {
  success: boolean;
  error?: string;
  node?: MindspaceNodeRecord;
}

export class MindspaceNodeRepository {
  constructor(private db: Database) {}

  /**
   * Create a new node with DNA validation
   */
  async create(input: CreateNodeInput): Promise<NodeOperationResult> {
    // Validate DNA
    const dnaJson = JSON.stringify(input.dna);
    const dnaResult = validateDna(input.type, dnaJson);
    if (!dnaResult.valid) {
      return {
        success: false,
        error: `Invalid DNA: ${dnaResult.errors.join(', ')}`
      };
    }

    // Validate links if present
    const linkResult = await this.validateLinks(input.dna);
    if (!linkResult.valid) {
      return {
        success: false,
        error: `Invalid links: ${linkResult.errors.join(', ')}`
      };
    }

    const parentIds = input.parent_ids ? JSON.stringify(input.parent_ids) : null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO mindspace_nodes (id, type, status, parent_ids, slug, dna_json)
        VALUES (?, ?, 'pending', ?, ?, ?)
      `);

      stmt.run(
        input.id,
        input.type,
        parentIds,
        input.slug,
        dnaJson
      );

      const node = await this.findById(input.id);
      return { success: true, node: node! };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Find a node by ID
   */
  async findById(id: string): Promise<MindspaceNodeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM mindspace_nodes WHERE id = ?');
    const result = stmt.get(id) as MindspaceNodeRecord | undefined;
    return result || null;
  }

  /**
   * Find a node by slug
   */
  async findBySlug(slug: string): Promise<MindspaceNodeRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?');
    const result = stmt.get(slug) as MindspaceNodeRecord | undefined;
    return result || null;
  }

  /**
   * Find all nodes
   */
  async findAll(): Promise<MindspaceNodeRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM mindspace_nodes ORDER BY created_at DESC');
    return stmt.all() as MindspaceNodeRecord[];
  }

  /**
   * Find nodes by type
   */
  async findByType(type: NodeType): Promise<MindspaceNodeRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM mindspace_nodes WHERE type = ? ORDER BY created_at DESC');
    return stmt.all(type) as MindspaceNodeRecord[];
  }

  /**
   * Find nodes by status
   */
  async findByStatus(status: NodeStatus): Promise<MindspaceNodeRecord[]> {
    const stmt = this.db.prepare('SELECT * FROM mindspace_nodes WHERE status = ? ORDER BY created_at DESC');
    return stmt.all(status) as MindspaceNodeRecord[];
  }

  /**
   * Update a node with transition validation
   */
  async update(id: string, input: UpdateNodeInput, actor: string = 'system'): Promise<NodeOperationResult> {
    const existing = await this.findById(id);
    if (!existing) {
      return { success: false, error: `Node "${id}" not found` };
    }

    // Validate status transition if changing status
    if (input.status && input.status !== existing.status) {
      const transitionResult = validateTransition({
        nodeType: existing.type,
        fromStatus: existing.status,
        toStatus: input.status,
        actor: actor as any
      });

      if (!transitionResult.allowed) {
        return { success: false, error: transitionResult.reason };
      }
    }

    // Validate DNA if changing
    if (input.dna) {
      const dnaJson = JSON.stringify(input.dna);
      const dnaResult = validateDna(existing.type, dnaJson);
      if (!dnaResult.valid) {
        return {
          success: false,
          error: `Invalid DNA: ${dnaResult.errors.join(', ')}`
        };
      }

      // Validate links
      const linkResult = await this.validateLinks(input.dna);
      if (!linkResult.valid) {
        return {
          success: false,
          error: `Invalid links: ${linkResult.errors.join(', ')}`
        };
      }
    }

    // Build update query
    const fields: string[] = [];
    const values: unknown[] = [];

    if (input.status !== undefined) {
      fields.push('status = ?');
      values.push(input.status);
    }
    if (input.parent_ids !== undefined) {
      fields.push('parent_ids = ?');
      values.push(JSON.stringify(input.parent_ids));
    }
    if (input.slug !== undefined) {
      fields.push('slug = ?');
      values.push(input.slug);
    }
    if (input.dna !== undefined) {
      fields.push('dna_json = ?');
      values.push(JSON.stringify(input.dna));
    }

    if (fields.length === 0) {
      return { success: true, node: existing };
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      const stmt = this.db.prepare(`
        UPDATE mindspace_nodes SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);

      const node = await this.findById(id);
      return { success: true, node: node! };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Delete a node (hard delete)
   */
  async delete(id: string): Promise<NodeOperationResult> {
    const existing = await this.findById(id);
    if (!existing) {
      return { success: false, error: `Node "${id}" not found` };
    }

    try {
      const stmt = this.db.prepare('DELETE FROM mindspace_nodes WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * Transition a node to a new status
   */
  async transition(
    id: string,
    toStatus: NodeStatus,
    actor: string = 'system'
  ): Promise<NodeOperationResult> {
    return this.update(id, { status: toStatus }, actor);
  }

  /**
   * Get DNA as parsed object
   */
  getDna<T extends NodeDna>(node: MindspaceNodeRecord): T {
    return JSON.parse(node.dna_json) as T;
  }

  /**
   * Get parent IDs as array
   */
  getParentIds(node: MindspaceNodeRecord): string[] {
    if (!node.parent_ids) return [];
    return JSON.parse(node.parent_ids) as string[];
  }

  /**
   * Validate links in DNA
   */
  private async validateLinks(dna: NodeDna): Promise<LinkResolutionResult> {
    const lookup: NodeLookupFn = async (nodeId: string) => {
      const node = await this.findById(nodeId);
      if (!node) return null;
      return {
        id: node.id,
        type: node.type,
        status: node.status,
        slug: node.slug
      };
    };

    return resolveLinks(dna as unknown as Record<string, unknown>, lookup);
  }

  /**
   * Find children of a group node
   */
  async findChildren(groupId: string): Promise<MindspaceNodeRecord[]> {
    const group = await this.findById(groupId);
    if (!group || group.type !== 'group') return [];

    const dna = this.getDna(group);
    const children = (dna as any).children as string[] | undefined;
    if (!children || children.length === 0) return [];

    const nodes: MindspaceNodeRecord[] = [];
    for (const childId of children) {
      const child = await this.findById(childId);
      if (child) nodes.push(child);
    }
    return nodes;
  }

  /**
   * Get nodes with unresolved dependencies (blocked waiting on incomplete deps)
   */
  async findBlocked(): Promise<MindspaceNodeRecord[]> {
    return this.findByStatus('blocked');
  }

  /**
   * Get nodes ready for work
   */
  async findReady(): Promise<MindspaceNodeRecord[]> {
    return this.findByStatus('ready');
  }
}
