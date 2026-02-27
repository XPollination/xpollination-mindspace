/**
 * pm-status Layer 1 auto-gardening — QA test specification
 *
 * Task: gardener-v003-layer1-not-automated
 * Criteria: T1–T11 from approved design DNA
 *
 * Dev requirements for testability:
 *   1. Guard main(): if (require.main === module) { main().then(r => console.log(JSON.stringify(r, null, 2))); }
 *   2. Export: module.exports = { brainHealth, layer1Garden, main }
 *   3. Use process.env.BRAIN_URL || 'http://localhost:3200' as brain API base
 *   4. main() must RETURN the result object (not only console.log it)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'http';
import path from 'path';

// Prevent actual DB access — all project scans return empty arrays
vi.mock('child_process', () => ({
  execSync: vi.fn(() => JSON.stringify([])),
}));

const PM_STATUS_PATH = path.resolve(__dirname, 'pm-status.cjs');

// --- Test helpers ---

function makeSources(groups: Array<{ content: string; count: number; idPrefix?: string }>) {
  return groups.flatMap(({ content, count, idPrefix }) =>
    Array.from({ length: count }, (_, i) => ({
      thought_id: `${idPrefix || content.replace(/\W/g, '').slice(0, 15)}-${i}`,
      contributor: 'TEST',
      score: 0.95,
      content_preview: content,
      topic: 'test',
      thought_category: 'uncategorized',
      refined_by: null,
      superseded: false,
      quality_flags: [],
    }))
  );
}

function brainOk(sources: any[], highways: string[] = []) {
  return { result: { response: 'ok', sources, highways_nearby: highways } };
}

// --- Mock brain server ---

let serverMode: 'normal' | 'error500' | 'hang' = 'normal';
let mockResponseFn: (body: any) => any;
let requestBodies: any[];
let mockServer: http.Server;
let mockPort: number;

function resetMock() {
  serverMode = 'normal';
  requestBodies = [];
  mockResponseFn = () => brainOk([]);
}

function loadModule() {
  delete require.cache[PM_STATUS_PATH];
  process.env.BRAIN_URL = `http://localhost:${mockPort}`;
  return require(PM_STATUS_PATH);
}

describe('pm-status Layer 1 auto-gardening', () => {
  beforeAll(async () => {
    mockServer = http.createServer((req, res) => {
      if (serverMode === 'error500') {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      if (serverMode === 'hang') {
        // Never respond — triggers client timeout
        return;
      }
      let body = '';
      req.on('data', (chunk: string) => (body += chunk));
      req.on('end', () => {
        let parsed: any = {};
        try { parsed = JSON.parse(body); } catch {}
        requestBodies.push(parsed);
        const response = mockResponseFn(parsed);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      });
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        mockPort = (mockServer.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(() => {
    mockServer.close();
    delete process.env.BRAIN_URL;
  });

  beforeEach(() => {
    resetMock();
  });

  // ─── T1: layer1Garden function exists ───
  it('T1: exports layer1Garden function', () => {
    const mod = loadModule();
    expect(mod.layer1Garden).toBeDefined();
    expect(typeof mod.layer1Garden).toBe('function');
  });

  // ─── T2: brainHealth query includes full_content:true ───
  it('T2: brainHealth query includes full_content:true', async () => {
    const mod = loadModule();
    await mod.brainHealth();

    const healthQuery = requestBodies.find((r: any) => r.read_only === true);
    expect(healthQuery).toBeDefined();
    expect(healthQuery.full_content).toBe(true);
  });

  // ─── T3: Duplicate detection with threshold >= 3 ───
  describe('T3: duplicate detection', () => {
    it('detects groups with 3+ identical content_preview', async () => {
      const sources = [
        ...makeSources([{ content: 'duplicate thought A', count: 4 }]),
        ...makeSources([{ content: 'duplicate thought B', count: 3 }]),
        ...makeSources([{ content: 'unique thought C', count: 1 }]),
        ...makeSources([{ content: 'pair thought D', count: 2 }]),
      ];
      mockResponseFn = () => brainOk(sources);

      const mod = loadModule();
      const health = await mod.brainHealth();

      // A(4) + B(3) = 2 duplicate groups
      expect(health.duplicate_groups).toBe(2);
      expect(health.needs_gardening).toBe(true);
    });

    it('reports needs_gardening:false when no group reaches threshold', async () => {
      const sources = makeSources([
        { content: 'unique A', count: 1 },
        { content: 'pair B', count: 2 },
      ]);
      mockResponseFn = () => brainOk(sources);

      const mod = loadModule();
      const health = await mod.brainHealth();

      expect(health.duplicate_groups).toBe(0);
      expect(health.needs_gardening).toBe(false);
    });
  });

  // ─── T4: Consolidation POST shape ───
  it('T4: layer1Garden POSTs with consolidates:[ids] and thought_category:consolidation', async () => {
    const sources = makeSources([{ content: 'dup thought X', count: 4, idPrefix: 'dup' }]);
    mockResponseFn = () => brainOk([]);

    const mod = loadModule();
    await mod.layer1Garden(sources);

    const consolidations = requestBodies.filter((r: any) => r.consolidates);
    expect(consolidations.length).toBeGreaterThanOrEqual(1);

    for (const req of consolidations) {
      expect(Array.isArray(req.consolidates)).toBe(true);
      expect(req.consolidates.length).toBeGreaterThanOrEqual(3);
      expect(req.thought_category).toBe('consolidation');
      expect(req.agent_id).toBe('system');
      expect(req.agent_name).toBe('GARDENER');
    }
  });

  // ─── T5: Max 3 consolidations per invocation ───
  it('T5: layer1Garden processes at most 3 duplicate groups', async () => {
    const sources = [
      ...makeSources([{ content: 'group A', count: 5, idPrefix: 'a' }]),
      ...makeSources([{ content: 'group B', count: 4, idPrefix: 'b' }]),
      ...makeSources([{ content: 'group C', count: 3, idPrefix: 'c' }]),
      ...makeSources([{ content: 'group D', count: 6, idPrefix: 'd' }]),
      ...makeSources([{ content: 'group E', count: 3, idPrefix: 'e' }]),
    ];
    mockResponseFn = () => brainOk([]);

    const mod = loadModule();
    await mod.layer1Garden(sources);

    const consolidations = requestBodies.filter((r: any) => r.consolidates);
    expect(consolidations.length).toBeLessThanOrEqual(3);
  });

  // ─── T6: Resolves on brain error ───
  it('T6: layer1Garden resolves with status:skipped on brain error', async () => {
    serverMode = 'error500';
    const sources = makeSources([{ content: 'dup', count: 4 }]);

    const mod = loadModule();
    const result = await mod.layer1Garden(sources);

    expect(result).toBeDefined();
    expect(result.status).toBe('skipped');
  });

  // ─── T7: Resolves on timeout ───
  it('T7: layer1Garden resolves with status:skipped and reason:timeout on timeout', async () => {
    serverMode = 'hang';
    const sources = makeSources([{ content: 'dup', count: 4 }]);

    const mod = loadModule();
    const result = await mod.layer1Garden(sources);

    expect(result).toBeDefined();
    expect(result.status).toBe('skipped');
    expect(result.reason).toBe('timeout');
  }, 15000);

  // ─── T8: No gardening when not needed ───
  it('T8: main() does NOT call layer1Garden when needs_gardening is false', async () => {
    const uniqueSources = makeSources([
      { content: 'unique A', count: 1 },
      { content: 'unique B', count: 1 },
    ]);
    mockResponseFn = () => brainOk(uniqueSources);

    const mod = loadModule();
    const result = await mod.main();

    // No consolidation POSTs should exist
    const consolidations = requestBodies.filter((r: any) => r.consolidates);
    expect(consolidations.length).toBe(0);
  });

  // ─── T9: Output includes gardening field ───
  it('T9: output JSON includes gardening field when gardening runs', async () => {
    const sources = makeSources([{ content: 'dup thought', count: 4 }]);
    mockResponseFn = () => brainOk(sources);

    const mod = loadModule();
    const result = await mod.main();

    expect(result).toHaveProperty('gardening');
    expect(result.gardening).not.toBeNull();
    expect(result.gardening.status).toBe('ok');
    expect(typeof result.gardening.groups_found).toBe('number');
    expect(typeof result.gardening.consolidated).toBe('number');
  });

  it('T9b: gardening is null when brain health shows no issues', async () => {
    mockResponseFn = () => brainOk([]);

    const mod = loadModule();
    const result = await mod.main();

    expect(result).toHaveProperty('gardening');
    expect(result.gardening).toBeNull();
  });

  // ─── T10: Works when brain is down ───
  it('T10: pm-status works when brain is down — gardening is null', async () => {
    // Point at a port nothing listens on
    delete require.cache[PM_STATUS_PATH];
    process.env.BRAIN_URL = 'http://127.0.0.1:1';
    const mod = require(PM_STATUS_PATH);

    const result = await mod.main();

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('projects');
    expect(result).toHaveProperty('brain_health');
    expect(result.gardening).toBeNull();
  });

  // ─── T11: Existing output structure unchanged ───
  it('T11: projects output structure is backward compatible', async () => {
    mockResponseFn = () => brainOk([]);

    const mod = loadModule();
    const result = await mod.main();

    expect(result).toHaveProperty('timestamp');
    expect(typeof result.timestamp).toBe('string');
    expect(result).toHaveProperty('projects');
    expect(typeof result.projects).toBe('object');
    expect(result).toHaveProperty('brain_health');
    // brain_health still has original fields
    expect(result.brain_health).toHaveProperty('status');
    expect(result.brain_health).toHaveProperty('recent_thoughts');
    expect(result.brain_health).toHaveProperty('highways');
  });
});
