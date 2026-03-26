/**
 * A2A Event Handler — routes SSE events to Claude API turns
 * Each event triggers a fresh Claude call with full context from the event.
 * Used by a2a-agent.js to process work autonomously.
 */

import { connect, startEventStream, sendMessage } from './a2a-agent.js';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.AGENT_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOOL_ROUNDS = 10;

// Tool definitions for Claude
const TOOLS = [
  { name: 'transition', description: 'Transition task to new status', input_schema: { type: 'object', properties: { task_slug: { type: 'string' }, to_status: { type: 'string' }, payload: { type: 'object' } }, required: ['task_slug', 'to_status'] } },
  { name: 'create', description: 'Create object (mission/capability/requirement/task)', input_schema: { type: 'object', properties: { object_type: { type: 'string' }, payload: { type: 'object' } }, required: ['object_type', 'payload'] } },
  { name: 'update', description: 'Update object', input_schema: { type: 'object', properties: { object_type: { type: 'string' }, object_id: { type: 'string' }, payload: { type: 'object' } }, required: ['object_type', 'object_id', 'payload'] } },
  { name: 'query', description: 'Query objects', input_schema: { type: 'object', properties: { object_type: { type: 'string' }, filters: { type: 'object' } }, required: ['object_type'] } },
  { name: 'brain_query', description: 'Query shared knowledge', input_schema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } },
  { name: 'brain_contribute', description: 'Contribute learning (min 50 chars)', input_schema: { type: 'object', properties: { prompt: { type: 'string' }, context: { type: 'string' } }, required: ['prompt'] } },
];

const TOOL_TO_A2A = { transition: 'TRANSITION', create: 'OBJECT_CREATE', update: 'OBJECT_UPDATE', query: 'OBJECT_QUERY', brain_query: 'BRAIN_QUERY', brain_contribute: 'BRAIN_CONTRIBUTE' };

async function executeTool(name, input) {
  const type = TOOL_TO_A2A[name];
  if (!type) return JSON.stringify({ error: `Unknown tool: ${name}` });
  try {
    const result = await sendMessage(type, input);
    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
}

async function handleEvent(eventType, data, systemPrompt) {
  if (!ANTHROPIC_API_KEY) {
    console.log(`[HANDLER] No ANTHROPIC_API_KEY — logging event: ${eventType} ${data.task_slug || ''}`);
    return;
  }

  console.log(`[HANDLER] Processing ${eventType}: ${data.task_slug || data.title || ''}`);

  const messages = [
    { role: 'user', content: `Workflow event received. Process it.\n\n**Event type:** ${eventType}\n**Data:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`\n\nAct on this event using your tools.` },
  ];

  let rounds = 0;
  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4096, system: systemPrompt, tools: TOOLS, messages }),
    });

    const response = await res.json();
    if (response.error) { console.error('[HANDLER] API error:', response.error.message); break; }

    const toolBlocks = (response.content || []).filter(b => b.type === 'tool_use');
    const textBlocks = (response.content || []).filter(b => b.type === 'text');

    if (textBlocks.length > 0) console.log(`[HANDLER] ${textBlocks[textBlocks.length - 1].text.slice(0, 200)}`);
    if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') break;

    messages.push({ role: 'assistant', content: response.content });
    const toolResults = [];
    for (const block of toolBlocks) {
      console.log(`[TOOL] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`);
      const result = await executeTool(block.name, block.input);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  console.log(`[HANDLER] Done (${rounds} rounds)`);
}

export { handleEvent, TOOLS };

// CLI entry: start agent with event handling
if (process.argv[1]?.endsWith('a2a-event-handler.js')) {
  const role = process.argv[2] || 'dev';
  const systemPrompt = `You are the ${role.toUpperCase()} agent. Process workflow events using your tools. Follow the workflow rules for your role.`;

  (async () => {
    process.env.AGENT_ROLE = role;
    // Override args for a2a-agent
    process.argv = [process.argv[0], process.argv[1], '--role', role];

    await connect();
    setInterval(() => sendMessage('HEARTBEAT').catch(() => {}), 25000);

    await startEventStream({
      task_assigned: (_, d) => handleEvent('task_assigned', d, systemPrompt),
      approval_needed: (_, d) => handleEvent('approval_needed', d, systemPrompt),
      review_needed: (_, d) => handleEvent('review_needed', d, systemPrompt),
      rework_needed: (_, d) => handleEvent('rework_needed', d, systemPrompt),
      connected: () => console.log('[A2A] Event handler ready'),
      default: (e, d) => console.log(`[SSE] ${e}: ${JSON.stringify(d).slice(0, 80)}`),
    });
  })();
}
