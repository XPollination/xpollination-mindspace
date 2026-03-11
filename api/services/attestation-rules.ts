/**
 * Attestation rules engine.
 * Validates incoming attestation payloads against a set of rules.
 */

import type Database from 'better-sqlite3';
import { getRulesForCapability } from './rules-config.js';

interface RuleResult {
  rule: string;
  passed: boolean;
  message?: string;
}

interface Rule {
  name: string;
  validate: (db: Database.Database, attestation: any) => RuleResult;
}

const rules: Rule[] = [
  {
    name: 'tags_present',
    validate: (_db, att) => {
      const hasReqId = !!att.req_id;
      const hasTaskId = !!att.task_id;
      return {
        rule: 'tags_present',
        passed: hasReqId && hasTaskId,
        message: !hasReqId ? 'Missing req_id' : !hasTaskId ? 'Missing task_id' : undefined
      };
    }
  },
  {
    name: 'refs_valid',
    validate: (db, att) => {
      if (!att.task_id) {
        return { rule: 'refs_valid', passed: false, message: 'No task_id to validate' };
      }
      const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(att.task_id);
      return {
        rule: 'refs_valid',
        passed: !!task,
        message: task ? undefined : `Task ${att.task_id} not found in database`
      };
    }
  },
  {
    name: 'tests_tagged',
    validate: (_db, att) => {
      if (!att.test_results || !Array.isArray(att.test_results)) {
        return { rule: 'tests_tagged', passed: true, message: 'No test results to validate' };
      }
      const allTagged = att.test_results.every((t: any) => !!t.test_id);
      return {
        rule: 'tests_tagged',
        passed: allTagged,
        message: allTagged ? undefined : 'Some test results missing test_id'
      };
    }
  },
  {
    name: 'commits_formatted',
    validate: (_db, att) => {
      if (!att.commits || !Array.isArray(att.commits)) {
        return { rule: 'commits_formatted', passed: true, message: 'No commits to validate' };
      }
      const pattern = /^(feat|fix|chore|docs|test|refactor|style|ci|build|perf)(\(.+\))?:\s/;
      const allFormatted = att.commits.every((c: any) => pattern.test(c.message || ''));
      return {
        rule: 'commits_formatted',
        passed: allFormatted,
        message: allFormatted ? undefined : 'Some commit messages do not match type: pattern'
      };
    }
  }
];

/**
 * Validate an attestation against all rules.
 * Returns { valid: boolean, results: RuleResult[] }
 */
/**
 * Suggestion map: human-readable fix suggestions for each rule.
 */
export const SUGGESTION_MAP: Record<string, string> = {
  tags_present: 'Ensure both req_id and task_id are set on the attestation payload.',
  refs_valid: 'Verify the task_id references an existing task in the database.',
  tests_tagged: 'Add a test_id to every entry in the test_results array.',
  commits_formatted: 'Use conventional commit format: type(scope): description (e.g., feat: add login).'
};

export function validateAttestation(
  db: Database.Database,
  attestation: any
): { valid: boolean; results: RuleResult[] } {
  const results = rules.map(rule => rule.validate(db, attestation));
  const valid = results.every(r => r.passed);
  return { valid, results };
}
