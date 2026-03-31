import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

// Path to the compiled mock-claude script
const MOCK_CLAUDE = resolve(__dirname, '../../../dist/src/xp0/test/mock-claude.js');

function runMockClaude(args: string[], env: Record<string, string> = {}): { stdout: string; exitCode: number } {
  try {
    const stdout = execFileSync('node', [MOCK_CLAUDE, ...args], {
      encoding: 'utf-8',
      timeout: 10000,
      env: { ...process.env, ...env },
    });
    return { stdout, exitCode: 0 };
  } catch (e: any) {
    return { stdout: e.stdout || '', exitCode: e.status ?? 1 };
  }
}

// ─── AC1: Accepts same CLI flags as real claude --print ───

describe('mock-claude CLI flags', () => {
  it('accepts --print -p "prompt"', () => {
    const { stdout, exitCode } = runMockClaude(['--print', '-p', 'hello world']);
    expect(exitCode).toBe(0);
    expect(stdout.length).toBeGreaterThan(0);
  });

  it('accepts --print -p "prompt" --output-format json', () => {
    const { stdout, exitCode } = runMockClaude(['--print', '-p', 'test', '--output-format', 'json']);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.type).toBe('result');
  });

  it('accepts --print -p "prompt" --output-format stream-json --verbose', () => {
    const { stdout, exitCode } = runMockClaude([
      '--print', '-p', 'test', '--output-format', 'stream-json', '--verbose',
    ]);
    expect(exitCode).toBe(0);
    const lines = stdout.trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('accepts --allowedTools flag without error', () => {
    const { exitCode } = runMockClaude([
      '--print', '-p', 'test', '--allowedTools', 'Read', 'Write',
    ]);
    expect(exitCode).toBe(0);
  });

  it('accepts --model flag without error', () => {
    const { exitCode } = runMockClaude([
      '--print', '-p', 'test', '--model', 'claude-sonnet-4-6',
    ]);
    expect(exitCode).toBe(0);
  });

  it('accepts --max-turns flag without error', () => {
    const { exitCode } = runMockClaude([
      '--print', '-p', 'test', '--max-turns', '3',
    ]);
    expect(exitCode).toBe(0);
  });
});

// ─── AC2: Output is deterministic (same input = same output) ───

describe('mock-claude determinism', () => {
  it('same prompt produces identical output', () => {
    const run1 = runMockClaude(['--print', '-p', 'determinism test prompt']);
    const run2 = runMockClaude(['--print', '-p', 'determinism test prompt']);
    expect(run1.stdout).toBe(run2.stdout);
  });

  it('different prompts produce different output', () => {
    const run1 = runMockClaude(['--print', '-p', 'prompt A']);
    const run2 = runMockClaude(['--print', '-p', 'prompt B']);
    expect(run1.stdout).not.toBe(run2.stdout);
  });
});

// ─── AC3: Output format matches claude --output-format json ───

describe('mock-claude JSON output format', () => {
  it('returns valid JSON with result structure', () => {
    const { stdout } = runMockClaude(['--print', '-p', 'test', '--output-format', 'json']);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.type).toBe('result');
    expect(parsed.subtype).toBe('success');
    expect(parsed.is_error).toBe(false);
    expect(typeof parsed.result).toBe('string');
    expect(typeof parsed.session_id).toBe('string');
  });

  it('includes duration and usage fields', () => {
    const { stdout } = runMockClaude(['--print', '-p', 'test', '--output-format', 'json']);
    const parsed = JSON.parse(stdout.trim());
    expect(typeof parsed.duration_ms).toBe('number');
    expect(typeof parsed.num_turns).toBe('number');
    expect(parsed.stop_reason).toBe('end_turn');
  });

  it('result field contains response text', () => {
    const { stdout } = runMockClaude(['--print', '-p', 'test', '--output-format', 'json']);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.result.length).toBeGreaterThan(0);
  });
});

// ─── AC3: Output format matches claude --output-format stream-json ───

describe('mock-claude stream-json output format', () => {
  it('outputs JSONL with init and result events', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'test', '--output-format', 'stream-json', '--verbose',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const events = lines.map(l => JSON.parse(l));

    // Should have at least init and result
    const init = events.find(e => e.type === 'system' && e.subtype === 'init');
    const result = events.find(e => e.type === 'result');
    expect(init).toBeDefined();
    expect(result).toBeDefined();
  });

  it('init event has session_id and model', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'test', '--output-format', 'stream-json', '--verbose',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const init = JSON.parse(lines[0]);
    expect(init.type).toBe('system');
    expect(init.subtype).toBe('init');
    expect(typeof init.session_id).toBe('string');
  });

  it('assistant event has message with content', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'test', '--output-format', 'stream-json', '--verbose',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const events = lines.map(l => JSON.parse(l));
    const assistant = events.find(e => e.type === 'assistant');
    expect(assistant).toBeDefined();
    expect(assistant.message.content).toBeDefined();
    expect(assistant.message.content[0].type).toBe('text');
  });

  it('result event has success subtype', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'test', '--output-format', 'stream-json', '--verbose',
    ]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const events = lines.map(l => JSON.parse(l));
    const result = events.find(e => e.type === 'result');
    expect(result!.subtype).toBe('success');
    expect(typeof result!.result).toBe('string');
  });
});

// ─── AC4: Failure mode configurable ───

describe('mock-claude failure modes', () => {
  it('exits with code 1 when MOCK_CLAUDE_EXIT_CODE=1', () => {
    const { exitCode } = runMockClaude(
      ['--print', '-p', 'test'],
      { MOCK_CLAUDE_EXIT_CODE: '1' },
    );
    expect(exitCode).toBe(1);
  });

  it('custom exit code via MOCK_CLAUDE_EXIT_CODE', () => {
    const { exitCode } = runMockClaude(
      ['--print', '-p', 'test'],
      { MOCK_CLAUDE_EXIT_CODE: '2' },
    );
    expect(exitCode).toBe(2);
  });

  it('MOCK_CLAUDE_RESPONSE overrides response content', () => {
    const customResponse = 'Custom override response';
    const { stdout } = runMockClaude(
      ['--print', '-p', 'test', '--output-format', 'json'],
      { MOCK_CLAUDE_RESPONSE: customResponse },
    );
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.result).toBe(customResponse);
  });
});

// ─── Task-type detection ───

describe('mock-claude task-type responses', () => {
  it('PDSA prompt generates design-related response', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'Create a proposed_design for the PDSA task',
      '--output-format', 'json',
    ]);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.result).toContain('design');
  });

  it('DEV prompt generates implementation-related response', () => {
    const { stdout } = runMockClaude([
      '--print', '-p', 'Implement the DEV implementation task',
      '--output-format', 'json',
    ]);
    const parsed = JSON.parse(stdout.trim());
    expect(parsed.result).toContain('implementation');
  });
});
