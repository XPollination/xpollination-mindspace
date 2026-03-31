#!/usr/bin/env node

const args = process.argv.slice(2);

// Environment overrides
const exitCode = parseInt(process.env.MOCK_CLAUDE_EXIT_CODE || '0', 10);
const delayMs = parseInt(process.env.MOCK_CLAUDE_DELAY_MS || '0', 10);

// Parse CLI flags
let prompt = '';
let outputFormat = 'text';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-p') {
    prompt = args[++i] || '';
  } else if (args[i] === '--output-format') {
    outputFormat = args[++i] || 'text';
  } else if (args[i] === '--verbose' || args[i] === '--print') {
    // flag-only, no value to skip
  } else if (args[i] === '--model' || args[i] === '--max-turns') {
    i++; // skip value
  } else if (args[i] === '--allowedTools') {
    while (i + 1 < args.length && !args[i + 1].startsWith('-')) i++;
  }
}

// Deterministic hash
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const h = hash(prompt);
const sessionId = `mock-${h.toString(16).padStart(8, '0')}-0000-0000-0000-000000000000`;

// Detect task type and generate response
function generateResponse(): string {
  if (process.env.MOCK_CLAUDE_RESPONSE) return process.env.MOCK_CLAUDE_RESPONSE;
  const lower = prompt.toLowerCase();
  if (lower.includes('pdsa') || lower.includes('proposed_design') || lower.includes('design')) {
    return `Mock PDSA design response (hash: ${h}). Proposed design with architecture decisions.`;
  }
  if (lower.includes('dev') || lower.includes('implement')) {
    return `Mock DEV implementation response (hash: ${h}). Implementation complete with files changed.`;
  }
  if (lower.includes('qa') || lower.includes('test')) {
    return `Mock QA test response (hash: ${h}). Test plan created with coverage report.`;
  }
  if (lower.includes('review')) {
    return `Mock review response (hash: ${h}). Findings: review_status approved.`;
  }
  return `Mock response (hash: ${h}) for: ${prompt.substring(0, 50)}`;
}

async function main(): Promise<void> {
  if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  if (exitCode !== 0) process.exit(exitCode);

  const response = generateResponse();

  if (outputFormat === 'json') {
    process.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: response,
        session_id: sessionId,
        duration_ms: 42,
        num_turns: 1,
        stop_reason: 'end_turn',
      }) + '\n',
    );
  } else if (outputFormat === 'stream-json') {
    process.stdout.write(
      JSON.stringify({ type: 'system', subtype: 'init', session_id: sessionId, model: 'mock-claude' }) + '\n',
    );
    process.stdout.write(
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: response }] } }) + '\n',
    );
    process.stdout.write(
      JSON.stringify({
        type: 'result',
        subtype: 'success',
        result: response,
        session_id: sessionId,
        duration_ms: 42,
        num_turns: 1,
        stop_reason: 'end_turn',
      }) + '\n',
    );
  } else {
    process.stdout.write(response + '\n');
  }
}

main();
