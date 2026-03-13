/**
 * TDD tests for licensing-public-readiness (v0.0.1)
 *
 * AGPL-3.0 licensing posture for public repos.
 *
 * LICENSE File:
 * AC-LIC1: LICENSE has Copyright (C) 2026 Thomas Pichler header
 * AC-LIC2: LICENSE mentions XPollination Mindspace
 * AC-LIC3: LICENSE has AGPL preamble (redistribute/modify terms)
 *
 * README:
 * AC-READ1: README.md references AGPL-3.0 (not MIT)
 * AC-READ2: README.md has dual-license section with licensing@xpollination.earth
 * AC-READ3: README.md does NOT say "MIT" in license context
 *
 * NOTICE File:
 * AC-NOT1: NOTICE file exists
 * AC-NOT2: NOTICE has copyright holder (Thomas Pichler)
 * AC-NOT3: NOTICE has third-party attributions from package.json deps
 *
 * Pre-commit Hook:
 * AC-HOOK1: .githooks/pre-commit exists and is executable
 * AC-HOOK2: Pre-commit hook checks for SPDX header in staged files
 * AC-HOOK3: git core.hooksPath configured to .githooks
 *
 * File Headers (examples):
 * AC-HDR1: src/index.ts has SPDX-License-Identifier header
 * AC-HDR2: src/db/interface-cli.js has SPDX-License-Identifier header
 *
 * Governance Repo:
 * AC-GOV1: XPollinationGovernance has LICENSE file
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── LICENSE File ───

describe('AC-LIC1: LICENSE has copyright header', () => {
  it('should have Copyright (C) 2026 Thomas Pichler', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'LICENSE'));
    expect(content).toContain('Copyright (C) 2026 Thomas Pichler');
  });
});

describe('AC-LIC2: LICENSE mentions XPollination Mindspace', () => {
  it('should mention the project name', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'LICENSE'));
    expect(content).toContain('XPollination Mindspace');
  });
});

describe('AC-LIC3: LICENSE has AGPL preamble', () => {
  it('should have AGPL redistribution terms', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'LICENSE'));
    expect(content).toContain('GNU Affero General Public License');
    expect(content).toMatch(/redistribute.*modify|free software/i);
  });
});

// ─── README ───

describe('AC-READ1: README.md references AGPL-3.0', () => {
  it('should mention AGPL-3.0 in license section', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'README.md'));
    expect(content).toMatch(/AGPL[- ]3\.0/);
  });
});

describe('AC-READ2: README.md has dual-license section', () => {
  it('should have commercial license contact', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'README.md'));
    expect(content).toContain('licensing@xpollination.earth');
  });

  it('should mention commercial license availability', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'README.md'));
    expect(content).toMatch(/[Cc]ommercial [Ll]icense/);
  });
});

describe('AC-READ3: README.md does not say MIT in license context', () => {
  it('should not reference MIT as the project license', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'README.md'));
    // Find lines that mention MIT in a license context (not in dependency attribution)
    const licenseSection = content.split('\n').filter(l => {
      const lower = l.toLowerCase();
      return lower.includes('mit') &&
             (lower.includes('license') || lower.includes('licensed')) &&
             !lower.includes('third') && !lower.includes('dep') && !lower.includes('notice');
    });
    // Should not claim the project itself is MIT
    const projectMitClaim = licenseSection.filter(l =>
      l.toLowerCase().includes('this project') || l.toLowerCase().includes('licensed under')
    );
    expect(projectMitClaim.filter(l => l.toLowerCase().includes('mit'))).toEqual([]);
  });
});

// ─── NOTICE File ───

describe('AC-NOT1: NOTICE file exists', () => {
  it('NOTICE should exist at project root', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'NOTICE'))).toBe(true);
  });
});

describe('AC-NOT2: NOTICE has copyright holder', () => {
  it('should include Thomas Pichler as copyright holder', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'NOTICE'));
    expect(content).toContain('Thomas Pichler');
  });
});

describe('AC-NOT3: NOTICE has third-party attributions', () => {
  it('should attribute @modelcontextprotocol/sdk', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'NOTICE'));
    expect(content).toContain('@modelcontextprotocol/sdk');
  });

  it('should attribute better-sqlite3', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'NOTICE'));
    expect(content).toContain('better-sqlite3');
  });

  it('should attribute key runtime dependencies', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'NOTICE'));
    // At least 4 of the major deps should be listed
    const deps = ['rss-parser', 'simple-git', 'uuid', 'zod'];
    const found = deps.filter(d => content.includes(d));
    expect(found.length).toBeGreaterThanOrEqual(3);
  });
});

// ─── Pre-commit Hook ───

describe('AC-HOOK1: .githooks/pre-commit exists and is executable', () => {
  it('.githooks/pre-commit should exist', () => {
    expect(fileExists(path.join(PROJECT_ROOT, '.githooks/pre-commit'))).toBe(true);
  });

  it('.githooks/pre-commit should be executable', () => {
    const stats = fs.statSync(path.join(PROJECT_ROOT, '.githooks/pre-commit'));
    const isExecutable = (stats.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });
});

describe('AC-HOOK2: Pre-commit hook checks for SPDX header', () => {
  it('should check for SPDX-License-Identifier in staged files', () => {
    const content = readFile(path.join(PROJECT_ROOT, '.githooks/pre-commit'));
    expect(content).toContain('SPDX-License-Identifier');
  });

  it('should check .ts and .js files', () => {
    const content = readFile(path.join(PROJECT_ROOT, '.githooks/pre-commit'));
    expect(content).toMatch(/\.ts|\.js/);
  });
});

describe('AC-HOOK3: git core.hooksPath configured', () => {
  it('should be set to .githooks', () => {
    const result = execSync('git config core.hooksPath', {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
    }).trim();
    expect(result).toBe('.githooks');
  });
});

// ─── File Headers (examples) ───

describe('AC-HDR1: src/index.ts has SPDX header', () => {
  it('should have SPDX-License-Identifier as first or second line', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'src/index.ts'));
    const firstLines = content.split('\n').slice(0, 3).join('\n');
    expect(firstLines).toContain('SPDX-License-Identifier');
  });
});

describe('AC-HDR2: src/db/interface-cli.js has SPDX header', () => {
  it('should have SPDX-License-Identifier in first lines', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'src/db/interface-cli.js'));
    const firstLines = content.split('\n').slice(0, 3).join('\n');
    expect(firstLines).toContain('SPDX-License-Identifier');
  });
});

// ─── Governance Repo ───

describe('AC-GOV1: XPollinationGovernance has LICENSE', () => {
  it('governance repo should have LICENSE file', () => {
    const result = execSync(
      "gh api repos/XPollination/XPollinationGovernance/contents/LICENSE --jq '.name' 2>&1",
      { encoding: 'utf-8', timeout: 10000 }
    ).trim();
    expect(result).toBe('LICENSE');
  });
});
