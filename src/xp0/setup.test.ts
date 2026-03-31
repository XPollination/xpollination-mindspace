import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { execSync } from 'child_process';

const XP0_ROOT = resolve(__dirname);
const PROJECT_ROOT = resolve(__dirname, '../..');

const EXPECTED_DIRS = [
  'twin',
  'storage',
  'auth',
  'validation',
  'workflow',
  'runner',
  'transport',
  'schemas',
  'test',
];

describe('runner-codebase-setup: directory structure', () => {
  it('src/xp0/ root directory exists', () => {
    expect(existsSync(XP0_ROOT)).toBe(true);
  });

  it('src/xp0/index.ts barrel export exists', () => {
    expect(existsSync(join(XP0_ROOT, 'index.ts'))).toBe(true);
  });

  for (const dir of EXPECTED_DIRS) {
    it(`src/xp0/${dir}/ directory exists`, () => {
      expect(existsSync(join(XP0_ROOT, dir))).toBe(true);
    });

    it(`src/xp0/${dir}/index.ts stub exists`, () => {
      expect(existsSync(join(XP0_ROOT, dir, 'index.ts'))).toBe(true);
    });
  }
});

describe('runner-codebase-setup: TypeScript compilation', () => {
  it('tsc compiles src/xp0/ without errors', () => {
    // Run tsc with noEmit to check compilation only
    const result = execSync('npx tsc --noEmit 2>&1 || true', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      timeout: 30000,
    });
    // Filter for xp0-related errors only
    const xp0Errors = result
      .split('\n')
      .filter((line) => line.includes('src/xp0/'));
    expect(xp0Errors, `TypeScript errors in src/xp0/:\n${xp0Errors.join('\n')}`).toHaveLength(0);
  });
});

describe('runner-codebase-setup: dependencies', () => {
  it('@noble/ed25519 is listed in package.json dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf-8'));
    expect(pkg.dependencies).toHaveProperty('@noble/ed25519');
  });
});
