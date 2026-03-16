/**
 * TDD tests for ms-unblock-human-pane-exclusion (v0.0.1)
 *
 * claude-unblock.sh must exclude pane 0 (human pane) from default agents mode.
 *
 * D1: Default agents mode excludes pane 0
 * AC-D1-1: "agents" mode PANES does NOT include key 0
 * AC-D1-2: "agents" mode PANES includes keys 1, 2, 3
 *
 * D2: Startup banner reflects exclusion
 * AC-D2-1: Banner says "AGENT PANES" not "ALL PANES"
 * AC-D2-2: Banner shows panes 1-3 not 0-3
 *
 * D3: "all" mode for full-pane monitoring
 * AC-D3-1: "all" mode includes pane 0
 * AC-D3-2: "all" mode banner mentions human pane or panes 0-3
 *
 * D4: Header comments updated
 * AC-D4-1: Header describes agents as panes 1-3
 * AC-D4-2: Header mentions "all" mode
 *
 * D5: Help text updated
 * AC-D5-1: Help text documents "all" mode
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts/claude-unblock.sh');

// ─── D1: Default agents mode excludes pane 0 ───

describe('AC-D1-1: agents mode PANES does NOT include key 0', () => {
  it('should not have [0]= in the agents mode PANES declaration', () => {
    const content = readFile(SCRIPT_PATH);
    // Find the agents/default PANES line (not liaison, not all mode)
    // The agents mode PANES should only have [1], [2], [3]
    const lines = content.split('\n');
    // Find PANES lines in agents mode block (after the liaison check)
    let inAgentsBlock = false;
    let agentsPanesLine = '';
    for (const line of lines) {
      if (line.includes('"liaison"') || line.includes("'liaison'")) {
        inAgentsBlock = false;
      }
      if (line.includes('PANES=(') && !line.trim().startsWith('#')) {
        // Check if this is the agents mode (has PDSA, DEV, QA but should NOT have LIAISON at [0])
        if (line.includes('PDSA') && line.includes('DEV') && line.includes('QA')) {
          agentsPanesLine = line;
        }
      }
    }
    expect(agentsPanesLine).toBeTruthy();
    // Should NOT have [0]= in agents mode
    expect(agentsPanesLine).not.toMatch(/\[0\]\s*=/);
  });
});

describe('AC-D1-2: agents mode includes panes 1, 2, 3', () => {
  it('should have [1]=PDSA [2]=DEV [3]=QA', () => {
    const content = readFile(SCRIPT_PATH);
    const lines = content.split('\n').filter(l =>
      l.includes('PANES=(') && l.includes('PDSA') && l.includes('DEV') && l.includes('QA')
    );
    expect(lines.length).toBeGreaterThan(0);
    const agentsLine = lines[0];
    expect(agentsLine).toMatch(/\[1\]\s*=\s*"?PDSA"?/);
    expect(agentsLine).toMatch(/\[2\]\s*=\s*"?DEV"?/);
    expect(agentsLine).toMatch(/\[3\]\s*=\s*"?QA"?/);
  });
});

// ─── D2: Startup banner reflects exclusion ───

describe('AC-D2-1: Banner says AGENT PANES not ALL PANES', () => {
  it('should show AGENT PANES in agents mode banner', () => {
    const content = readFile(SCRIPT_PATH);
    expect(content).toMatch(/AGENT PANES|agent panes/);
  });

  it('should NOT show ALL PANES for agents mode', () => {
    const content = readFile(SCRIPT_PATH);
    // Find echo lines near the agents PANES assignment
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('PANES=(') && lines[i].includes('PDSA') && lines[i].includes('QA') && !lines[i].includes('[0]')) {
        // Check the nearby echo/banner line
        const nearby = lines.slice(i, i + 3).join('\n');
        expect(nearby).not.toContain('ALL PANES');
      }
    }
  });
});

describe('AC-D2-2: Banner shows panes 1-3', () => {
  it('should reference panes 1-3 in agents mode banner', () => {
    const content = readFile(SCRIPT_PATH);
    expect(content).toMatch(/panes? 1-3|1-3.*PDSA.*DEV.*QA/i);
  });
});

// ─── D3: "all" mode for full-pane monitoring ───

describe('AC-D3-1: all mode includes pane 0', () => {
  it('should have an "all" mode that includes [0]', () => {
    const content = readFile(SCRIPT_PATH);
    // Must have a mode check for "all" or "agents" that includes all 4 panes
    // Find a section that explicitly includes pane 0 for "all" mode
    const hasAllMode = content.includes('"all"') || content.includes("'all'");
    expect(hasAllMode).toBe(true);
  });
});

describe('AC-D3-2: all mode banner mentions panes 0-3 or human pane', () => {
  it('should mention panes 0-3 or ALL PANES in all mode', () => {
    const content = readFile(SCRIPT_PATH);
    // The "all" mode banner should clarify it includes all panes
    expect(content).toMatch(/ALL PANES|panes? 0-3|including.*human|including.*LIAISON/i);
  });
});

// ─── D4: Header comments updated ───

describe('AC-D4-1: Header describes agents as panes 1-3', () => {
  it('should document agents mode as panes 1-3 in header', () => {
    const content = readFile(SCRIPT_PATH);
    const headerLines = content.split('\n').slice(0, 50);
    const header = headerLines.join('\n');
    expect(header).toMatch(/agents.*panes? 1-3|panes? 1-3.*PDSA|1-3/i);
  });
});

describe('AC-D4-2: Header mentions all mode', () => {
  it('should document all mode in header comments', () => {
    const content = readFile(SCRIPT_PATH);
    const headerLines = content.split('\n').slice(0, 50);
    const header = headerLines.join('\n');
    // Header should mention "all" as a mode option
    expect(header).toMatch(/all\b.*pane|all\b.*0-3|all\b.*LIAISON/i);
  });
});

// ─── D5: Help text updated ───

describe('AC-D5-1: Help text documents all mode', () => {
  it('should include "all" in help/usage text', () => {
    const content = readFile(SCRIPT_PATH);
    // Look for help section that mentions "all"
    const helpLines = content.split('\n').filter(l =>
      l.includes('all') && (l.includes('help') || l.includes('Usage') || l.includes('mode') || l.includes('Modes'))
    );
    expect(helpLines.length).toBeGreaterThan(0);
  });
});
