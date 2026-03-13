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

export interface AgentState {
  agent_id: string;
  state_json: Record<string, unknown>;
  updated_at: string;
  session_id: string | null;
  ttl_hours: number;
  age_minutes: number;
  stale: boolean;
}

export interface AgentIdentity {
  agent_id: string;
  role: string;
  display_name: string;
  responsibilities: string;
  recovery_protocol: string;
  platform_hints: string | null;
}

export interface RecoveryResponse {
  identity: AgentIdentity;
  working_state: AgentState | null;
  key_context: Array<{
    thought_id: string;
    content: string;
    category: string;
    topic: string | null;
    score: number;
  }>;
  recent_transitions: string[];
  degraded: boolean;
  recovered_at: string;
}
