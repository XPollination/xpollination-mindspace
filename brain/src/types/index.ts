export interface QueryRequest {
  query: string;
  domain?: string;
  intent?: string;
  language?: string;
}

export interface IngestRequest {
  content: string;
  metadata?: {
    domain?: string;
    source?: string;
  };
}

export interface SearchResult {
  id: string;
  score: number;
  content: string;
  metadata: Record<string, unknown>;
}

export interface HealthResponse {
  status: "ok" | "error";
  qdrant: boolean;
  collections: Record<string, number>;
}
