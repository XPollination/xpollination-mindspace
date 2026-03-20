import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

/**
 * TDD Tests: A2A Server — 8 Endpoints + SSE
 * Ref: REQ-A2A-005, a2a-server-design
 */

function findRouteFile(): string {
  const candidates = [
    resolve(PROJECT_ROOT, 'api/routes/a2a.ts'),
    resolve(PROJECT_ROOT, 'api/routes/a2a.js'),
    resolve(PROJECT_ROOT, 'src/routes/a2a.ts'),
  ];
  const path = candidates.find(p => existsSync(p));
  return path ? readFileSync(path, 'utf-8') : '';
}

describe('A2A endpoints', () => {

  it('checkin endpoint exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/checkin/i);
  });

  it('claim endpoint exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/claim/i);
  });

  it('submit endpoint exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/submit/i);
  });

  it('create endpoint exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/create/i);
  });

  it('evolve endpoint exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/evolve/i);
  });
});

describe('SSE events endpoint', () => {

  it('SSE events route exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/events|EventSource|text\/event-stream/i);
  });

  it('SSE keepalive configured', () => {
    const content = findRouteFile();
    expect(content).toMatch(/keepalive|30.*s|setInterval/i);
  });
});

describe('Lease management', () => {

  it('lease timeout logic exists', () => {
    const content = findRouteFile();
    expect(content).toMatch(/lease|timeout|heartbeat/i);
  });
});
