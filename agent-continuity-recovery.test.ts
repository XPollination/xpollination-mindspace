/**
 * TDD tests for agent-continuity-recovery (v0.0.3 — Full Hive Stack)
 *
 * Agent identity, working memory, recovery endpoint, onboarding page,
 * DNS/HTTPS infrastructure, per-agent API keys, rate limiting.
 *
 * Brain API Schema (source-level):
 * AC-DB1: agent_state table in database.ts
 * AC-DB2: agent_identity table in database.ts with seed data for 4 agents
 *
 * Brain API Routes (source-level):
 * AC-ROUTE1: recovery.ts route file exists
 * AC-ROUTE2: working-memory.ts route file exists
 * AC-ROUTE3: onboarding.ts route file exists
 * AC-ROUTE4: Routes registered in index.ts
 *
 * Brain API Types (source-level):
 * AC-TYPE1: AgentState interface exists
 * AC-TYPE2: AgentIdentity interface exists
 * AC-TYPE3: RecoveryResponse interface exists
 *
 * ThoughtSpace Extension:
 * AC-TS1: getRecentByContributor method in thoughtspace.ts
 *
 * Auth Exemption:
 * AC-AUTH1: GET / (onboarding) exempt from auth in auth.ts
 *
 * Recovery Endpoint Response:
 * AC-REC1: Recovery route returns identity, working_state, key_context fields
 * AC-REC2: Recovery route returns 404 for nonexistent agent
 * AC-REC3: Recovery route includes stale flag and age_minutes
 *
 * Working Memory Endpoint:
 * AC-WM1: Working memory route accepts POST with state JSON
 * AC-WM2: 64KB body size limit enforced
 *
 * Onboarding Page:
 * AC-ONB1: Onboarding page returns HTML with XPollination branding
 * AC-ONB2: Logo assets exist (webp + png)
 *
 * Self-Test Protocol:
 * AC-SELF1: agent_identity recovery_protocol includes self-test step
 *
 * TTL Cleanup:
 * AC-TTL1: TTL cleanup SQL in decay job or database.ts
 *
 * Config (BRAIN_API_URL):
 * AC-CFG1: BRAIN_API_URL env var in monitor skill
 * AC-CFG2: BRAIN_API_URL in hook scripts
 * AC-CFG3: BRAIN_PUBLIC_URL in docker-compose.yml
 *
 * Infrastructure (post-execution):
 * AC-DNS1: hive.xpollination.earth resolves to Hetzner IP
 * AC-DNS2: mindspace.xpollination.earth resolves to Hetzner IP
 * AC-TLS1: HTTPS works for hive.xpollination.earth
 * AC-TLS2: HTTP redirects to HTTPS for hive.xpollination.earth
 * AC-KEY1: Per-agent API keys exist in users table (4 agent-* rows)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '.');
const BRAIN_SRC = path.join(PROJECT_ROOT, 'brain/src');

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Brain API Schema ───

describe('AC-DB1: agent_state table in database.ts', () => {
  it('should define agent_state table with required columns', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    expect(content).toContain('agent_state');
    expect(content).toContain('agent_id TEXT PRIMARY KEY');
    expect(content).toContain('state_json TEXT');
    expect(content).toContain('ttl_hours');
  });

  it('should have index on updated_at for TTL cleanup', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    expect(content).toContain('idx_agent_state_updated');
  });
});

describe('AC-DB2: agent_identity table with seed data', () => {
  it('should define agent_identity table with required columns', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    expect(content).toContain('agent_identity');
    expect(content).toContain('role TEXT NOT NULL');
    expect(content).toContain('display_name TEXT NOT NULL');
    expect(content).toContain('responsibilities TEXT NOT NULL');
    expect(content).toContain('recovery_protocol TEXT NOT NULL');
  });

  it('should seed data for all 4 agent roles', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    expect(content).toContain('agent-liaison');
    expect(content).toContain('agent-pdsa');
    expect(content).toContain('agent-dev');
    expect(content).toContain('agent-qa');
  });
});

// ─── Brain API Routes ───

describe('AC-ROUTE1: recovery.ts route file exists', () => {
  it('brain/src/routes/recovery.ts should exist', () => {
    expect(fileExists(path.join(BRAIN_SRC, 'routes/recovery.ts'))).toBe(true);
  });

  it('should export a route plugin function', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/recovery.ts'));
    // Fastify route registration pattern
    expect(content).toMatch(/export\s+(async\s+)?function|export\s+const/);
    expect(content).toContain('/api/v1/recovery');
  });
});

describe('AC-ROUTE2: working-memory.ts route file exists', () => {
  it('brain/src/routes/working-memory.ts should exist', () => {
    expect(fileExists(path.join(BRAIN_SRC, 'routes/working-memory.ts'))).toBe(true);
  });

  it('should export a route plugin function', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/working-memory.ts'));
    expect(content).toMatch(/export\s+(async\s+)?function|export\s+const/);
    expect(content).toContain('/api/v1/working-memory');
  });
});

describe('AC-ROUTE3: onboarding.ts route file exists', () => {
  it('brain/src/routes/onboarding.ts should exist', () => {
    expect(fileExists(path.join(BRAIN_SRC, 'routes/onboarding.ts'))).toBe(true);
  });

  it('should serve HTML content', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/onboarding.ts'));
    expect(content).toContain('text/html');
    expect(content).toContain('XPollination');
  });
});

describe('AC-ROUTE4: Routes registered in index.ts', () => {
  it('index.ts should import and register recovery routes', () => {
    const content = readFile(path.join(BRAIN_SRC, 'index.ts'));
    expect(content).toContain('recovery');
  });

  it('index.ts should import and register working-memory routes', () => {
    const content = readFile(path.join(BRAIN_SRC, 'index.ts'));
    expect(content).toContain('working-memory');
  });

  it('index.ts should import and register onboarding routes', () => {
    const content = readFile(path.join(BRAIN_SRC, 'index.ts'));
    expect(content).toContain('onboarding');
  });
});

// ─── Brain API Types ───

describe('AC-TYPE1: AgentState interface exists', () => {
  it('types/index.ts should define AgentState', () => {
    const content = readFile(path.join(BRAIN_SRC, 'types/index.ts'));
    expect(content).toContain('AgentState');
    expect(content).toContain('agent_id');
    expect(content).toContain('state_json');
  });
});

describe('AC-TYPE2: AgentIdentity interface exists', () => {
  it('types/index.ts should define AgentIdentity', () => {
    const content = readFile(path.join(BRAIN_SRC, 'types/index.ts'));
    expect(content).toContain('AgentIdentity');
    expect(content).toContain('role');
    expect(content).toContain('responsibilities');
    expect(content).toContain('recovery_protocol');
  });
});

describe('AC-TYPE3: RecoveryResponse interface exists', () => {
  it('types/index.ts should define RecoveryResponse', () => {
    const content = readFile(path.join(BRAIN_SRC, 'types/index.ts'));
    expect(content).toContain('RecoveryResponse');
    expect(content).toContain('identity');
    expect(content).toContain('working_state');
    expect(content).toContain('key_context');
  });
});

// ─── ThoughtSpace Extension ───

describe('AC-TS1: getRecentByContributor in thoughtspace.ts', () => {
  it('should have a method for retrieving recent thoughts by contributor', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/thoughtspace.ts'));
    expect(content).toContain('getRecentByContributor');
  });
});

// ─── Auth Exemption ───

describe('AC-AUTH1: GET / exempt from auth', () => {
  it('auth.ts should exempt root path from authentication', () => {
    const content = readFile(path.join(BRAIN_SRC, 'middleware/auth.ts'));
    // Should have a check for root URL "/" or onboarding path
    const exemptionLines = content.split('\n').filter(l =>
      !l.trim().startsWith('//') &&
      (l.includes('request.url === "/"') ||
       l.includes("request.url === '/'") ||
       l.includes('onboarding') ||
       (l.includes('/') && l.includes('exempt')))
    );
    // The existing health exemption pattern should be extended to include "/"
    expect(exemptionLines.length).toBeGreaterThan(0);
  });
});

// ─── Recovery Endpoint Response ───

describe('AC-REC1: Recovery route returns identity, working_state, key_context', () => {
  it('recovery.ts should construct response with all required fields', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/recovery.ts'));
    expect(content).toContain('identity');
    expect(content).toContain('working_state');
    expect(content).toContain('key_context');
    expect(content).toContain('degraded');
    expect(content).toContain('recovered_at');
  });
});

describe('AC-REC2: Recovery returns 404 for nonexistent agent', () => {
  it('recovery.ts should return 404 when agent_id not found', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/recovery.ts'));
    expect(content).toContain('404');
  });
});

describe('AC-REC3: Recovery includes stale flag and age_minutes', () => {
  it('recovery.ts should compute staleness from state age', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/recovery.ts'));
    expect(content).toContain('age_minutes');
    expect(content).toContain('stale');
  });
});

// ─── Working Memory Endpoint ───

describe('AC-WM1: Working memory route accepts POST with state JSON', () => {
  it('working-memory.ts should INSERT OR REPLACE into agent_state', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/working-memory.ts'));
    expect(content).toMatch(/INSERT\s+OR\s+REPLACE|UPSERT|INSERT.*ON\s+CONFLICT/i);
    expect(content).toContain('agent_state');
  });
});

describe('AC-WM2: 64KB body size limit', () => {
  it('working-memory.ts should enforce body size limit', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/working-memory.ts'));
    // Should check content length or have body limit config
    const hasLimit = content.includes('64') ||
                     content.includes('65536') ||
                     content.includes('bodyLimit') ||
                     content.includes('content-length');
    expect(hasLimit).toBe(true);
  });
});

// ─── Onboarding Page ───

describe('AC-ONB1: Onboarding page has XPollination branding', () => {
  it('onboarding route should include XPollination Hive title', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/onboarding.ts'));
    expect(content).toContain('XPollination Hive');
  });

  it('onboarding route should reference logo asset', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/onboarding.ts'));
    expect(content).toContain('xpollination-logo');
  });

  it('onboarding route should document API endpoints', () => {
    const content = readFile(path.join(BRAIN_SRC, 'routes/onboarding.ts'));
    expect(content).toContain('/api/v1/recovery');
    expect(content).toContain('/api/v1/working-memory');
    expect(content).toContain('/api/v1/memory');
  });
});

describe('AC-ONB2: Logo assets exist', () => {
  it('WebP logo should exist at brain/public/assets/', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'brain/public/assets/xpollination-logo-256.webp'))).toBe(true);
  });

  it('PNG fallback logo should exist at brain/public/assets/', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'brain/public/assets/xpollination-logo-256.png'))).toBe(true);
  });
});

// ─── Self-Test Protocol ───

describe('AC-SELF1: recovery_protocol includes self-test step', () => {
  it('seed data should include self-test instructions in recovery_protocol', () => {
    const content = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    // The recovery_protocol seed data should mention self-test
    expect(content).toMatch(/self.?test|Self.?Test|SELF.?TEST/i);
    expect(content).toContain('Is this correct');
  });
});

// ─── TTL Cleanup ───

describe('AC-TTL1: TTL cleanup SQL exists', () => {
  it('should have TTL-based deletion of expired agent_state rows', () => {
    // Check both database.ts and thoughtspace.ts (decay job is in thoughtspace)
    const dbContent = readFile(path.join(BRAIN_SRC, 'services/database.ts'));
    const tsContent = readFile(path.join(BRAIN_SRC, 'services/thoughtspace.ts'));
    const combined = dbContent + tsContent;

    const hasTtlCleanup = combined.includes('DELETE FROM agent_state') &&
                           combined.includes('ttl_hours');
    expect(hasTtlCleanup).toBe(true);
  });
});

// ─── Config (BRAIN_API_URL) ───

describe('AC-CFG1: BRAIN_API_URL in monitor skill', () => {
  it('monitor skill should use BRAIN_API_URL env var', () => {
    const skillPath = path.join(PROJECT_ROOT, '.claude/skills/xpo.claude.monitor/SKILL.md');
    if (!fileExists(skillPath)) {
      // Skill may be a symlink to best-practices, check alternate location
      expect(fileExists(skillPath)).toBe(true);
    }
    const content = readFile(skillPath);
    expect(content).toContain('BRAIN_API_URL');
  });
});

describe('AC-CFG2: BRAIN_API_URL in hook scripts', () => {
  const hooks = [
    'scripts/hooks/xpo.claude.brain-first-hook.sh',
    'scripts/hooks/xpo.claude.brain-writeback-hook.sh',
    'scripts/hooks/xpo.claude.compact-recover.sh',
  ];

  for (const hook of hooks) {
    it(`${hook} should use BRAIN_API_URL env var`, () => {
      const hookPath = path.join(PROJECT_ROOT, hook);
      if (!fileExists(hookPath)) {
        expect(fileExists(hookPath)).toBe(true);
        return;
      }
      const content = readFile(hookPath);
      expect(content).toContain('BRAIN_API_URL');
    });
  }
});

describe('AC-CFG3: BRAIN_PUBLIC_URL in docker-compose.yml', () => {
  it('docker-compose.yml should have BRAIN_PUBLIC_URL for brain service', () => {
    const composePath = path.join(PROJECT_ROOT, 'docker-compose.yml');
    const content = readFile(composePath);
    expect(content).toContain('BRAIN_PUBLIC_URL');
    expect(content).toContain('hive.xpollination.earth');
  });
});

// ─── Infrastructure (post-execution verification) ───

describe('AC-DNS1: hive.xpollination.earth resolves', () => {
  it('should resolve to Hetzner IP', () => {
    try {
      const result = execSync('dig +short hive.xpollination.earth A 2>&1', {
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();
      // Should resolve to the Hetzner public IP
      expect(result).toMatch(/\d+\.\d+\.\d+\.\d+/);
    } catch {
      expect(false).toBe(true); // DNS resolution failed
    }
  });
});

describe('AC-DNS2: mindspace.xpollination.earth resolves', () => {
  it('should resolve to Hetzner IP', () => {
    try {
      const result = execSync('dig +short mindspace.xpollination.earth A 2>&1', {
        encoding: 'utf-8',
        timeout: 10000,
      }).trim();
      expect(result).toMatch(/\d+\.\d+\.\d+\.\d+/);
    } catch {
      expect(false).toBe(true); // DNS resolution failed
    }
  });
});

describe('AC-TLS1: HTTPS works for hive.xpollination.earth', () => {
  it('should return 200 with valid TLS', () => {
    try {
      const result = execSync(
        'curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://hive.xpollination.earth/api/v1/health 2>&1',
        { encoding: 'utf-8', timeout: 15000 }
      ).trim();
      expect(result).toBe('200');
    } catch {
      expect(false).toBe(true); // HTTPS request failed
    }
  });
});

describe('AC-TLS2: HTTP redirects to HTTPS', () => {
  it('should return 301 redirect', () => {
    try {
      const result = execSync(
        'curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://hive.xpollination.earth/ 2>&1',
        { encoding: 'utf-8', timeout: 15000 }
      ).trim();
      expect(result).toBe('301');
    } catch {
      expect(false).toBe(true); // HTTP request failed
    }
  });
});

describe('AC-KEY1: Per-agent API keys in users table', () => {
  it('should have 4 agent-* rows in users table', () => {
    // This queries the live brain DB — will only pass after DEV inserts keys
    try {
      const result = execSync(
        "sqlite3 brain/data/thought-tracing.db \"SELECT COUNT(*) FROM users WHERE user_id LIKE 'agent-%'\" 2>&1",
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();
      expect(parseInt(result)).toBe(4);
    } catch {
      // DB may not exist locally in test environment
      expect(false).toBe(true);
    }
  });
});
