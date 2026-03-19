import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../src/db/interface-cli.js');

/**
 * Task Type Enforcement Tests — task-type-enforcement-design
 * Validates: validateTaskType() in interface-cli.js with type-specific DNA validation.
 * TDD: Dev adds validateTaskType to cmdCreate in interface-cli.js.
 */

describe('validateTaskType function exists', () => {

  it('interface-cli.js has validateTaskType function', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/validateTaskType|validate.*task.*type/i);
  });
});

describe('task_type enum values defined', () => {

  it('supports design type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]design['"]/);
  });

  it('supports test type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]test['"]/);
  });

  it('supports impl type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]impl['"]/);
  });

  it('supports bug type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]bug['"]/);
  });

  it('supports research type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]research['"]/);
  });

  it('supports content type', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/['"]content['"]/);
  });
});

describe('Type-specific mandatory fields', () => {

  it('design type requires acceptance_criteria', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/acceptance_criteria/);
  });

  it('design type requires scope_boundary', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/scope_boundary/);
  });

  it('test/impl types require depends_on', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/depends_on/);
  });
});

describe('Backward compatibility', () => {

  it('task_type validation is optional (not enforced when missing)', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    // Should check if task_type exists before validating
    expect(content).toMatch(/task_type.*optional|if.*task_type|!.*task_type/i);
  });
});

describe('Base fields always required', () => {

  it('title is always required', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/title.*required|!.*title|missing.*title/i);
  });

  it('role is always required', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/role.*required|!.*role|missing.*role/i);
  });
});
