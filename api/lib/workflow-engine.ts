/**
 * Config-Driven Workflow Engine
 *
 * Reads workflow.yaml and provides validation, routing, and instruction building.
 * The engine is GENERIC — all process logic comes from the config.
 * Change the config → change the workflow. No code changes.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYaml } from 'yaml';

export interface TransitionConfig {
  actors: string[];
  gates: string[];
  event: string | null;
  target_role?: string;
}

export interface GateConfig {
  type: string;
  field?: string;
  validate: string;
  error: string;
  allowed?: string[];
}

export interface InstructionConfig {
  context: string;
  read: string[];
  do: string;
  produce: Record<string, string>;
  brain?: string;
  transition_to: string;
  or_rework?: string;
  gates_to_pass: string[];
}

export interface WorkflowConfig {
  transitions: Record<string, Record<string, TransitionConfig>>;
  gates: Record<string, GateConfig>;
  validators: Record<string, string>;
  role_routing: {
    fixed_roles: Record<string, string>;
    review_chain: Array<{ from: string; next: string }>;
  };
  instructions: Record<string, InstructionConfig>;
  blocked: {
    save_fields: string[];
    restore_fields: string[];
    clear_on_restore: string[];
  };
  lease: { ttl_minutes: number };
  cascade: { on_complete: string; auto_transition: string };
}

let config: WorkflowConfig | null = null;
let configPath: string = '';

export function loadConfig(path?: string): WorkflowConfig {
  configPath = path || resolve(process.cwd(), 'api/config/workflow.yaml');
  const raw = readFileSync(configPath, 'utf8');
  config = parseYaml(raw) as WorkflowConfig;
  return config;
}

export function getConfig(): WorkflowConfig {
  if (!config) loadConfig();
  return config!;
}

/**
 * Validate a transition: check it exists, actor is allowed, all gates pass.
 */
export function validateTransition(
  fromStatus: string,
  toStatus: string,
  actorRole: string,
  dna: Record<string, unknown>,
  db?: any,
): { valid: boolean; error?: string; gate?: string } {
  const cfg = getConfig();

  // 1. Check transition exists
  const fromMap = cfg.transitions[fromStatus];
  if (!fromMap) return { valid: false, error: `No transitions from status: ${fromStatus}` };

  const transition = fromMap[toStatus];
  if (!transition) return { valid: false, error: `Invalid transition: ${fromStatus} → ${toStatus}` };

  // 2. Check actor is allowed
  if (!transition.actors.includes('any') && !transition.actors.includes('matching_role')) {
    if (!transition.actors.includes(actorRole)) {
      return { valid: false, error: `Actor '${actorRole}' not allowed for ${fromStatus} → ${toStatus}. Allowed: ${transition.actors.join(', ')}` };
    }
  }

  // 3. Run each gate
  for (const gateName of transition.gates) {
    const gate = cfg.gates[gateName];
    if (!gate) continue; // unknown gate — skip

    if (gate.type === 'custom') {
      // Custom validators (dependency_check, etc.)
      if (gate.validate === 'all_depends_on_complete' && db) {
        const dependsOn = dna.depends_on as string[] | undefined;
        if (dependsOn && dependsOn.length > 0) {
          for (const depSlug of dependsOn) {
            const dep = db.prepare('SELECT status FROM tasks WHERE slug = ?').get(depSlug) as any;
            if (!dep || dep.status !== 'complete') {
              return { valid: false, error: `${gate.error}: ${depSlug} is not complete`, gate: gateName };
            }
          }
        }
      }
      continue;
    }

    // Field-based gates
    const value = dna[gate.field!];

    if (gate.validate === 'non_empty') {
      if (value == null || value === '') {
        return { valid: false, error: gate.error, gate: gateName };
      }
    } else if (gate.validate === 'github_url') {
      if (typeof value !== 'string' || !value.startsWith('https://github.com/')) {
        return { valid: false, error: gate.error, gate: gateName };
      }
    } else if (gate.validate === 'min_length_10') {
      if (typeof value !== 'string' || value.length < 10) {
        return { valid: false, error: gate.error, gate: gateName };
      }
    } else if (gate.validate === 'one_of') {
      const allowed = gate.allowed || [];
      if (!allowed.includes(value as string)) {
        return { valid: false, error: gate.error, gate: gateName };
      }
    }
  }

  return { valid: true };
}

/**
 * Resolve target role for a transition.
 */
export function getTargetRole(
  fromStatus: string,
  toStatus: string,
  dna: Record<string, unknown>,
  currentRole?: string,
): string | null {
  const cfg = getConfig();
  const transition = cfg.transitions[fromStatus]?.[toStatus];
  if (!transition?.target_role) return null;

  switch (transition.target_role) {
    case 'from_dna':
      return (dna.role as string) || null;

    case 'from_review_chain': {
      const chain = cfg.role_routing.review_chain;
      const entry = chain.find((c) => c.from === currentRole);
      return entry?.next || null;
    }

    case 'from_rework_target':
      return (dna.rework_target_role as string) || null;

    case 'from_blocked_state':
      return (dna.blocked_from_role as string) || null;

    default:
      // Fixed role name (e.g., "liaison", "qa", "dev")
      return transition.target_role;
  }
}

/**
 * Get the event to fire for a transition.
 */
export function getEvent(fromStatus: string, toStatus: string): string | null {
  const cfg = getConfig();
  return cfg.transitions[fromStatus]?.[toStatus]?.event || null;
}

/**
 * Get the fixed role for a state (if any).
 */
export function getFixedRole(status: string): string | null {
  const cfg = getConfig();
  return cfg.role_routing.fixed_roles[status] || null;
}

/**
 * Get instructions for a role.
 */
export function getInstructions(role: string, context?: string): InstructionConfig | null {
  const cfg = getConfig();
  // Try specific context first (e.g., qa_review vs qa_test)
  if (context && cfg.instructions[`${role}_${context}`]) {
    return cfg.instructions[`${role}_${context}`];
  }
  return cfg.instructions[role] || null;
}

/**
 * Get available transitions from a status.
 */
export function getAvailableTransitions(status: string): Array<{ to: string; actors: string[]; gates: string[] }> {
  const cfg = getConfig();
  const fromMap = cfg.transitions[status];
  if (!fromMap) return [];

  return Object.entries(fromMap).map(([to, t]) => ({
    to,
    actors: t.actors,
    gates: t.gates,
  }));
}

/**
 * Build instruction text for tmux delivery.
 */
export function buildInstructionText(
  role: string,
  task: any,
  dna: Record<string, unknown>,
  instructionContext?: string,
): string {
  const instr = getInstructions(role, instructionContext);
  if (!instr) return `Work on task: ${task.slug} — ${task.title}`;

  const readFields = instr.read
    .map((f) => {
      const val = dna[f];
      if (!val) return null;
      return `${f}: ${typeof val === 'string' ? val.substring(0, 200) : JSON.stringify(val).substring(0, 200)}`;
    })
    .filter(Boolean)
    .join('\n');

  const produceList = Object.entries(instr.produce)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  return [
    `[TASK] ${task.slug} — ${task.title}`,
    `Role: ${role} | Transition to: ${instr.transition_to}`,
    ``,
    `Instructions: ${instr.do}`,
    ``,
    readFields ? `Context:\n${readFields}` : '',
    ``,
    `Produce:\n${produceList}`,
    instr.or_rework ? `\nOr rework: ${instr.or_rework}` : '',
    instr.gates_to_pass.length > 0 ? `\nGates: ${instr.gates_to_pass.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
