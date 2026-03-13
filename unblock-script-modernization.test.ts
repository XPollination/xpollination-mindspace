/**
 * TDD tests for unblock-script-modernization (v0.0.1)
 *
 * Modernize claude-unblock.sh: auto-detect all agents + remove legacy skill.
 *
 * Auto-Detection:
 * AC-DETECT1: claude-unblock.sh uses tmux list-panes -a for discovery
 * AC-DETECT2: get_agent_name function derives names from session+pane context
 * AC-DETECT3: Startup output shows discovered agents
 * AC-DETECT4: Re-discovery runs periodically (every ~60s)
 *
 * Filtering:
 * AC-FILTER1: No args = monitor all agents
 * AC-FILTER2: Named args filter to matching agents (case-insensitive)
 *
 * Safety Preserved:
 * AC-SAFE1: Bullet gate (●) still present for AskUserQuestion protection
 * AC-SAFE2: Prompt area isolation (tail -40 or similar) preserved
 * AC-SAFE3: Single-digit option guard preserved
 *
 * Legacy Skill Removal:
 * AC-SKILL1: ~/.claude/skills/xpo.claude.unblock/ does not exist
 * AC-SKILL2: Monitor skill install instructions do not reference xpo.claude.unblock
 *
 * Backward Compat:
 * AC-COMPAT1: "agents" and "liaison" still accepted as arguments
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');
const HETZNER_HOME = '/home/developer';

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Auto-Detection ───

describe('AC-DETECT1: claude-unblock.sh uses tmux list-panes for discovery', () => {
  it('should use tmux list-panes -a for agent discovery', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    expect(content).toContain('tmux list-panes -a');
  });

  it('should have a discover function', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    expect(content).toMatch(/discover_agents|discover_panes|auto_discover/);
  });
});

describe('AC-DETECT2: get_agent_name derives names from context', () => {
  it('should have a function to derive agent names', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    expect(content).toMatch(/get_agent_name|agent_name|derive.*name/);
  });

  it('should map claude-agents panes to LIAISON/PDSA/DEV/QA', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    expect(content).toContain('LIAISON');
    expect(content).toContain('PDSA');
    expect(content).toContain('DEV');
    expect(content).toContain('QA');
  });
});

describe('AC-DETECT3: Startup output shows discovered agents', () => {
  it('should display discovery results on startup', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Should have output showing found agents
    expect(content).toMatch(/[Ff]ound|[Dd]iscovered|[Dd]etected/);
    expect(content).toMatch(/[Mm]onitoring/);
  });
});

describe('AC-DETECT4: Re-discovery runs periodically', () => {
  it('should re-discover agents during operation', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Should have periodic re-discovery logic (60s or similar)
    expect(content).toMatch(/re.?discover|REDISCOVER|discovery_interval|60/);
  });
});

// ─── Filtering ───

describe('AC-FILTER1: No args monitors all agents', () => {
  it('should default to monitoring all discovered agents', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Should have "all" default behavior
    const lines = content.split('\n').filter(l =>
      !l.trim().startsWith('#') && (l.includes('ALL') || l.includes('all'))
    );
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('AC-FILTER2: Named args filter to matching agents', () => {
  it('should support filtering by agent name argument', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Should have target/filter matching logic
    expect(content).toMatch(/[Ff]ilter|[Tt]arget|[Mm]atch/);
  });
});

// ─── Safety Preserved ───

describe('AC-SAFE1: Bullet gate preserved', () => {
  it('should still have bullet character check for AskUserQuestion protection', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Bullet gate uses ● character to distinguish tool prompts from AskUserQuestion
    expect(content).toContain('●');
  });
});

describe('AC-SAFE2: Prompt area isolation preserved', () => {
  it('should use tail for prompt area isolation', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    expect(content).toMatch(/tail\s+-\d+|tail\s+-n\s+\d+/);
  });
});

describe('AC-SAFE3: Single-digit option guard preserved', () => {
  it('should only match options 1-9', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // Should have single-digit guard pattern
    expect(content).toMatch(/[1-9]|single.?digit|option.*guard/);
  });
});

// ─── Legacy Skill Removal ───

describe('AC-SKILL1: Legacy unblock skill removed', () => {
  it('~/.claude/skills/xpo.claude.unblock/ should not exist', () => {
    const skillDir = path.join(HETZNER_HOME, '.claude/skills/xpo.claude.unblock');
    expect(fileExists(skillDir)).toBe(false);
  });
});

describe('AC-SKILL2: Monitor skill does not reference unblock skill', () => {
  it('monitor SKILL.md should not have xpo.claude.unblock in install instructions', () => {
    const monitorSkill = path.join(PROJECT_ROOT, '.claude/skills/xpo.claude.monitor/SKILL.md');
    if (!fileExists(monitorSkill)) {
      // Check symlinked location
      const altPath = path.join(HETZNER_HOME, '.claude/skills/xpo.claude.monitor/SKILL.md');
      if (fileExists(altPath)) {
        const content = readFile(altPath);
        const installLines = content.split('\n').filter(l =>
          l.includes('xpo.claude.unblock') &&
          (l.includes('install') || l.includes('ln ') || l.includes('cp ') || l.includes('for '))
        );
        expect(installLines).toEqual([]);
      }
      return;
    }
    const content = readFile(monitorSkill);
    const installLines = content.split('\n').filter(l =>
      l.includes('xpo.claude.unblock') &&
      (l.includes('install') || l.includes('ln ') || l.includes('cp ') || l.includes('for '))
    );
    expect(installLines).toEqual([]);
  });
});

// ─── Backward Compatibility ───

describe('AC-COMPAT1: Old arguments still accepted', () => {
  it('should handle "agents" and "liaison" as valid arguments', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    // These old mode names should still be recognized
    expect(content).toContain('agents');
    expect(content).toContain('liaison');
  });
});
