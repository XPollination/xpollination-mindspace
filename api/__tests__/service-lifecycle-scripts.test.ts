import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, '../../scripts/service-lifecycle.js');
const PKG_PATH = resolve(__dirname, '../../package.json');

/**
 * Service Lifecycle Scripts Tests — service-lifecycle-scripts
 * Validates: service-lifecycle.js with restart, deploy, migrate, health commands.
 * TDD: Dev creates scripts/service-lifecycle.js and npm scripts.
 */

describe('Script file exists', () => {

  it('scripts/service-lifecycle.js exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });
});

describe('Script defines service configurations', () => {

  it('defines viz service with port 4200', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('4200');
    expect(content).toMatch(/viz|server\.js/i);
  });

  it('defines api service with port 3100', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('3100');
    expect(content).toMatch(/api|server\.ts/i);
  });

  it('has health check URLs', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/health|healthUrl|\/health/i);
  });
});

describe('Script has lifecycle commands', () => {

  it('has restart/kill functionality', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/restart|killByPort|kill.*port|SIGTERM/i);
  });

  it('has deploy/version functionality', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/deploy|version|symlink|rollback/i);
  });

  it('has health check command', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/health.*check|checkHealth|healthCheck/i);
  });
});

describe('npm scripts in package.json', () => {

  it('package.json has restart:viz script', () => {
    const pkg = existsSync(PKG_PATH) ? JSON.parse(readFileSync(PKG_PATH, 'utf-8')) : {};
    expect(pkg.scripts?.['restart:viz']).toBeDefined();
  });

  it('package.json has restart:api script', () => {
    const pkg = existsSync(PKG_PATH) ? JSON.parse(readFileSync(PKG_PATH, 'utf-8')) : {};
    expect(pkg.scripts?.['restart:api']).toBeDefined();
  });

  it('package.json has health script', () => {
    const pkg = existsSync(PKG_PATH) ? JSON.parse(readFileSync(PKG_PATH, 'utf-8')) : {};
    expect(pkg.scripts?.['health']).toBeDefined();
  });
});

describe('.env.example exists', () => {

  it('.env.example file is present', () => {
    const envPath = resolve(__dirname, '../../.env.example');
    expect(existsSync(envPath)).toBe(true);
  });
});
