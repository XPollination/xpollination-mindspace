import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter, QueryFilter } from './types.js';

export class FileStorageAdapter implements StorageAdapter {
  private storeDir: string;

  constructor(storeDir: string) {
    this.storeDir = storeDir;
  }

  private filePath(cid: string): string {
    const prefix = cid.substring(0, 4);
    return join(this.storeDir, prefix, `${cid}.json`);
  }

  async dock(twin: Twin): Promise<void> {
    const dir = join(this.storeDir, twin.cid.substring(0, 4));
    await mkdir(dir, { recursive: true });
    await writeFile(this.filePath(twin.cid), JSON.stringify(twin, null, 2), 'utf-8');
  }

  async resolve(cid: string): Promise<Twin | null> {
    try {
      const content = await readFile(this.filePath(cid), 'utf-8');
      return JSON.parse(content) as Twin;
    } catch {
      return null;
    }
  }

  async query(filter: QueryFilter): Promise<Twin[]> {
    let results = await this.scanAll();

    if (filter.kind) results = results.filter((t) => t.kind === filter.kind);
    if (filter.schema) results = results.filter((t) => t.schema === filter.schema);
    if (filter.owner) results = results.filter((t) => t.owner === filter.owner);
    if (filter.state) results = results.filter((t) => t.state === filter.state);
    if (filter.tags && filter.tags.length > 0) {
      results = results.filter((t) => t.tags && filter.tags!.some((tag) => t.tags.includes(tag)));
    }
    if (filter.limit !== undefined) results = results.slice(0, filter.limit);

    return results;
  }

  async heads(logicalId: string): Promise<string[]> {
    const allTwins = await this.scanAll();
    const matching = allTwins.filter(
      (t) => (t.content as Record<string, unknown>).logicalId === logicalId,
    );
    if (matching.length === 0) return [];

    const superseded = new Set(matching.map((t) => t.previousVersion).filter(Boolean));
    return matching.filter((t) => !superseded.has(t.cid)).map((t) => t.cid);
  }

  async history(cid: string): Promise<Twin[]> {
    const chain: Twin[] = [];
    let current = await this.resolve(cid);
    while (current) {
      chain.push(current);
      if (current.previousVersion) {
        current = await this.resolve(current.previousVersion);
      } else {
        break;
      }
    }
    return chain;
  }

  async undock(cid: string): Promise<void> {
    try {
      await unlink(this.filePath(cid));
    } catch {
      // File doesn't exist — no-op
    }
  }

  async forget(cid: string): Promise<void> {
    const twin = await this.resolve(cid);
    if (!twin) return;
    const forgotten = { ...twin, content: {}, state: 'forgotten' };
    await writeFile(this.filePath(cid), JSON.stringify(forgotten, null, 2), 'utf-8');
  }

  private async scanAll(): Promise<Twin[]> {
    const twins: Twin[] = [];
    let prefixDirs: string[];
    try {
      prefixDirs = await readdir(this.storeDir);
    } catch {
      return twins;
    }
    for (const prefix of prefixDirs) {
      let files: string[];
      try {
        files = await readdir(join(this.storeDir, prefix));
      } catch {
        continue;
      }
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await readFile(join(this.storeDir, prefix, file), 'utf-8');
          twins.push(JSON.parse(raw) as Twin);
        } catch {
          continue;
        }
      }
    }
    return twins;
  }
}
