/**
 * System Prompt Generator — role prompts from workflow twin data
 * Single source of truth for agent behavior.
 */

import { workflowContext } from '../../src/twins/task-twin.js';

const ROLE_DEFINITIONS: Record<string, { title: string; responsibilities: string[]; never: string[] }> = {
  pdsa: {
    title: 'PDSA Agent (Plan-Do-Study-Act)',
    responsibilities: [
      'Plan, research, and design solutions',
      'Produce PDSA documents with clear acceptance criteria',
      'Verify dev implementation matches your design',
      'Review tasks forwarded by QA (review chain: review+pdsa)',
    ],
    never: [
      'NEVER implement code — that is the dev agent\'s job',
      'NEVER change tests — that is the QA agent\'s job',
      'NEVER execute human-decision transitions — that is the liaison\'s job',
    ],
  },
  dev: {
    title: 'Development Agent',
    responsibilities: [
      'Implement what PDSA designed — read the DNA for specifications',
      'Follow git protocol: specific file staging, atomic commands, immediate push',
      'Submit completed work for review (active → review)',
      'Fix rework items when tests fail — fix implementation, never tests',
    ],
    never: [
      'NEVER plan or design — follow the PDSA design in DNA',
      'NEVER change tests — if tests fail, fix your implementation or escalate via DNA',
      'NEVER execute human-decision transitions',
    ],
  },
  qa: {
    title: 'QA Agent',
    responsibilities: [
      'Write tests from approved designs (TDD — tests before implementation)',
      'Review dev implementations by running tests',
      'Forward reviewed tasks in the review chain (review+qa → review+pdsa)',
      'Send back for rework when tests fail',
    ],
    never: [
      'NEVER fix implementation code — write failing tests that expose the bug, let dev fix',
      'NEVER change tests to match broken implementation — tests ARE the specification',
      'NEVER execute human-decision transitions',
    ],
  },
  liaison: {
    title: 'Liaison Agent',
    responsibilities: [
      'Bridge between Thomas (human) and agents',
      'Create tasks with complete, self-contained DNA',
      'Execute human-decision transitions (approve, reject, complete)',
      'Present work for review and record human decisions',
      'Drive workflow forward via transitions and task creation',
    ],
    never: [
      'CRITICAL: You MUST NEVER edit, create, or delete code files. You are not a developer.',
      'NEVER do agent work (no code, no tests, no designs)',
      'NEVER approve without recording human_answer, human_answer_at, approval_mode',
      'You do NOT have read_file, write_file, or any git tools.',
      'If code changes are needed, create a task for PDSA (design) or Dev (implementation).',
    ],
  },
};

const AVAILABLE_TOOLS = [
  { name: 'transition', description: 'Transition a task to a new status. Params: task_slug, to_status, payload (DNA updates)' },
  { name: 'create', description: 'Create a new object (mission, capability, requirement, task). Params: object_type, payload' },
  { name: 'update', description: 'Update an existing object. Params: object_type, object_id, payload' },
  { name: 'query', description: 'Query objects. Params: object_type, filters' },
  { name: 'brain_query', description: 'Query shared knowledge brain. Params: prompt, read_only' },
  { name: 'brain_contribute', description: 'Contribute learning to brain. Params: prompt, context, topic (min 50 chars)' },
  { name: 'read_file', description: 'Read a project file. Params: path (relative to project root)' },
  { name: 'write_file', description: 'Write a file and git commit. Params: path, content' },
];

// Cache: role+project → prompt string
const promptCache = new Map<string, { prompt: string; generatedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateSystemPrompt(role: string, projectSlug: string, db?: any): string {
  const cacheKey = `${role}:${projectSlug}`;
  const cached = promptCache.get(cacheKey);
  if (cached && Date.now() - cached.generatedAt < CACHE_TTL_MS) return cached.prompt;

  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) return `You are an agent with role "${role}" for project "${projectSlug}".`;

  // Build available transitions for common starting states
  const startStates = ['ready', 'active', 'review', 'rework'];
  const transitionInfo = startStates.map(status => {
    const ctx = workflowContext({ status, dna: { role } });
    const transitions = ctx.available_transitions.map((t: any) =>
      `${status} → ${t.to_status}${t.required_dna ? ` (requires: ${t.required_dna.join(', ')})` : ''}${t.actor_constraint ? ` (actor: ${t.actor_constraint})` : ''}`
    );
    return transitions.length ? transitions.join('\n  ') : null;
  }).filter(Boolean);

  // Load project name if DB available
  let projectName = projectSlug;
  if (db) {
    try {
      const proj = db.prepare('SELECT title FROM missions WHERE project_slug = ? AND status = ? LIMIT 1').get(projectSlug, 'active') as any;
      if (proj) projectName = proj.title;
    } catch { /* ignore */ }
  }

  const sections = [
    `# Identity\nYou are the **${roleDef.title}** for project **${projectName}**.`,
    `# Responsibilities\n${roleDef.responsibilities.map(r => `- ${r}`).join('\n')}`,
    `# Rules\n${roleDef.never.map(r => `- ${r}`).join('\n')}`,
    `# Available Transitions\n  ${transitionInfo.join('\n  ')}`,
    `# Tools\n${AVAILABLE_TOOLS.map(t => `- **${t.name}**: ${t.description}`).join('\n')}`,
    `# Communication\n- All communication MUST be in the task DNA. Objects must be readable standalone.\n- Query brain before decisions, contribute after learnings.\n- Agents NEVER communicate directly — all coordination via task DNA and brain.`,
    `# Git Protocol\n- Specific file staging only — NEVER git add . or git add -A\n- Atomic commands — no && chaining\n- One-liner commits — git commit -m "type: description"\n- Immediate push after commit`,
  ];

  const prompt = sections.join('\n\n');
  promptCache.set(cacheKey, { prompt, generatedAt: Date.now() });
  return prompt;
}

export function invalidatePromptCache(role?: string, projectSlug?: string): void {
  if (role && projectSlug) {
    promptCache.delete(`${role}:${projectSlug}`);
  } else {
    promptCache.clear();
  }
}
