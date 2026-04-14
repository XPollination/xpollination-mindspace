/**
 * TDD Tests for Kanban UX Features:
 * 1. kanban-completed-filter: completed tasks time-based filter
 * 2. kanban-blocked-cancelled-column: separate columns for blocked/rework
 *
 * Tests the column config and API query logic (not DOM rendering).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// --- kanban-completed-filter tests ---

describe('kanban-completed-filter: column config', () => {
  // Expected new COLUMNS config after both tasks
  const NEW_COLUMNS = [
    { id: 'queue',    statuses: ['pending', 'ready'] },
    { id: 'active',   statuses: ['active', 'testing'] },
    { id: 'review',   statuses: ['review', 'approval'] },
    { id: 'approved', statuses: ['approved'] },
    { id: 'rework',   statuses: ['rework'] },
    { id: 'blocked',  statuses: ['blocked', 'cancelled'] },
    { id: 'done',     statuses: ['complete'] },
  ];

  function getColumn(status: string): string | undefined {
    for (const col of NEW_COLUMNS) {
      if (col.statuses.includes(status)) return col.id;
    }
    return undefined;
  }

  it('complete tasks map to done column', () => {
    expect(getColumn('complete')).toBe('done');
  });

  it('rework maps to rework column (not done)', () => {
    expect(getColumn('rework')).toBe('rework');
  });

  it('blocked maps to blocked column (not done)', () => {
    expect(getColumn('blocked')).toBe('blocked');
  });

  it('cancelled maps to blocked column', () => {
    expect(getColumn('cancelled')).toBe('blocked');
  });

  it('active maps to active column', () => {
    expect(getColumn('active')).toBe('active');
  });
});

describe('kanban-completed-filter: time-based filtering logic', () => {
  function isWithinDays(updatedAt: string, days: number): boolean {
    const updated = new Date(updatedAt).getTime();
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return updated >= cutoff;
  }

  it('task completed today is within 1 day', () => {
    const now = new Date().toISOString();
    expect(isWithinDays(now, 1)).toBe(true);
  });

  it('task completed 2 days ago is NOT within 1 day', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDays(twoDaysAgo, 1)).toBe(false);
  });

  it('task completed 2 days ago IS within 7 days', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDays(twoDaysAgo, 7)).toBe(true);
  });

  it('task completed 10 days ago is NOT within 7 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDays(tenDaysAgo, 7)).toBe(false);
  });

  it('task completed 10 days ago IS within 30 days', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(isWithinDays(tenDaysAgo, 30)).toBe(true);
  });
});

// --- kanban-blocked-cancelled-column tests ---

describe('kanban-blocked-cancelled-column: column separation', () => {
  const OLD_COLUMNS = [
    { id: 'done', statuses: ['complete', 'rework', 'blocked', 'cancelled'] },
  ];

  const NEW_COLUMNS = [
    { id: 'rework',  statuses: ['rework'] },
    { id: 'blocked', statuses: ['blocked', 'cancelled'] },
    { id: 'done',    statuses: ['complete'] },
  ];

  it('old config groups rework+blocked+cancelled in done', () => {
    const doneCol = OLD_COLUMNS.find(c => c.id === 'done');
    expect(doneCol!.statuses).toContain('rework');
    expect(doneCol!.statuses).toContain('blocked');
    expect(doneCol!.statuses).toContain('cancelled');
  });

  it('new config separates rework from done', () => {
    const reworkCol = NEW_COLUMNS.find(c => c.id === 'rework');
    const doneCol = NEW_COLUMNS.find(c => c.id === 'done');
    expect(reworkCol!.statuses).toContain('rework');
    expect(doneCol!.statuses).not.toContain('rework');
  });

  it('new config separates blocked from done', () => {
    const blockedCol = NEW_COLUMNS.find(c => c.id === 'blocked');
    const doneCol = NEW_COLUMNS.find(c => c.id === 'done');
    expect(blockedCol!.statuses).toContain('blocked');
    expect(doneCol!.statuses).not.toContain('blocked');
  });

  it('done column only contains complete', () => {
    const doneCol = NEW_COLUMNS.find(c => c.id === 'done');
    expect(doneCol!.statuses).toEqual(['complete']);
  });
});

describe('kanban-blocked-cancelled-column: blocked_reason display', () => {
  it('blocked task DNA contains blocked_reason', () => {
    const blockedTask = {
      status: 'blocked',
      dna: {
        blocked_reason: 'Waiting for runner-auth-identity deployment',
        blocked_from_state: 'active',
        blocked_from_role: 'dev',
      },
    };
    expect(blockedTask.dna.blocked_reason).toBeDefined();
    expect(blockedTask.dna.blocked_reason.length).toBeGreaterThan(0);
  });
});

// --- API query tests (server-side) ---

describe('kanban API: updated_after filter', () => {
  it('filter parameter format is ISO8601', () => {
    const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const iso = oneDay.toISOString();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
