import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';

export interface PermissionResolver {
  check(who: string, twinCid: string, right: 'read' | 'write'): Promise<{ allowed: boolean; reason?: string }>;
  getRelations(source?: string, target?: string, relationType?: string): Promise<Twin[]>;
}

export class RelationPermissionResolver implements PermissionResolver {
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  async check(who: string, twinCid: string, right: 'read' | 'write'): Promise<{ allowed: boolean; reason?: string }> {
    const relations = await this.getRelations(who, twinCid, 'executes');
    if (relations.length > 0) return { allowed: true };
    // Check ownership
    const twin = await this.storage.resolve(twinCid);
    if (twin && twin.owner === who) return { allowed: true };
    return { allowed: false, reason: `No 'executes' relation from ${who} to ${twinCid}` };
  }

  async getRelations(source?: string, target?: string, relationType?: string): Promise<Twin[]> {
    const all = await this.storage.query({ kind: 'relation' });
    return all.filter((t) => {
      const c = t.content as Record<string, unknown>;
      if (source && c.source !== source) return false;
      if (target && c.target !== target) return false;
      if (relationType && c.relationType !== relationType) return false;
      return true;
    });
  }
}

// Rate limit checking
export interface RateLimitPolicy {
  maxClaimsPerWindow: number;
  windowSeconds: number;
}

export async function checkRateLimit(
  runnerId: string,
  policy: RateLimitPolicy,
  storage: StorageAdapter,
): Promise<{ allowed: boolean; reason?: string }> {
  const cutoff = new Date(Date.now() - policy.windowSeconds * 1000).toISOString();
  const allTasks = await storage.query({ schema: 'xp0/task' });
  const recentClaims = allTasks.filter((t) => {
    const c = t.content as Record<string, unknown>;
    return c.claimed_by === runnerId && c.status === 'active' && (t.createdAt || '') >= cutoff;
  });
  if (recentClaims.length >= policy.maxClaimsPerWindow) {
    return { allowed: false, reason: `Rate limit: ${recentClaims.length}/${policy.maxClaimsPerWindow} claims in ${policy.windowSeconds}s window` };
  }
  return { allowed: true };
}
