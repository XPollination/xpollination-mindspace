import type { Twin } from '../twin/types.js';

export interface QueryFilter {
  kind?: string;
  schema?: string;
  owner?: string;
  tags?: string[];
  state?: string;
  limit?: number;
}

export interface StorageAdapter {
  dock(twin: Twin): Promise<void>;
  resolve(cid: string): Promise<Twin | null>;
  query(filter: QueryFilter): Promise<Twin[]>;
  heads(logicalId: string): Promise<string[]>;
  history(cid: string): Promise<Twin[]>;
  undock(cid: string): Promise<void>;
  forget(cid: string): Promise<void>;
}
