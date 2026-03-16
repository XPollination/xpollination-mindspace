import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Version Bump Gate Tests — ms-version-bump-gate
 * Tests for: version-bump.sh script, version-components.json registry
 */

const BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test';
const SCRIPT_PATH = resolve(BASE, 'scripts/version-bump.sh');
const REGISTRY_PATH = resolve(BASE, 'scripts/version-components.json');

// ==========================================================================
// 1. Version bump script exists and has correct structure
// ==========================================================================

describe('Version bump script (scripts/version-bump.sh)', () => {

  it('script file exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('script is executable (has shebang)', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content.startsWith('#!/')).toBe(true);
    }
  });

  it('script accepts component name as argument', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should reference $1 or argv or component argument
      expect(content).toMatch(/\$1|\$\{1\}|component/i);
    }
  });

  it('script handles version number parsing (semver)', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      // Should parse version numbers (v0.0.XX pattern)
      expect(content).toMatch(/v[0-9]|version|semver|minor|major|patch/i);
    }
  });

  it('script creates new version directory', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/mkdir|cp -r|copy/i);
    }
  });

  it('script updates symlink', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/ln -s|symlink/i);
    }
  });

  it('script commits the version bump', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/git commit|git add/i);
    }
  });

  it('script outputs the new version string', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).toMatch(/echo|printf|output/i);
    }
  });
});

// ==========================================================================
// 2. Component registry exists and has correct structure
// ==========================================================================

describe('Component registry (scripts/version-components.json)', () => {

  it('registry file exists', () => {
    expect(existsSync(REGISTRY_PATH)).toBe(true);
  });

  it('registry is valid JSON', () => {
    if (existsSync(REGISTRY_PATH)) {
      const content = readFileSync(REGISTRY_PATH, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    }
  });

  it('registry has viz component', () => {
    if (existsSync(REGISTRY_PATH)) {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      expect(registry).toHaveProperty('viz');
    }
  });

  it('viz component has versions directory', () => {
    if (existsSync(REGISTRY_PATH)) {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      if (registry.viz) {
        expect(registry.viz).toHaveProperty('versions');
      }
    }
  });

  it('registry has workflow component', () => {
    if (existsSync(REGISTRY_PATH)) {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      expect(registry).toHaveProperty('workflow');
    }
  });

  it('registry is extensible (has at least 2 components)', () => {
    if (existsSync(REGISTRY_PATH)) {
      const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
      expect(Object.keys(registry).length).toBeGreaterThanOrEqual(2);
    }
  });
});
