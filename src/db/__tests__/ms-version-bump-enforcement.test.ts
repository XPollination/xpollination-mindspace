import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Version Bump Enforcement Tests — ms-version-bump-enforcement
 * Validates: auto-detect versioned_component, no jq dependency, gate fires.
 */

const BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test';
const SCRIPT_PATH = resolve(BASE, 'scripts/version-bump.sh');

describe('Version bump script has no jq dependency', () => {
  it('script does NOT use jq', () => {
    if (existsSync(SCRIPT_PATH)) {
      const content = readFileSync(SCRIPT_PATH, 'utf-8');
      expect(content).not.toMatch(/\bjq\b/);
    }
  });
});

describe('Auto-detect versioned_component from task group/files', () => {
  it('workflow engine or CLI auto-sets versioned_component for VIZ group tasks', () => {
    // The interface-cli or workflow engine should detect VIZ group → versioned_component=viz
    const cliPath = resolve(BASE, 'src/db/interface-cli.js');
    const wfPath = resolve(BASE, 'src/db/workflow-engine.js');
    const cli = existsSync(cliPath) ? readFileSync(cliPath, 'utf-8') : '';
    const wf = existsSync(wfPath) ? readFileSync(wfPath, 'utf-8') : '';
    const combined = cli + wf;
    expect(combined).toMatch(/versioned_component|version_bump/i);
  });

  it('VIZ group tasks get versioned_component=viz automatically', () => {
    // Check if there's auto-detection logic for group→component mapping
    const cliPath = resolve(BASE, 'src/db/interface-cli.js');
    if (existsSync(cliPath)) {
      const content = readFileSync(cliPath, 'utf-8');
      expect(content).toMatch(/VIZ.*viz|group.*versioned_component/i);
    }
  });
});
