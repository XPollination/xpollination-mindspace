import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Capability Brain Vectors Tests — graph-capability-brain-vectors
 * Validates: seed-capability-vectors.js script structure and data correctness.
 * TDD: Dev creates scripts/seed-capability-vectors.js to pass them.
 */

const SCRIPT_PATH = resolve(__dirname, '../../scripts/seed-capability-vectors.js');

const EXPECTED_CAPS = [
  'cap-auth', 'cap-task-engine', 'cap-agent-protocol', 'cap-foundation',
  'cap-quality', 'cap-graph', 'cap-viz', 'cap-provenance', 'cap-token'
];

describe('Script file exists', () => {

  it('scripts/seed-capability-vectors.js exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });
});

describe('Script defines all 9 capabilities', () => {

  it('script content mentions all 9 capability IDs', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    for (const cap of EXPECTED_CAPS) {
      expect(content).toContain(cap);
    }
  });

  it('script uses thought_category design_decision', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('design_decision');
  });

  it('script uses topic capability-seed', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toContain('capability-seed');
  });

  it('script includes verification queries', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    expect(content).toMatch(/authentication/i);
    expect(content).toMatch(/workflow/i);
  });
});

describe('Seed data quality', () => {

  it('each capability has natural language description with keywords', () => {
    const content = existsSync(SCRIPT_PATH) ? readFileSync(SCRIPT_PATH, 'utf-8') : '';
    // Each capability should have meaningful content, not just IDs
    const KEYWORDS = {
      'cap-auth': ['login', 'JWT'],
      'cap-task-engine': ['workflow', 'transition'],
      'cap-agent-protocol': ['agent', 'recovery'],
      'cap-foundation': ['database', 'deployment'],
      'cap-quality': ['test', 'review'],
      'cap-graph': ['hierarchy', 'navigation'],
      'cap-viz': ['dashboard', 'drill'],
      'cap-provenance': ['tracking', 'attribution'],
      'cap-token': ['token', 'value'],
    };
    for (const [cap, words] of Object.entries(KEYWORDS)) {
      for (const word of words) {
        expect(content.toLowerCase(), `${cap} should mention "${word}"`).toContain(word.toLowerCase());
      }
    }
  });
});

describe('Brain API integration (requires live Brain)', () => {

  const BRAIN_API_URL = process.env.BRAIN_API_URL || 'https://hive.xpollination.earth';
  const BRAIN_API_KEY = process.env.BRAIN_API_KEY;

  it.skipIf(!BRAIN_API_KEY)('semantic query "I need authentication" returns cap-auth', async () => {
    const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: 'I need authentication and login for users',
        agent_id: 'agent-qa',
        agent_name: 'QA',
        session_id: 'test-brain-vectors',
        read_only: true,
      }),
    });
    const data = await res.json();
    const sources = data.result?.sources || [];
    const found = sources.some((s: any) =>
      s.content_preview?.toLowerCase().includes('cap-auth') ||
      s.topic === 'capability-seed'
    );
    expect(found).toBe(true);
  });

  it.skipIf(!BRAIN_API_KEY)('semantic query "I need task workflow" returns cap-task-engine', async () => {
    const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: 'I need task workflow state machine with transitions',
        agent_id: 'agent-qa',
        agent_name: 'QA',
        session_id: 'test-brain-vectors',
        read_only: true,
      }),
    });
    const data = await res.json();
    const sources = data.result?.sources || [];
    const found = sources.some((s: any) =>
      s.content_preview?.toLowerCase().includes('cap-task-engine') ||
      s.content_preview?.toLowerCase().includes('workflow')
    );
    expect(found).toBe(true);
  });
});
