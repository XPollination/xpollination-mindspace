# PDSA: Attestation Rules Engine

**Task:** t2-2-rules-engine
**Status:** Design
**Version:** v0.0.1

## Plan

Engine that validates attestation payloads: checks tags_present, refs_valid, tests_tagged, commits_formatted. Only validates the attestation artifact, does NOT lint code.

### Dependencies
- t2-1-attestation-message (attestation format definition)
- ms-a3-2-state-machine

### Investigation

**Design decisions:**
1. New service: `api/services/attestation-rules.ts`
2. Rules as pluggable validators: `Rule = { name: string, validate: (attestation) => RuleResult }`
3. Built-in rules:
   - `tags_present`: all required tags (req_id, task_id, test_id) exist
   - `refs_valid`: referenced IDs exist in database
   - `tests_tagged`: test results include test IDs
   - `commits_formatted`: commit messages follow convention
4. `validateAttestation(db, attestation)` returns `{ valid: boolean, results: RuleResult[] }`
5. Each RuleResult: `{ rule: string, passed: boolean, message?: string }`

## Do

### File Changes

#### 1. `api/services/attestation-rules.ts` (CREATE)
```typescript
interface RuleResult {
  rule: string;
  passed: boolean;
  message?: string;
}

interface Rule {
  name: string;
  validate: (db: any, attestation: any) => RuleResult;
}

const RULES: Rule[] = [
  {
    name: 'tags_present',
    validate: (db, att) => {
      const required = ['req_id', 'task_id'];
      const missing = required.filter(tag => !att[tag]);
      return { rule: 'tags_present', passed: missing.length === 0, message: missing.length ? `Missing: ${missing.join(', ')}` : undefined };
    }
  },
  {
    name: 'refs_valid',
    validate: (db, att) => {
      if (att.task_id) {
        const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(att.task_id);
        if (!task) return { rule: 'refs_valid', passed: false, message: `Task ${att.task_id} not found` };
      }
      return { rule: 'refs_valid', passed: true };
    }
  },
  {
    name: 'tests_tagged',
    validate: (db, att) => {
      const tests = att.test_results || [];
      const untagged = tests.filter((t: any) => !t.test_id);
      return { rule: 'tests_tagged', passed: untagged.length === 0, message: untagged.length ? `${untagged.length} tests without test_id` : undefined };
    }
  },
  {
    name: 'commits_formatted',
    validate: (db, att) => {
      const commits = att.commits || [];
      const pattern = /^(feat|fix|docs|style|refactor|test|chore|pdsa):/;
      const invalid = commits.filter((c: any) => !pattern.test(c.message));
      return { rule: 'commits_formatted', passed: invalid.length === 0, message: invalid.length ? `${invalid.length} commits with invalid format` : undefined };
    }
  }
];

export function validateAttestation(db: any, attestation: any): { valid: boolean; results: RuleResult[] } {
  const results = RULES.map(rule => rule.validate(db, attestation));
  return { valid: results.every(r => r.passed), results };
}
```

#### 2. `api/routes/attestations.ts` (CREATE — validate endpoint)
```typescript
// POST /validate — validate attestation payload
router.post('/validate', (req, res) => {
  const db = getDb();
  const result = validateAttestation(db, req.body);
  res.status(result.valid ? 200 : 422).json(result);
});
```

## Study

### Test Cases (10)
1. Valid attestation with all tags → passes all rules
2. Missing req_id → tags_present fails
3. Invalid task_id reference → refs_valid fails
4. Tests without test_id → tests_tagged fails
5. Bad commit format → commits_formatted fails
6. Multiple failures returned together
7. Empty attestation → appropriate failures
8. Valid attestation returns 200
9. Invalid attestation returns 422
10. Rules are independent (one failure doesn't skip others)

## Act
- 1 new service, 1 new route
- No migration (validates payloads, not persisted)
