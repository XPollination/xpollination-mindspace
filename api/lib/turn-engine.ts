/**
 * Turn Engine — stateless Claude API turns triggered by SSE events
 * Each turn is independent. No conversation history accumulation.
 * Context comes from: event payload, task DNA, brain, system prompt.
 */

import Anthropic from '@anthropic-ai/sdk';
import { generateSystemPrompt } from './system-prompts.js';
import { getDb } from '../db/connection.js';

const anthropic = new Anthropic();
const DEFAULT_MODEL = process.env.AGENT_MODEL || 'claude-sonnet-4-20250514';
const MAX_ITERATIONS = 10;

interface TurnResult {
  success: boolean;
  tool_calls: number;
  iterations: number;
  final_text: string;
  error?: string;
}

interface AgentSession {
  agent_id: string;
  user_id: string;
  project_slug: string;
  role: string;
}

// Tool definitions for Claude API
const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'transition',
    description: 'Transition a task to a new workflow status',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_slug: { type: 'string', description: 'Task slug or ID' },
        to_status: { type: 'string', description: 'Target status' },
        payload: { type: 'object', description: 'DNA updates to apply with transition' },
      },
      required: ['task_slug', 'to_status'],
    },
  },
  {
    name: 'create',
    description: 'Create a new object (mission, capability, requirement, task)',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_type: { type: 'string', enum: ['mission', 'capability', 'requirement', 'task'] },
        payload: { type: 'object', description: 'Object fields' },
      },
      required: ['object_type', 'payload'],
    },
  },
  {
    name: 'update',
    description: 'Update an existing object',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_type: { type: 'string', enum: ['mission', 'capability', 'requirement', 'task'] },
        object_id: { type: 'string', description: 'Object ID or slug' },
        payload: { type: 'object', description: 'Fields to update' },
      },
      required: ['object_type', 'object_id', 'payload'],
    },
  },
  {
    name: 'query',
    description: 'Query objects from the database',
    input_schema: {
      type: 'object' as const,
      properties: {
        object_type: { type: 'string', enum: ['mission', 'capability', 'requirement', 'task'] },
        filters: { type: 'object', description: 'Query filters (status, slug, id, etc.)' },
      },
      required: ['object_type'],
    },
  },
  {
    name: 'brain_query',
    description: 'Query the shared knowledge brain for relevant context',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'What to search for in brain' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'brain_contribute',
    description: 'Contribute a learning to the shared brain (min 50 chars)',
    input_schema: {
      type: 'object' as const,
      properties: {
        prompt: { type: 'string', description: 'The learning to contribute' },
        context: { type: 'string', description: 'Context (e.g. task slug)' },
        topic: { type: 'string', description: 'Topic category' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'read_file',
    description: 'Read a file from the project directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to project root' },
      },
      required: ['path'],
    },
  },
];

// Execute a tool call by routing to the appropriate A2A handler
async function executeTool(toolName: string, input: any, session: AgentSession): Promise<string> {
  const db = getDb();
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3100';

  try {
    switch (toolName) {
      case 'transition':
      case 'create':
      case 'update':
      case 'query':
      case 'brain_query':
      case 'brain_contribute': {
        const typeMap: Record<string, string> = {
          transition: 'TRANSITION',
          create: 'OBJECT_CREATE',
          update: 'OBJECT_UPDATE',
          query: 'OBJECT_QUERY',
          brain_query: 'BRAIN_QUERY',
          brain_contribute: 'BRAIN_CONTRIBUTE',
        };
        const body: any = { type: typeMap[toolName], agent_id: session.agent_id, ...input };
        const res = await fetch(`${baseUrl}/a2a/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return JSON.stringify(await res.json());
      }

      case 'read_file': {
        const { readFileSync } = await import('node:fs');
        const { resolve } = await import('node:path');
        const projectRoot = `/home/developer/workspaces/github/PichlerThomas/${session.project_slug}`;
        const fullPath = resolve(projectRoot, input.path);
        if (!fullPath.startsWith(projectRoot)) return JSON.stringify({ error: 'Path outside project directory' });
        return readFileSync(fullPath, 'utf-8').slice(0, 10000); // Cap at 10KB
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

// Tools available per role — liaison has NO file tools (defense-in-depth)
const LIAISON_EXCLUDED_TOOLS = new Set(['read_file', 'update']);
function getToolsForRole(role: string): Anthropic.Tool[] {
  if (role === 'liaison') return TOOL_DEFINITIONS.filter(t => !LIAISON_EXCLUDED_TOOLS.has(t.name));
  return TOOL_DEFINITIONS;
}

export async function executeTurn(event: any, session: AgentSession): Promise<TurnResult> {
  const db = getDb();
  const systemPrompt = generateSystemPrompt(session.role, session.project_slug || '', db);

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `You received a workflow event. Process it according to your role.\n\n**Event:**\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\`\n\nAct on this event using your available tools. When done, provide a brief summary of what you did.`,
    },
  ];

  let totalToolCalls = 0;
  let iterations = 0;
  let finalText = '';

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: getToolsForRole(session.role),
      messages,
    });

    // Collect text and tool use blocks
    const textBlocks = response.content.filter(b => b.type === 'text');
    const toolBlocks = response.content.filter(b => b.type === 'tool_use');

    if (textBlocks.length > 0) {
      finalText = (textBlocks[textBlocks.length - 1] as any).text;
    }

    // No tool calls → done
    if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') {
      break;
    }

    // Execute tool calls
    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolBlocks) {
      if (block.type !== 'tool_use') continue;
      totalToolCalls++;
      const result = await executeTool(block.name, block.input, session);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return { success: true, tool_calls: totalToolCalls, iterations, final_text: finalText };
}
