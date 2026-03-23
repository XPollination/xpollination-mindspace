import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../..');

/**
 * TDD Tests: SpiceDB Deployment + Data Migration
 * Ref: REQ-OG-003, spicedb-setup-design
 */

describe('AC1: Docker Compose for SpiceDB + PostgreSQL', () => {

  it('docker-compose.spicedb.yml exists', () => {
    const exists = existsSync(resolve(PROJECT_ROOT, 'docker-compose.spicedb.yml'));
    expect(exists).toBe(true);
  });

  it('compose file defines spicedb service', () => {
    const path = resolve(PROJECT_ROOT, 'docker-compose.spicedb.yml');
    if (!existsSync(path)) { expect(false).toBe(true); return; }
    const content = readFileSync(path, 'utf-8');
    expect(content).toMatch(/spicedb/);
    expect(content).toMatch(/authzed\/spicedb/);
  });

  it('compose file defines postgresql service', () => {
    const path = resolve(PROJECT_ROOT, 'docker-compose.spicedb.yml');
    if (!existsSync(path)) { expect(false).toBe(true); return; }
    const content = readFileSync(path, 'utf-8');
    expect(content).toMatch(/postgres/);
  });
});

describe('AC2: SpiceDB schema', () => {

  it('schema file exists with .zed extension', () => {
    const candidates = [
      resolve(PROJECT_ROOT, 'spicedb/schema.zed'),
      resolve(PROJECT_ROOT, 'src/spicedb/schema.zed'),
      resolve(PROJECT_ROOT, 'config/spicedb-schema.zed'),
    ];
    const found = candidates.some(p => existsSync(p));
    expect(found).toBe(true);
  });

  it('schema defines mission and capability definitions', () => {
    const candidates = [
      resolve(PROJECT_ROOT, 'spicedb/schema.zed'),
      resolve(PROJECT_ROOT, 'src/spicedb/schema.zed'),
      resolve(PROJECT_ROOT, 'config/spicedb-schema.zed'),
    ];
    const schemaPath = candidates.find(p => existsSync(p));
    if (!schemaPath) { expect(false).toBe(true); return; }
    const content = readFileSync(schemaPath, 'utf-8');
    expect(content).toMatch(/definition mission/);
    expect(content).toMatch(/definition capability/);
  });
});

describe('AC3: Migration script', () => {

  it('migration script exists', () => {
    const candidates = [
      resolve(PROJECT_ROOT, 'scripts/migrate-sqlite-to-spicedb.js'),
      resolve(PROJECT_ROOT, 'scripts/migrate-sqlite-to-spicedb.ts'),
      resolve(PROJECT_ROOT, 'src/spicedb/migrate.js'),
    ];
    const found = candidates.some(p => existsSync(p));
    expect(found).toBe(true);
  });
});

describe('AC4: Feature flag SPICEDB_ENABLED', () => {

  it('codebase references SPICEDB_ENABLED flag', () => {
    const clientCandidates = [
      resolve(PROJECT_ROOT, 'src/spicedb/client.js'),
      resolve(PROJECT_ROOT, 'src/spicedb/client.ts'),
    ];
    const clientPath = clientCandidates.find(p => existsSync(p));
    if (!clientPath) { expect(false).toBe(true); return; }
    const content = readFileSync(clientPath, 'utf-8');
    expect(content).toMatch(/SPICEDB_ENABLED/);
  });
});

describe('AC7: @authzed/authzed-node client wrapper', () => {

  it('client wrapper exports checkPermission', () => {
    const candidates = [
      resolve(PROJECT_ROOT, 'src/spicedb/client.js'),
      resolve(PROJECT_ROOT, 'src/spicedb/client.ts'),
    ];
    const clientPath = candidates.find(p => existsSync(p));
    if (!clientPath) { expect(false).toBe(true); return; }
    const content = readFileSync(clientPath, 'utf-8');
    expect(content).toMatch(/checkPermission/);
  });

  it('client wrapper exports writeRelationship', () => {
    const candidates = [
      resolve(PROJECT_ROOT, 'src/spicedb/client.js'),
      resolve(PROJECT_ROOT, 'src/spicedb/client.ts'),
    ];
    const clientPath = candidates.find(p => existsSync(p));
    if (!clientPath) { expect(false).toBe(true); return; }
    const content = readFileSync(clientPath, 'utf-8');
    expect(content).toMatch(/writeRelationship/);
  });

  it('@authzed/authzed-node in package.json dependencies', () => {
    const pkg = JSON.parse(readFileSync(resolve(PROJECT_ROOT, 'package.json'), 'utf-8'));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(allDeps['@authzed/authzed-node']).toBeDefined();
  });
});
