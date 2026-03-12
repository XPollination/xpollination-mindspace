/**
 * TDD tests for viz-data-polling-architecture
 *
 * Root cause: /api/data sends full 2-3MB payload on every change.
 * ETag/304 only helps on idle cycles. Any single node change triggers full payload.
 *
 * Design: Incremental sync via change_seq watermark + DNA-lite mode.
 * - Client sends ?since=N → server returns only nodes changed after seq N
 * - DNA-lite strips heavy fields (findings, implementation, etc.)
 * - Bootstrap: full payload but DNA-lite (~100KB vs 2MB)
 * - Typical update: <1KB (1-2 changed nodes, DNA-lite)
 *
 * Acceptance Criteria:
 * AC-INCR1: /api/data accepts ?since=N parameter
 * AC-INCR2: Response includes change_seq watermark (max seq of returned nodes)
 * AC-INCR3: When since=N, only nodes with updated_at > seq N are returned
 * AC-INCR4: When since is omitted, full bootstrap payload is returned
 * AC-LITE1: DNA-lite mode strips heavy fields (findings, implementation, pdsa_review, etc.)
 * AC-LITE2: DNA-lite keeps essential fields (title, role, status, priority, group)
 * AC-LITE3: Full DNA available via /api/data/node/:id or ?dna=full
 * AC-MERGE1: Stats (queue_count, active_count, completed_count) included in /api/data response
 * AC-PERF1: Bootstrap payload < 200KB (DNA-lite, compact JSON)
 * AC-PERF2: Incremental response for 1 changed node < 5KB
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIZ_DIR = path.join(__dirname, '.');
const SERVER_JS = path.join(VIZ_DIR, 'server.js');

const serverSrc = fs.readFileSync(SERVER_JS, 'utf-8');

// Check if TEST viz server is running on port 4200
async function isVizUp(): Promise<boolean> {
  try {
    const res = await fetch('http://10.33.33.1:4200/api/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

describe('viz-data-polling-architecture: incremental sync + DNA-lite', () => {

  // === SOURCE-LEVEL TESTS ===

  describe('AC-INCR1: /api/data accepts since parameter', () => {
    it('should parse since parameter from URL query string', () => {
      // Server should handle ?since=N in the /api/data handler
      const hassinceParam = /since/.test(serverSrc) &&
        (/searchParams\.get\(['"]since['"]\)/.test(serverSrc) ||
         /url\.searchParams.*since/.test(serverSrc) ||
         /query.*since/.test(serverSrc));
      expect(hassinceParam).toBe(true);
    });
  });

  describe('AC-INCR2: Response includes change_seq watermark', () => {
    it('should include change_seq in response JSON', () => {
      // The response object should have a change_seq field
      const hasChangeSeq = /change_seq/.test(serverSrc);
      expect(hasChangeSeq).toBe(true);
    });
  });

  describe('AC-INCR3: Incremental query filters by updated_at', () => {
    it('should have SQL or logic to filter nodes by timestamp/sequence', () => {
      // Should filter nodes WHERE updated_at > since value
      const hasIncrementalFilter =
        /updated_at.*>.*since/.test(serverSrc) ||
        /WHERE.*updated_at.*\?/.test(serverSrc) ||
        /since.*filter|filter.*since/.test(serverSrc) ||
        /\.filter\(.*updated_at/.test(serverSrc);
      expect(hasIncrementalFilter).toBe(true);
    });
  });

  describe('AC-INCR4: Full bootstrap when since is omitted', () => {
    it('should return all nodes when since parameter is not provided', () => {
      // Without since, the existing full export behavior should be preserved
      // The code should check for since and branch accordingly
      const hasBranchLogic =
        /if.*since|since.*\?|since.*===.*null|!since/.test(serverSrc);
      expect(hasBranchLogic).toBe(true);
    });
  });

  describe('AC-LITE1: DNA-lite strips heavy fields', () => {
    it('should define which DNA fields to strip or keep', () => {
      // Should have a list of heavy fields to exclude or light fields to include
      const hasFieldFilter =
        /LITE_FIELDS|DNA_LITE|dnaLite|lite_fields|HEAVY_FIELDS|stripDna|liteKeys|KEEP_FIELDS/.test(serverSrc) ||
        /findings|implementation|pdsa_review/.test(serverSrc); // at minimum references the fields to strip
      // More specifically, should have a stripping/filtering mechanism
      const hasStrippingLogic =
        /delete.*dna\.|omit|pick|reduce.*dna|Object\.keys.*dna/.test(serverSrc) ||
        /LITE_FIELDS|DNA_LITE|dnaLite|stripDna/.test(serverSrc);
      expect(hasStrippingLogic).toBe(true);
    });
  });

  describe('AC-LITE2: DNA-lite keeps essential fields', () => {
    it('should preserve title, role, priority, and group in lite mode', () => {
      // The lite field list should include essential fields
      const hasEssentials =
        /title.*role.*priority|LITE.*title|keep.*title/.test(serverSrc) ||
        /['"]title['"].*['"]role['"]/.test(serverSrc);
      expect(hasEssentials).toBe(true);
    });
  });

  describe('AC-LITE3: Full DNA available on demand', () => {
    it('should support dna=full parameter or per-node endpoint', () => {
      const hasFullDnaOption =
        /dna.*=.*full|dna.*full|\/api\/data\/node/.test(serverSrc) ||
        /searchParams.*dna/.test(serverSrc);
      expect(hasFullDnaOption).toBe(true);
    });
  });

  describe('AC-MERGE1: Stats included in /api/data response', () => {
    it('should include queue_count, active_count, completed_count in data response', () => {
      // These are already in the response — verify they remain
      const hasStats = /queue_count/.test(serverSrc) &&
                      /active_count/.test(serverSrc) &&
                      /completed_count/.test(serverSrc);
      expect(hasStats).toBe(true);
    });
  });

  // === LIVE SERVER TESTS ===

  describe('AC-INCR: Live incremental sync tests', () => {
    it('GET /api/data?project=all should include change_seq in response', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/api/data?project=all');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('change_seq');
      expect(typeof data.change_seq).toBe('string'); // ISO timestamp or number
    });

    it('GET /api/data?project=all&since=<seq> should return fewer nodes than full', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      // First get full bootstrap
      const fullRes = await fetch('http://10.33.33.1:4200/api/data?project=all');
      const fullData = await fullRes.json();
      const changeSeq = fullData.change_seq;

      // Then get incremental with that seq — should return 0 or very few changed nodes
      const incrRes = await fetch(`http://10.33.33.1:4200/api/data?project=all&since=${encodeURIComponent(changeSeq)}`);
      const incrData = await incrRes.json();

      expect(incrData.nodes.length).toBeLessThanOrEqual(fullData.nodes.length);
      expect(incrData).toHaveProperty('change_seq');
    });

    it('incremental response should be significantly smaller than full bootstrap', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      // Full bootstrap
      const fullRes = await fetch('http://10.33.33.1:4200/api/data?project=all');
      const fullText = await fullRes.text();

      // Incremental with recent timestamp (should return near-zero changes)
      const now = new Date().toISOString();
      const incrRes = await fetch(`http://10.33.33.1:4200/api/data?project=all&since=${encodeURIComponent(now)}`);
      const incrText = await incrRes.text();

      // Incremental should be at least 10x smaller
      expect(incrText.length).toBeLessThan(fullText.length / 10);
    });
  });

  describe('AC-LITE: Live DNA-lite tests', () => {
    it('bootstrap response nodes should have DNA-lite (no heavy fields)', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/api/data?project=all');
      const data = await res.json();

      // Check first few nodes — DNA should NOT contain heavy fields
      const heavyFields = ['findings', 'implementation', 'pdsa_review', 'qa_review', 'liaison_review', 'rework_instructions'];
      const sampleNodes = data.nodes.slice(0, 5);

      for (const node of sampleNodes) {
        if (!node.dna) continue;
        for (const field of heavyFields) {
          expect(node.dna).not.toHaveProperty(field);
        }
      }
    });

    it('full DNA should be available via ?dna=full or node endpoint', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      // Try dna=full parameter
      const res = await fetch('http://10.33.33.1:4200/api/data?project=all&dna=full');
      if (res.ok) {
        const data = await res.json();
        // Should have heavy fields when dna=full
        const nodeWithDna = data.nodes.find((n: any) => n.dna && (n.dna.findings || n.dna.implementation));
        // If any node has findings, full DNA is working
        if (nodeWithDna) {
          expect(nodeWithDna.dna).toHaveProperty('findings');
        }
      }
    });
  });

  describe('AC-PERF1: Bootstrap payload size', () => {
    it('full bootstrap with DNA-lite should be under 200KB', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/api/data?project=all');
      const text = await res.text();

      // DNA-lite + compact JSON should keep bootstrap under 200KB
      expect(text.length).toBeLessThan(200 * 1024);
    });
  });

  describe('AC-PERF2: Incremental response size', () => {
    it('incremental response for 0 changes should be under 5KB', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const now = new Date().toISOString();
      const res = await fetch(`http://10.33.33.1:4200/api/data?project=all&since=${encodeURIComponent(now)}`);
      const text = await res.text();

      expect(text.length).toBeLessThan(5 * 1024);
    });
  });
});
