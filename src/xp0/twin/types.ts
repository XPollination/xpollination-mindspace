export type TwinKind = 'object' | 'relation' | 'schema' | 'principal';

export interface BaseTwin {
  cid: string;
  kind: TwinKind;
  schema: string;
  owner: string;
  content: Record<string, unknown>;
  previousVersion: string | null;
  signature: string | null;
  version: number;
  state: string;
  tags: string[];
  createdAt: string;
  mergedFrom?: string[];
  delegatedBy?: string;
}

export interface UnsignedTwin extends BaseTwin {
  signature: null;
}

export interface SignedTwin extends BaseTwin {
  signature: string;
}

export type Twin = UnsignedTwin | SignedTwin;
