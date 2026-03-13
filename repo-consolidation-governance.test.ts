/**
 * TDD tests for repo-consolidation-governance (v0.0.4)
 *
 * Organizational cleanup: governance repo, GitHub renames, script migration, archival.
 * Scope: D1-D7 only — no hive infrastructure.
 *
 * Script Migration:
 * AC-SCRIPT1: scripts/claude-session.sh exists (copied from HomeAssistant)
 * AC-SCRIPT2: scripts/claude-unblock.sh exists (copied from HomeAssistant)
 * AC-SCRIPT3: claude-session.sh SELF_PATH uses realpath (not hardcoded HomeAssistant path)
 * AC-SCRIPT4: claude-unblock.sh SELF_PATH uses realpath (not hardcoded HomeAssistant path)
 * AC-SCRIPT5: claude-session.sh SKILLS_SRC points to xpollination-mcp-server
 * AC-SCRIPT6: claude-session.sh SETTINGS_TEMPLATE points to xpollination-mcp-server
 * AC-SCRIPT7: claude-session.sh SYNC_SETTINGS_SCRIPT points to xpollination-mcp-server
 * AC-SCRIPT8: No xpollination-best-practices references in non-comment lines of migrated scripts
 *
 * CLAUDE.md Updates:
 * AC-CLAUDE1: ~/.claude/CLAUDE.md references xpollination-mindspace as primary product
 * AC-CLAUDE2: ~/.claude/CLAUDE.md skills source points to xpollination-mcp-server (local dir unchanged)
 *
 * HomeAssistant Cleanup:
 * AC-CLEAN1: claude-session.sh removed from HomeAssistant scripts directory
 * AC-CLEAN2: claude-unblock.sh removed from HomeAssistant scripts directory
 *
 * Symlink Update:
 * AC-LINK1: ~/bin/claude-session symlink points to xpollination-mcp-server/scripts/claude-session.sh
 *
 * Git Remote:
 * AC-REMOTE1: origin remote URL points to xpollination-mindspace.git
 *
 * GitHub Operations (post-execution verification):
 * AC-GH1: XPollinationGovernance repo exists and is private
 * AC-GH2: xpollination-mindspace repo exists and is public
 * AC-GH3: xpollination-mindspace-legacy is archived
 * AC-GH4: xpollination-best-practices is archived
 * AC-GH5: xpollination-hive is private and archived
 *
 * Governance Content:
 * AC-GOV1: ADR file exists in governance repo with D1-D7 decisions
 * AC-GOV2: Project inventory exists in governance repo with correct table
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '.');
const HETZNER_HOME = '/home/developer';
const HA_SCRIPTS_DIR = path.join(
  HETZNER_HOME,
  'workspaces/github/PichlerThomas/HomeAssistant/systems/synology-ds218/features/infrastructure/scripts'
);

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function getNonCommentLines(content: string, pattern: string): string[] {
  return content.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) return false;
    return line.includes(pattern);
  });
}

// --- Script Migration ---

describe('AC-SCRIPT1: claude-session.sh exists in scripts/', () => {
  it('scripts/claude-session.sh should exist', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'))).toBe(true);
  });
});

describe('AC-SCRIPT2: claude-unblock.sh exists in scripts/', () => {
  it('scripts/claude-unblock.sh should exist', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'))).toBe(true);
  });
});

describe('AC-SCRIPT3: claude-session.sh SELF_PATH uses realpath', () => {
  it('SELF_PATH should use $(realpath "$0") not hardcoded HomeAssistant path', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'));
    const selfPathLines = content.split('\n').filter(l =>
      l.includes('SELF_PATH') && !l.trim().startsWith('#')
    );
    expect(selfPathLines.length).toBeGreaterThan(0);

    // Should NOT contain the old HomeAssistant path
    const hasOldPath = selfPathLines.some(l =>
      l.includes('HomeAssistant/systems/synology-ds218')
    );
    expect(hasOldPath).toBe(false);

    // Should use realpath for auto-detection
    const usesRealpath = selfPathLines.some(l => l.includes('realpath'));
    expect(usesRealpath).toBe(true);
  });
});

describe('AC-SCRIPT4: claude-unblock.sh SELF_PATH uses realpath', () => {
  it('SELF_PATH should use $(realpath "$0") not hardcoded HomeAssistant path', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    const selfPathLines = content.split('\n').filter(l =>
      l.includes('SELF_PATH') && !l.trim().startsWith('#')
    );
    expect(selfPathLines.length).toBeGreaterThan(0);

    const hasOldPath = selfPathLines.some(l =>
      l.includes('HomeAssistant/systems/synology-ds218')
    );
    expect(hasOldPath).toBe(false);

    const usesRealpath = selfPathLines.some(l => l.includes('realpath'));
    expect(usesRealpath).toBe(true);
  });
});

describe('AC-SCRIPT5: claude-session.sh SKILLS_SRC points to mcp-server', () => {
  it('SKILLS_SRC should reference xpollination-mcp-server, not best-practices', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'));
    const skillsLines = content.split('\n').filter(l =>
      l.includes('SKILLS_SRC') && !l.trim().startsWith('#')
    );
    expect(skillsLines.length).toBeGreaterThan(0);

    // Should point to xpollination-mcp-server
    const pointsToMcpServer = skillsLines.some(l =>
      l.includes('xpollination-mcp-server')
    );
    expect(pointsToMcpServer).toBe(true);

    // Should NOT point to best-practices
    const pointsToBestPractices = skillsLines.some(l =>
      l.includes('xpollination-best-practices')
    );
    expect(pointsToBestPractices).toBe(false);
  });
});

describe('AC-SCRIPT6: claude-session.sh SETTINGS_TEMPLATE points to mcp-server', () => {
  it('SETTINGS_TEMPLATE should reference xpollination-mcp-server', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'));
    const settingsLines = content.split('\n').filter(l =>
      l.includes('SETTINGS_TEMPLATE') && !l.trim().startsWith('#')
    );
    expect(settingsLines.length).toBeGreaterThan(0);

    const pointsToMcpServer = settingsLines.some(l =>
      l.includes('xpollination-mcp-server')
    );
    expect(pointsToMcpServer).toBe(true);

    const pointsToBestPractices = settingsLines.some(l =>
      l.includes('xpollination-best-practices')
    );
    expect(pointsToBestPractices).toBe(false);
  });
});

describe('AC-SCRIPT7: claude-session.sh SYNC_SETTINGS_SCRIPT points to mcp-server', () => {
  it('SYNC_SETTINGS_SCRIPT should reference xpollination-mcp-server', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'));
    const syncLines = content.split('\n').filter(l =>
      l.includes('SYNC_SETTINGS_SCRIPT') && !l.trim().startsWith('#')
    );
    expect(syncLines.length).toBeGreaterThan(0);

    const pointsToMcpServer = syncLines.some(l =>
      l.includes('xpollination-mcp-server')
    );
    expect(pointsToMcpServer).toBe(true);

    const pointsToBestPractices = syncLines.some(l =>
      l.includes('xpollination-best-practices')
    );
    expect(pointsToBestPractices).toBe(false);
  });
});

describe('AC-SCRIPT8: No xpollination-best-practices references in migrated scripts', () => {
  it('claude-session.sh should not reference xpollination-best-practices in non-comment lines', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-session.sh'));
    const offendingLines = getNonCommentLines(content, 'xpollination-best-practices');
    expect(offendingLines).toEqual([]);
  });

  it('claude-unblock.sh should not reference xpollination-best-practices in non-comment lines', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh'));
    const offendingLines = getNonCommentLines(content, 'xpollination-best-practices');
    expect(offendingLines).toEqual([]);
  });
});

// --- CLAUDE.md Updates ---

describe('AC-CLAUDE1: ~/.claude/CLAUDE.md references xpollination-mindspace', () => {
  it('should reference xpollination-mindspace as a project name', () => {
    const content = readFile(path.join(HETZNER_HOME, '.claude/CLAUDE.md'));
    expect(content).toContain('xpollination-mindspace');
  });

  it('should describe it as the Mindspace PM system', () => {
    const content = readFile(path.join(HETZNER_HOME, '.claude/CLAUDE.md'));
    // The conceptual name should reflect "Mindspace" not "content pipeline"
    const identityLines = content.split('\n').filter(l =>
      l.includes('xpollination-mindspace') && l.includes('Mindspace')
    );
    expect(identityLines.length).toBeGreaterThan(0);
  });
});

describe('AC-CLAUDE2: ~/.claude/CLAUDE.md skills source points to mcp-server', () => {
  it('skill source paths should reference xpollination-mcp-server, not best-practices', () => {
    const content = readFile(path.join(HETZNER_HOME, '.claude/CLAUDE.md'));
    const skillLines = content.split('\n').filter(l =>
      (l.includes('skills') || l.includes('SKILL')) &&
      l.includes('xpollination-best-practices') &&
      !l.trim().startsWith('#')
    );
    // No skill source references should point to best-practices
    expect(skillLines).toEqual([]);
  });

  it('skill source paths should reference xpollination-mcp-server', () => {
    const content = readFile(path.join(HETZNER_HOME, '.claude/CLAUDE.md'));
    const skillLines = content.split('\n').filter(l =>
      l.includes('.claude/skills') && l.includes('xpollination-mcp-server')
    );
    expect(skillLines.length).toBeGreaterThan(0);
  });
});

// --- HomeAssistant Cleanup ---

describe('AC-CLEAN1: claude-session.sh removed from HomeAssistant', () => {
  it('should no longer exist at the old HomeAssistant location', () => {
    const oldPath = path.join(HA_SCRIPTS_DIR, 'claude-session.sh');
    expect(fileExists(oldPath)).toBe(false);
  });
});

describe('AC-CLEAN2: claude-unblock.sh removed from HomeAssistant', () => {
  it('should no longer exist at the old HomeAssistant location', () => {
    const oldPath = path.join(HA_SCRIPTS_DIR, 'claude-unblock.sh');
    expect(fileExists(oldPath)).toBe(false);
  });
});

// --- Symlink Update ---

describe('AC-LINK1: claude-session symlink points to new location', () => {
  it('~/bin/claude-session should symlink to xpollination-mcp-server/scripts/', () => {
    const symlinkPath = path.join(HETZNER_HOME, 'bin/claude-session');
    if (!fileExists(symlinkPath)) {
      // Symlink may be at /usr/local/bin — check there too
      const altPath = '/usr/local/bin/claude-session';
      if (fileExists(altPath)) {
        const target = fs.readlinkSync(altPath);
        expect(target).toContain('xpollination-mcp-server/scripts/claude-session.sh');
      } else {
        // No symlink found at either location — one must exist
        expect(fileExists(symlinkPath) || fileExists(altPath)).toBe(true);
      }
    } else {
      const target = fs.readlinkSync(symlinkPath);
      expect(target).toContain('xpollination-mcp-server/scripts/claude-session.sh');
    }
  });
});

// --- Git Remote ---

describe('AC-REMOTE1: git remote origin points to xpollination-mindspace', () => {
  it('origin URL should be xpollination-mindspace.git', () => {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    }).trim();
    expect(remoteUrl).toContain('xpollination-mindspace');
    expect(remoteUrl).not.toContain('xpollination-mcp-server');
  });
});

// --- GitHub Operations (post-execution verification) ---

describe('AC-GH1: XPollinationGovernance repo exists and is private', () => {
  it('governance repo should exist', () => {
    const result = execSync(
      'gh repo view XPollination/XPollinationGovernance --json name,visibility 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const data = JSON.parse(result);
    expect(data.name).toBe('XPollinationGovernance');
    expect(data.visibility).toBe('PRIVATE');
  });
});

describe('AC-GH2: xpollination-mindspace repo exists and is public', () => {
  it('renamed primary repo should exist and be public', () => {
    const result = execSync(
      'gh repo view XPollination/xpollination-mindspace --json name,visibility 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const data = JSON.parse(result);
    expect(data.name).toBe('xpollination-mindspace');
    expect(data.visibility).toBe('PUBLIC');
  });
});

describe('AC-GH3: xpollination-mindspace-legacy is archived', () => {
  it('legacy mindspace repo should be archived', () => {
    const result = execSync(
      'gh repo view XPollination/xpollination-mindspace-legacy --json isArchived 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const data = JSON.parse(result);
    expect(data.isArchived).toBe(true);
  });
});

describe('AC-GH4: xpollination-best-practices is archived', () => {
  it('best-practices repo should be archived', () => {
    const result = execSync(
      'gh repo view XPollination/xpollination-best-practices --json isArchived 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const data = JSON.parse(result);
    expect(data.isArchived).toBe(true);
  });
});

describe('AC-GH5: xpollination-hive is private and archived', () => {
  it('hive repo should be private and archived', () => {
    const result = execSync(
      'gh repo view XPollination/xpollination-hive --json visibility,isArchived 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const data = JSON.parse(result);
    expect(data.visibility).toBe('PRIVATE');
    expect(data.isArchived).toBe(true);
  });
});

// --- Governance Content ---

describe('AC-GOV1: ADR file in governance repo has D1-D7 decisions', () => {
  it('governance repo should have ADR with all 7 decisions', () => {
    // Use gh to read the file from the governance repo
    const result = execSync(
      'gh api repos/XPollination/XPollinationGovernance/contents/decisions/2026-03-13-repo-consolidation.md --jq .content 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const content = Buffer.from(result, 'base64').toString('utf-8');

    expect(content).toContain('D1');
    expect(content).toContain('D2');
    expect(content).toContain('D3');
    expect(content).toContain('D4');
    expect(content).toContain('D5');
    expect(content).toContain('D6');
    expect(content).toContain('D7');
    expect(content).toContain('ARCHIVE');
    expect(content).toContain('xpollination-mindspace');
  });
});

describe('AC-GOV2: Project inventory in governance repo', () => {
  it('governance repo should have project inventory with all repos', () => {
    const result = execSync(
      'gh api repos/XPollination/XPollinationGovernance/contents/inventory/projects.md --jq .content 2>&1',
      { encoding: 'utf-8' }
    ).trim();
    const content = Buffer.from(result, 'base64').toString('utf-8');

    expect(content).toContain('xpollination-mindspace');
    expect(content).toContain('XPollinationGovernance');
    expect(content).toContain('HomePage');
    expect(content).toContain('ProfileAssistant');
    expect(content).toContain('xpollination-mindspace-legacy');
    expect(content).toContain('xpollination-best-practices');
    expect(content).toContain('xpollination-hive');
  });
});
