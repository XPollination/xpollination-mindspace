import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Docker DB Mount Removal Tests — ms-docker-remove-db-mount
 * Validates: no xpollination.db volume mount in docker-compose files.
 */

const BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test';

const COMPOSE_FILES = [
  resolve(BASE, 'docker-compose.prod.yml'),
  resolve(BASE, 'docker-compose.dev-standalone.yml'),
];

describe('Docker compose files have no DB mount', () => {

  for (const filePath of COMPOSE_FILES) {
    const fileName = filePath.split('/').pop();

    describe(fileName!, () => {

      it('file exists', () => {
        expect(existsSync(filePath)).toBe(true);
      });

      it('does NOT mount xpollination.db', () => {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          expect(content).not.toMatch(/xpollination\.db/);
        }
      });

      it('does NOT have read-only DB volume mount', () => {
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf-8');
          expect(content).not.toMatch(/data\/xpollination\.db.*:ro/);
        }
      });
    });
  }
});

// Verify Viz container can still start (API-only mode)
describe('Viz container uses API for data', () => {

  it('latest viz server.js does NOT reference xpollination.db', () => {
    const fs = require('node:fs');
    const versions = fs.readdirSync(resolve(BASE, 'viz/versions'))
      .filter((d: string) => d.startsWith('v'))
      .sort((a: string, b: string) => {
        const pa = a.replace('v', '').split('.').map(Number);
        const pb = b.replace('v', '').split('.').map(Number);
        for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
        return 0;
      });
    const latest = versions[versions.length - 1];
    const serverJs = readFileSync(resolve(BASE, 'viz/versions', latest, 'server.js'), 'utf-8');
    expect(serverJs).not.toMatch(/xpollination\.db/);
  });
});
