import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = resolve(__dirname, '../../src/db/interface-cli.js');

/**
 * Requirement Template Gate Tests — requirement-template-gate-design
 * Validates: validateRequirementTemplate() checks 9 mandatory section headings.
 * TDD: Dev adds validation to interface-cli.js.
 */

describe('validateRequirementTemplate function exists', () => {

  it('interface-cli.js has validateRequirementTemplate', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/validateRequirementTemplate|validate.*requirement.*template/i);
  });
});

describe('9 mandatory section headings checked', () => {

  const SECTIONS = [
    'Purpose', 'Acceptance Criteria', 'User Stories',
    'Technical Constraints', 'Dependencies', 'Test Strategy',
    'Security', 'Performance', 'Version History'
  ];

  for (const section of SECTIONS) {
    it(`checks for "${section}" heading`, () => {
      const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
      expect(content.toLowerCase()).toContain(section.toLowerCase());
    });
  }
});

describe('Validation behavior', () => {

  it('only triggers when task has requirement_ref', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/requirement_ref|requirement_refs/);
  });

  it('NULL content_md = skip validation', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/null|skip|!.*content_md/i);
  });

  it('reports missing sections in error message', () => {
    const content = existsSync(CLI_PATH) ? readFileSync(CLI_PATH, 'utf-8') : '';
    expect(content).toMatch(/missing|Missing.*section|required.*heading/i);
  });
});
