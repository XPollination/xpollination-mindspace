-- XPollination MCP Server Database Schema
-- SQLite database for frames, drafts, and workflow state

-- Frames: User-defined topic areas to monitor
CREATE TABLE IF NOT EXISTS frames (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    keywords TEXT NOT NULL,          -- JSON array of keywords
    sources TEXT NOT NULL,           -- JSON: {rss: [], google_trends: []}
    audience TEXT,
    tone TEXT,
    exclusions TEXT,                 -- JSON array of exclusion keywords
    status TEXT DEFAULT 'active',    -- active, paused, deleted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trends: Discovered trending topics
CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    frame_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,            -- RSS URL or 'google_trends'
    source_url TEXT,
    trend_score REAL,
    relevance_score REAL,
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'new',       -- new, proposed, used, dismissed
    FOREIGN KEY (frame_id) REFERENCES frames(id)
);

-- Drafts: Content in various stages
CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    frame_id TEXT NOT NULL,
    trend_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,           -- Markdown content
    angle TEXT,                      -- The specific angle/perspective
    user_framing TEXT,               -- User's additional context
    claims TEXT,                     -- JSON array of factual claims
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft',     -- draft, pending_verification, verified,
                                     -- approved, published, rejected
    metadata TEXT,                   -- JSON: tags, category, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (frame_id) REFERENCES frames(id),
    FOREIGN KEY (trend_id) REFERENCES trends(id)
);

-- Draft versions: Version history
CREATE TABLE IF NOT EXISTS draft_versions (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    content TEXT NOT NULL,
    changes TEXT,                    -- JSON: what changed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

-- Fact checks: Verification results
CREATE TABLE IF NOT EXISTS fact_checks (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    draft_version INTEGER NOT NULL,
    claims TEXT NOT NULL,            -- JSON array of claims
    results TEXT NOT NULL,           -- JSON: {claim, verdict, sources, confidence}
    overall_pass BOOLEAN,
    issues TEXT,                     -- JSON array of issues found
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

-- Workflow state: Current state of content pipeline
CREATE TABLE IF NOT EXISTS workflow_state (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    current_state TEXT NOT NULL,
    previous_state TEXT,
    iteration_count INTEGER DEFAULT 0,
    max_iterations INTEGER DEFAULT 3,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

-- Workflow history: Audit trail
CREATE TABLE IF NOT EXISTS workflow_history (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    trigger TEXT NOT NULL,           -- What caused transition
    metadata TEXT,                   -- JSON: additional context
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (workflow_id) REFERENCES workflow_state(id)
);

-- Published posts: Record of what's been published
CREATE TABLE IF NOT EXISTS published_posts (
    id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    commit_sha TEXT NOT NULL,
    post_url TEXT NOT NULL,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (draft_id) REFERENCES drafts(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_frames_status ON frames(status);
CREATE INDEX IF NOT EXISTS idx_trends_frame_status ON trends(frame_id, status);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_workflow_draft ON workflow_state(draft_id);
CREATE INDEX IF NOT EXISTS idx_workflow_state ON workflow_state(current_state);

-- ============================================
-- MINDSPACE PM TOOL TABLES
-- ============================================

-- Mindspace nodes: DAG nodes for project management
CREATE TABLE IF NOT EXISTS mindspace_nodes (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,              -- task, group, decision, requirement, design, test
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, ready, active, review, rework, complete, blocked, cancelled
    parent_ids TEXT,                 -- JSON array of parent node IDs (DAG structure)
    slug TEXT NOT NULL,              -- Human-readable identifier
    dna_json TEXT NOT NULL,          -- JSON: node DNA (title, description, acceptance_criteria, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for mindspace queries
CREATE INDEX IF NOT EXISTS idx_mindspace_type ON mindspace_nodes(type);
CREATE INDEX IF NOT EXISTS idx_mindspace_status ON mindspace_nodes(status);
CREATE INDEX IF NOT EXISTS idx_mindspace_slug ON mindspace_nodes(slug);

-- ============================================
-- SYSTEM SETTINGS
-- ============================================

-- Global persistent settings (e.g., LIAISON approval mode)
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default: LIAISON approval mode = manual (safe default)
INSERT OR IGNORE INTO system_settings (key, value, updated_by) VALUES ('liaison_approval_mode', 'manual', 'system');
