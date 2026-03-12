/**
 * TDD tests for bp-skill-reload-after-update
 * PreToolUse hook that detects skill file changes and warns agent.
 *
 * Tests written BEFORE implementation — these should FAIL until dev implements.
 * Implementation is a shell script (skill-version-check.sh) + settings.json hook config.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BP_ROOT = '/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices';

describe('skill-version-check.sh exists and is executable', () => {
  it('script file exists at expected path', () => {
    const scriptPath = resolve(BP_ROOT, 'scripts/skill-version-check.sh');
    expect(existsSync(scriptPath)).toBe(true);
  });

  it('script contains checksum comparison logic', () => {
    const scriptPath = resolve(BP_ROOT, 'scripts/skill-version-check.sh');
    const content = readFileSync(scriptPath, 'utf-8');

    // Should use md5sum or sha256sum for checksumming
    expect(content).toMatch(/md5sum|sha256sum|cksum/);
    // Should reference SKILL.md
    expect(content).toMatch(/SKILL\.md/i);
    // Should output a warning when checksum differs
    expect(content).toMatch(/changed|stale|reload|clear/i);
  });
});

describe('settings.json hook configuration', () => {
  it('settings.json contains PreToolUse hook for Skill tool', () => {
    const settingsPath = resolve(BP_ROOT, 'scripts/xpo.claude.settings.json');
    expect(existsSync(settingsPath)).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));

    // Should have a PreToolUse hook
    const preToolUseHooks = settings.hooks?.PreToolUse || [];
    const skillHook = preToolUseHooks.find((h: any) =>
      h.matcher === 'Skill' || h.command?.includes('skill-version-check')
    );
    expect(skillHook).toBeDefined();
  });
});
