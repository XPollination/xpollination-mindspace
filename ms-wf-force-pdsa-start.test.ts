/**
 * TDD tests for ms-wf-force-pdsa-start (v0.0.1)
 *
 * Workflow Engine — remove direct pending→ready:dev shortcut, force PDSA start.
 *
 * D1: Generic pending->ready forces role to PDSA
 * AC-D1-1: Task type pending->ready has newRole: 'pdsa'
 *
 * D2: Remove pending->ready:dev shortcut
 * AC-D2-1: No pending->ready:dev transition in task type
 *
 * D3: Bug type unchanged
 * AC-D3-1: Bug type pending->ready has newRole: 'dev'
 *
 * D4: CLI fallback warning log
 * AC-D4-1: interface-cli.js logs warning on role-specific fallback
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

const WF_ENGINE = path.join(PROJECT_ROOT, 'src/db/workflow-engine.js');
const CLI = path.join(PROJECT_ROOT, 'src/db/interface-cli.js');

// ─── D1: Generic pending->ready forces role to PDSA ───

describe('AC-D1-1: Task pending->ready has newRole pdsa', () => {
  it('should set newRole to pdsa on generic pending->ready for task type', () => {
    const content = readFile(WF_ENGINE);
    // Find the task type section and its pending->ready rule
    const lines = content.split('\n');
    let inTaskType = false;
    let taskPendingReadyLine = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("'task'") && line.includes('{')) inTaskType = true;
      if (inTaskType && line.includes("'pending->ready'") && !line.includes(':dev') && !line.includes(':pdsa')) {
        // Collect the full rule (may span multiple lines)
        taskPendingReadyLine = lines.slice(i, i + 3).join(' ');
        break;
      }
      // Exit task type block
      if (inTaskType && line.startsWith("'bug'") || line.startsWith("'capability'")) inTaskType = false;
    }
    expect(taskPendingReadyLine).toBeTruthy();
    expect(taskPendingReadyLine).toMatch(/newRole\s*:\s*['"]pdsa['"]/);
  });
});

// ─── D2: Remove pending->ready:dev shortcut ───

describe('AC-D2-1: No pending->ready:dev in task type', () => {
  it('should not have pending->ready:dev transition for task type', () => {
    const content = readFile(WF_ENGINE);
    // Find lines with pending->ready:dev that are NOT comments
    const lines = content.split('\n').filter(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return false;
      return l.includes("'pending->ready:dev'");
    });
    // Filter to task type only (not bug type)
    // Check context — if line is inside 'task' block, it should not exist
    // Simple check: should not have pending->ready:dev in active (non-comment) code for task type
    const inTaskContext = lines.filter(l => !l.includes('bug'));
    expect(inTaskContext).toEqual([]);
  });
});

// ─── D3: Bug type unchanged ───

describe('AC-D3-1: Bug pending->ready has newRole dev', () => {
  it('should keep newRole dev for bug type pending->ready', () => {
    const content = readFile(WF_ENGINE);
    const lines = content.split('\n');
    let inBugType = false;
    let bugPendingReadyLine = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes("'bug'") && line.includes('{')) inBugType = true;
      if (inBugType && line.includes("'pending->ready'") && !line.includes(':dev')) {
        bugPendingReadyLine = lines.slice(i, i + 3).join(' ');
        break;
      }
      if (inBugType && (line.startsWith("'task'") || line.startsWith("'capability'"))) inBugType = false;
    }
    expect(bugPendingReadyLine).toBeTruthy();
    expect(bugPendingReadyLine).toMatch(/newRole\s*:\s*['"]dev['"]/);
  });
});

// ─── D4: CLI fallback warning log ───

describe('AC-D4-1: CLI logs warning on role-specific fallback', () => {
  it('should log a warning when falling back from role-specific to generic transition', () => {
    const content = readFile(CLI);
    // Should have a console.error or console.warn for fallback
    const lines = content.split('\n').filter(l =>
      (l.includes('console.error') || l.includes('console.warn')) &&
      (l.includes('fallback') || l.includes('generic') || l.includes('role-specific') || l.includes('No role'))
    );
    expect(lines.length).toBeGreaterThan(0);
  });
});
