import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Workflow Engine in API Tests — ms-workflow-engine-in-api
 * Validates: API task-state-machine has full workflow engine gates.
 */

const API_BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test/api';

describe('API task state machine has full workflow engine', () => {

  it('task-state-machine.ts or task-transitions.ts has allowedActors', () => {
    const files = ['routes/task-transitions.ts', 'routes/task-state-machine.ts', 'services/workflow-engine.ts'];
    let found = false;
    for (const f of files) {
      const path = resolve(API_BASE, f);
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        if (content.match(/allowedActors/)) { found = true; break; }
      }
    }
    expect(found).toBe(true);
  });

  it('API has requiresDna validation', () => {
    const files = ['routes/task-transitions.ts', 'routes/task-state-machine.ts', 'services/workflow-engine.ts'];
    let found = false;
    for (const f of files) {
      const path = resolve(API_BASE, f);
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        if (content.match(/requiresDna|validateDna/)) { found = true; break; }
      }
    }
    expect(found).toBe(true);
  });

  it('API has liaison_review gate', () => {
    const files = ['routes/task-transitions.ts', 'routes/task-state-machine.ts', 'services/workflow-engine.ts'];
    let found = false;
    for (const f of files) {
      const path = resolve(API_BASE, f);
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        if (content.match(/liaison_review/)) { found = true; break; }
      }
    }
    expect(found).toBe(true);
  });

  it('API imports or includes workflow-engine.js logic', () => {
    const files = ['routes/task-transitions.ts', 'services/workflow-engine.ts', 'server.ts'];
    let found = false;
    for (const f of files) {
      const path = resolve(API_BASE, f);
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf-8');
        if (content.match(/workflow.engine|validateTransition|ALLOWED_TRANSITIONS/)) { found = true; break; }
      }
    }
    expect(found).toBe(true);
  });
});
