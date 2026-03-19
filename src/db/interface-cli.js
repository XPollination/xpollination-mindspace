#!/usr/bin/env node
/**
 * Database Interface CLI
 *
 * Regulated access to PM system database for agents.
 * Provides controlled operations with validation.
 *
 * Usage:
 *   node src/db/interface-cli.js <command> [args...]
 *
 * Commands:
 *   get <id|slug>                    - Get node by ID or slug
 *   list [--status=X] [--type=Y] [--role=Z]  - List nodes with filters
 *   transition <id> <newStatus> <actor>       - Change node status
 *   update-dna <id> <dnaJson> <actor>         - Update node DNA
 *   create <type> <slug> <dnaJson> <actor>    - Create new node
 *
 * Actors: dev, pdsa, qa, liaison, orchestrator, system
 */

import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { existsSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

// Import workflow engine (testable module)
import {
  VALID_STATUSES,
  VALID_TYPES,
  VALID_ROLES,
  ALLOWED_TRANSITIONS,
  validateTransition,
  getNewRoleForTransition,
  getClearsDnaForTransition,
  validateType,
  validateDnaRequirements,
  validateRoleConsistency
} from './workflow-engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Valid actors
const VALID_ACTORS = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'];

// Actor permissions matrix
const PERMISSIONS = {
  dev: {
    read: true,
    create: false,
    updateDna: true,
    transitions: ['active->review', 'ready->active']
  },
  pdsa: {
    read: true,
    create: true,
    updateDna: true,
    transitions: ['pending->ready', 'ready->active', 'active->review', 'review->complete', 'review->rework', 'rework->ready']
  },
  qa: {
    read: true,
    create: false,
    updateDna: true, // review fields only
    transitions: ['review->complete', 'review->rework']
  },
  liaison: {
    read: true,
    create: true,
    updateDna: true,
    transitions: 'all'
  },
  orchestrator: {
    read: true,
    create: false,
    updateDna: false,
    transitions: []
  },
  system: {
    read: true,
    create: true,
    updateDna: true,
    transitions: 'all'
  }
};

// Brain-write quality validation
const KNOWN_QUERY_PATTERNS = [
  /^Recovery protocol/i,
  /^Current task state/i,
  /TASK START or TASK BLOCKED markers/i,
  /What are my responsibilities/i
];

export function validateBrainWrite(prompt, slug) {
  if (typeof prompt !== 'string') {
    return { valid: false, reason: 'Prompt must be a string' };
  }

  const trimmed = prompt.trim();

  // Rule 4: slug near-duplicate (check before length rule)
  if (slug) {
    const withoutSlug = trimmed.replace(new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '').trim();
    if (withoutSlug.length < 50) {
      return { valid: false, reason: 'Rejected: near-duplicate of slug — add substantive content beyond the task name' };
    }
  }

  // Rule 2: too short
  if (trimmed.length < 50) {
    return { valid: false, reason: 'Rejected: too short (< 50 chars) — brain writes must be substantive' };
  }

  // Rule 1: interrogative
  if (trimmed.endsWith('?')) {
    return { valid: false, reason: 'Rejected: interrogative (ends with ?) — queries are reads, not writes' };
  }

  // Rule 3: known query patterns
  for (const pattern of KNOWN_QUERY_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: 'Rejected: matches known query pattern — only contribute conclusions, not search queries' };
    }
  }

  return { valid: true };
}

// DNA Field Validators - reject invalid data at write time
const FIELD_VALIDATORS = {
  // Validate status field
  status: (value) => {
    if (!VALID_STATUSES.includes(value)) {
      return `Invalid status: "${value}". Valid: ${VALID_STATUSES.join(', ')}`;
    }
    return null;
  },

  // Validate role field
  role: (value) => {
    if (!VALID_ROLES.includes(value)) {
      return `Invalid role: "${value}". Valid: ${VALID_ROLES.join(', ')}`;
    }
    return null;
  },

  // Validate pdsa_file field (must be existing file path)
  pdsa_file: (value) => {
    if (typeof value !== 'string') {
      return `pdsa_file must be a string path`;
    }
    if (!existsSync(value)) {
      return `pdsa_file does not exist: "${value}"`;
    }
    if (!value.endsWith('.pdsa.md')) {
      return `pdsa_file must end with .pdsa.md: "${value}"`;
    }
    return null;
  },

  // Validate pdsa_ref field (must be a GitHub link — enforces git protocol)
  pdsa_ref: (value) => {
    // Must be a string
    if (typeof value !== 'string') {
      return `pdsa_ref must be a GitHub link (https://github.com/...), not ${typeof value}`;
    }

    // Must be a GitHub URL — local paths are rejected to enforce git protocol
    if (!value.startsWith('https://github.com/')) {
      return `pdsa_ref must be a GitHub link (https://github.com/...). Local file paths are not allowed. Execute git protocol first (git add, git commit, git push), then use the GitHub URL. Current value rejected: "${value}"`;
    }

    return null;
  },

  // Validate test_pass_count (non-negative integer)
  test_pass_count: (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0) {
      return `test_pass_count must be a non-negative integer (>= 0), got: "${value}"`;
    }
    return null;
  },

  // Validate test_total_count (positive integer, must have tests)
  test_total_count: (value) => {
    const num = Number(value);
    if (!Number.isInteger(num) || num <= 0) {
      return `test_total_count must be a positive integer (> 0), got: "${value}"`;
    }
    return null;
  }
};

// Validate DNA fields before write
function validateDnaFields(dna) {
  const errors = [];

  for (const [field, validator] of Object.entries(FIELD_VALIDATORS)) {
    if (dna[field] !== undefined) {
      const errorMsg = validator(dna[field]);
      if (errorMsg) {
        errors.push(errorMsg);
      }
    }
  }

  return errors;
}

function getDb() {
  const dbPath = process.env.DATABASE_PATH || join(__dirname, '../../data/xpollination.db');
  const db = new Database(dbPath);
  // Set busy_timeout = 5000ms to handle WAL contention gracefully
  // Without this, concurrent writes fail immediately with SQLITE_BUSY
  db.pragma('busy_timeout = 5000');
  return db;
}

function output(data) {
  console.log(JSON.stringify(data, null, 2));
}

function error(message) {
  console.error(JSON.stringify({ error: message }));
  process.exit(1);
}

function checkPermission(actor, operation, extra = null) {
  if (!VALID_ACTORS.includes(actor)) {
    error(`Invalid actor: ${actor}. Valid: ${VALID_ACTORS.join(', ')}`);
  }

  const perms = PERMISSIONS[actor];

  if (operation === 'read' && !perms.read) {
    error(`Actor "${actor}" not allowed to read`);
  }
  if (operation === 'create' && !perms.create) {
    error(`Actor "${actor}" not allowed to create nodes`);
  }
  if (operation === 'updateDna' && !perms.updateDna) {
    error(`Actor "${actor}" not allowed to update DNA`);
  }
  if (operation === 'transition') {
    const transition = extra; // "fromStatus->toStatus"
    if (perms.transitions !== 'all' && !perms.transitions.includes(transition)) {
      error(`Actor "${actor}" not allowed transition: ${transition}`);
    }
  }
}

// Commands

function cmdGet(idOrSlug) {
  const db = getDb();

  // Try by ID first, then by slug
  let node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ?').get(idOrSlug);
  if (!node) {
    node = db.prepare('SELECT * FROM mindspace_nodes WHERE slug = ?').get(idOrSlug);
  }

  if (!node) {
    error(`Node not found: ${idOrSlug}`);
  }

  // Parse JSON fields
  node.dna = JSON.parse(node.dna_json);
  node.parent_ids = node.parent_ids ? JSON.parse(node.parent_ids) : [];
  delete node.dna_json;

  output(node);
  db.close();
}

function cmdList(filters) {
  const db = getDb();

  let query = 'SELECT * FROM mindspace_nodes WHERE 1=1';
  const params = [];

  if (filters.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.type) {
    query += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.role) {
    query += ` AND json_extract(dna_json, '$.role') = ?`;
    params.push(filters.role);
  }

  query += ' ORDER BY updated_at DESC';

  const nodes = db.prepare(query).all(...params);

  // Parse JSON fields
  const result = nodes.map(node => ({
    id: node.id,
    type: node.type,
    status: node.status,
    slug: node.slug,
    title: JSON.parse(node.dna_json).title || node.slug,
    role: JSON.parse(node.dna_json).role || null,
    updated_at: node.updated_at
  }));

  output({ count: result.length, nodes: result });
  db.close();
}

// --- Brain Gate: transaction integrity for transitions ---

function guessProject(dbPath) {
  if (!dbPath) return 'unknown';
  // Extract project name dynamically from path: .../ProjectName/data/xpollination.db
  const parts = dbPath.split('/');
  const dataIdx = parts.lastIndexOf('data');
  if (dataIdx > 0) return parts[dataIdx - 1];
  return 'unknown';
}

function checkBrainHealth(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3200/api/v1/health', { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve(data.status === 'ok');
        } catch { resolve(false); }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function contributeToBrain(prompt, actor, slug, timeoutMs = 5000) {
  const validation = validateBrainWrite(prompt, slug);
  if (!validation.valid) {
    console.error(`[brain-write-quality] ${validation.reason}: "${prompt.substring(0, 80)}..."`);
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const project = guessProject(process.env.DATABASE_PATH);
    const data = JSON.stringify({
      prompt,
      agent_id: `agent-${actor}`,
      agent_name: actor.toUpperCase(),
      context: `task: ${slug}`,
      thought_category: 'transition_marker',
      topic: slug
    });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (process.env.BRAIN_API_KEY) headers['Authorization'] = `Bearer ${process.env.BRAIN_API_KEY}`;
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers,
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(true));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(data);
    req.end();
  });
}

async function microGarden(slug, project, dna, timeoutMs = 5000) {
  const title = dna.title || slug;
  const findings = dna.findings
    ? (typeof dna.findings === 'string' ? dna.findings : JSON.stringify(dna.findings)).substring(0, 200)
    : 'N/A';
  const impl = dna.implementation?.summary || dna.implementation?.commit || 'N/A';
  const pdsaVerdict = dna.pdsa_review?.verdict || 'N/A';
  const qaVerdict = dna.qa_review?.verdict || 'N/A';

  const summary = `TASK SUMMARY: ${title} (${project}). ` +
    `Findings: ${findings}. Implementation: ${impl}. ` +
    `Reviews: PDSA=${pdsaVerdict}, QA=${qaVerdict}.`;

  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: summary,
      agent_id: 'system',
      agent_name: 'GARDENER',
      context: `auto-garden on complete: ${slug}`,
      thought_category: 'task_summary',
      topic: slug
    });
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (process.env.BRAIN_API_KEY) headers['Authorization'] = `Bearer ${process.env.BRAIN_API_KEY}`;
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers,
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: 'ok', summary_contributed: true }));
    });
    req.on('error', () => resolve({ status: 'skipped', reason: 'brain error' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'skipped', reason: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

async function cmdTransition(id, newStatus, actor, extraArgs = []) {
  if (!VALID_STATUSES.includes(newStatus) && newStatus !== 'restore') {
    error(`Invalid status: ${newStatus}. Valid: ${VALID_STATUSES.join(', ')}, restore`);
  }

  // Brain gate: health-check before any DB changes
  const brainHealthy = await checkBrainHealth();
  if (!brainHealthy) {
    error('Brain unavailable — cannot document transition. Wait or escalate. Use blocked state if infrastructure is down.');
  }

  const db = getDb();

  // Get current node
  const node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ? OR slug = ?').get(id, id);
  if (!node) {
    error(`Node not found: ${id}`);
  }

  const fromStatus = node.status;
  const nodeType = node.type;
  const dna = JSON.parse(node.dna_json || '{}');
  const currentRole = dna.role || null;

  // Narrow immutability bypass: complete→rework needs rework_target_role in DNA
  // Accept it as a transition parameter since update-dna blocks complete tasks
  if (fromStatus === 'complete' && newStatus === 'rework') {
    const reworkTargetArg = extraArgs.find(a => a.startsWith('--rework-target-role='));
    if (reworkTargetArg) {
      dna.rework_target_role = reworkTargetArg.split('=')[1];
    }
  }

  // Handle blocked→restore: read stored state from DNA and restore
  let effectiveNewStatus = newStatus;
  let restoreRole = null;
  if (newStatus === 'restore' && fromStatus === 'blocked') {
    if (!dna.blocked_from_state || !dna.blocked_from_role) {
      db.close();
      error('Cannot restore: blocked_from_state or blocked_from_role missing from DNA');
    }
    effectiveNewStatus = dna.blocked_from_state;
    restoreRole = dna.blocked_from_role;
  }

  const transition = `${fromStatus}->${effectiveNewStatus}`;

  // Handle any→blocked: store current state for later restoration
  if (effectiveNewStatus === 'blocked') {
    // any->blocked is allowed for all agents (infrastructure failure)
    if (!dna.blocked_reason) {
      db.close();
      error('blocked_reason required in DNA before transitioning to blocked');
    }
    dna.blocked_from_state = fromStatus;
    dna.blocked_from_role = currentRole;
    dna.blocked_at = new Date().toISOString();

    db.prepare(`
      UPDATE mindspace_nodes
      SET status = 'blocked', dna_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(dna), node.id);

    const result = {
      success: true,
      id: node.id,
      slug: node.slug,
      transition: `${fromStatus}->blocked`,
      actor: actor,
      blocked: { from_state: fromStatus, from_role: currentRole, reason: dna.blocked_reason }
    };

    // Brain marker for blocked transition
    const project = guessProject(process.env.DATABASE_PATH);
    await contributeToBrain(
      `TASK BLOCKED: ${actor.toUpperCase()} ${node.slug} (${project}) — ${dna.blocked_reason}`,
      actor,
      node.slug
    );

    output(result);
    db.close();
    return;
  }

  // Handle blocked→restore: restore exact previous state+role
  if (newStatus === 'restore' && fromStatus === 'blocked') {
    // Only liaison/system can unblock
    if (!['liaison', 'system'].includes(actor)) {
      db.close();
      error(`Only liaison or system can restore blocked tasks. Actor: ${actor}`);
    }

    const restoredDna = { ...dna, role: restoreRole };
    delete restoredDna.blocked_from_state;
    delete restoredDna.blocked_from_role;
    delete restoredDna.blocked_reason;
    delete restoredDna.blocked_at;

    db.prepare(`
      UPDATE mindspace_nodes
      SET status = ?, dna_json = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(effectiveNewStatus, JSON.stringify(restoredDna), node.id);

    const result = {
      success: true,
      id: node.id,
      slug: node.slug,
      transition: `blocked->restore(${effectiveNewStatus})`,
      actor: actor,
      restored: { state: effectiveNewStatus, role: restoreRole }
    };

    // Brain marker for restore
    const project = guessProject(process.env.DATABASE_PATH);
    await contributeToBrain(
      `TASK RESTORED: ${actor.toUpperCase()} ${node.slug} (${project}) — restored to ${effectiveNewStatus}+${restoreRole}`,
      actor,
      node.slug
    );

    output(result);
    db.close();
    return;
  }

  // Standard transition flow
  // Detect role-specific fallback to generic transition and warn
  if (currentRole) {
    const roleSpecificKey = `${fromStatus}->${newStatus}:${currentRole}`;
    const genericKey = `${fromStatus}->${newStatus}`;
    const typeRules = ALLOWED_TRANSITIONS[nodeType] || {};
    if (!typeRules[roleSpecificKey] && typeRules[genericKey]) {
      console.warn(`[workflow] No role-specific transition ${roleSpecificKey} — fallback to generic ${genericKey}`);
    }
  }

  // Validate transition against whitelist
  const validationError = validateTransition(nodeType, fromStatus, newStatus, actor, currentRole);
  if (validationError) {
    db.close();
    error(validationError);
  }

  // Validate DNA requirements for this transition (e.g., pdsa_ref required for approval)
  const dnaError = validateDnaRequirements(nodeType, fromStatus, newStatus, dna, currentRole, actor);
  if (dnaError) {
    db.close();
    error(dnaError);
  }

  // Dependency gates: only for pending→ready transitions
  if (fromStatus === 'pending' && newStatus === 'ready') {
    const dependsOn = Array.isArray(dna.depends_on) ? dna.depends_on : [];

    // Gate A: Dependency-aware scheduling — all depends_on tasks must be complete
    if (dependsOn.length > 0) {
      const incomplete = [];
      for (const depSlug of dependsOn) {
        const depNode = db.prepare('SELECT status FROM mindspace_nodes WHERE slug = ?').get(depSlug);
        if (!depNode) {
          db.close();
          error(`Dependency not found: ${depSlug}. All depends_on slugs must exist.`);
        }
        if (depNode.status !== 'complete') {
          incomplete.push(depSlug);
        }
      }
      if (incomplete.length > 0) {
        db.close();
        error(`Dependency scheduling gate: incomplete dependencies block pending→ready. Incomplete: ${incomplete.join(', ')}`);
      }
    }

    // Gate B: Dependency reflection — must have depends_on OR depends_on_reviewed=true
    if (dependsOn.length === 0 && dna.depends_on_reviewed !== true) {
      db.close();
      error('Dependency reflection gate: depends_on_reviewed must be true when depends_on is empty or missing. Set depends_on_reviewed=true in DNA to confirm dependencies were considered.');
    }
  }

  // Version enforcement gate v2: fires on active→approval and active→review for design tasks
  // Guard clause: only applies when pdsa_ref exists (design tasks only)
  if (fromStatus === 'active' && (newStatus === 'approval' || newStatus === 'review') && dna.pdsa_ref) {
    const versionMatch = (dna.pdsa_ref || '').match(/v0\.0\.(\d+)/);
    const currentVersion = versionMatch ? parseInt(versionMatch[1]) : 0;
    const isRework = !!(dna.liaison_rework_reason || dna.rework_reason || (dna.rework_count >= 1));

    if (isRework) {
      // Rework: version must be > 1 (never submit rework on v0.0.1)
      if (currentVersion <= 1) {
        db.close();
        error(`Rework version gate: pdsa_ref references v0.0.${currentVersion || '?'}. Rework submissions require a new version (v0.0.2+). Never update v0.0.1 in place — create a new version directory.`);
      }
      // Rework: rework_context required
      if (!dna.rework_context) {
        db.close();
        error('Rework version gate: rework_context required in DNA when rework indicators are present.');
      }
      // LIAISON rework: verbatim human quote enforcement (skip for short feedback <20 chars)
      if (dna.liaison_rework_reason && dna.liaison_rework_reason.length > 20) {
        const snippet = dna.liaison_rework_reason.substring(0, 50);
        if (!dna.rework_context.includes(snippet)) {
          db.close();
          error('Rework version gate: rework_context must contain verbatim human feedback quote. Expected substring not found.');
        }
      }
    } else {
      // First submission: must use v0.0.1
      if (currentVersion !== 1) {
        db.close();
        error(`Version gate: first submission pdsa_ref must reference v0.0.1, found v0.0.${currentVersion || '?'}. First submissions always start at v0.0.1.`);
      }
    }
  }

  // Changelog quality gate: complete transition requires changelog_ref for tasks with pdsa_ref
  if (newStatus === 'complete' && dna.pdsa_ref) {
    if (!dna.changelog_ref) {
      db.close();
      error('Changelog quality gate: changelog_ref missing in DNA. Every completed design task must include a changelog_ref (git link to changelog.md in the version directory).');
    }
  }

  // LIAISON approval mode enforcement gate
  const transitionKey = `${fromStatus}->${newStatus}`;
  const typeTransitions = ALLOWED_TRANSITIONS[nodeType] || {};
  let transitionRule = currentRole ? typeTransitions[`${transitionKey}:${currentRole}`] : null;
  if (!transitionRule) transitionRule = typeTransitions[transitionKey];
  if (!transitionRule) transitionRule = typeTransitions[`any->${newStatus}`];

  if (transitionRule?.requiresHumanConfirm && actor === 'liaison') {
    // Human answer audit trail gate (v0.0.19) — applies in ALL modes
    const validApprovalModes = ['auto', 'semi', 'auto-approval', 'manual'];
    if (!dna.human_answer) {
      db.close();
      error(`Human answer audit gate: human_answer required in DNA for ${transitionKey} (liaison). Set dna.human_answer to the exact human decision text.`);
    }
    if (!dna.human_answer_at) {
      db.close();
      error(`Human answer audit gate: human_answer_at required in DNA for ${transitionKey} (liaison). Set dna.human_answer_at to ISO timestamp of when human answered.`);
    }
    if (!dna.approval_mode) {
      db.close();
      error(`Human answer audit gate: approval_mode required in DNA for ${transitionKey} (liaison). Set dna.approval_mode to one of: ${validApprovalModes.join(', ')}.`);
    }
    if (!validApprovalModes.includes(dna.approval_mode)) {
      db.close();
      error(`Human answer audit gate: invalid approval_mode '${dna.approval_mode}'. Must be one of: ${validApprovalModes.join(', ')}.`);
    }

    // Viz confirmation gate (v0.0.18) — mode-specific enforcement
    db.prepare("CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run();
    const mode = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
    const modeValue = mode?.value || 'auto';
    const isCompletionTransition = (newStatus === 'complete');
    const requiresVizConfirm = (modeValue === 'manual') || (modeValue === 'auto-approval' && isCompletionTransition);

    if (requiresVizConfirm) {
      if (!dna.human_confirmed) {
        db.close();
        error(`LIAISON ${modeValue} mode: ${transitionKey} requires human confirmation via mindspace viz.`);
      }
      if (dna.human_confirmed_via !== 'viz') {
        db.close();
        error(`LIAISON ${modeValue} mode: ${transitionKey} requires human_confirmed_via='viz'. Current: '${dna.human_confirmed_via || 'none'}'.`);
      }
      delete dna.human_confirmed;
      delete dna.human_confirmed_via;
    }
  }

  // Clear DNA fields if transition requires it (e.g., rework clears memory fields)
  const fieldsToClear = getClearsDnaForTransition(nodeType, fromStatus, newStatus, currentRole);
  if (fieldsToClear.length > 0) {
    for (const field of fieldsToClear) {
      delete dna[field];
    }
  }

  // Check if role should change on this transition (currentRole needed for role-specific rules)
  let newRole = getNewRoleForTransition(nodeType, fromStatus, newStatus, currentRole);

  // Per WORKFLOW.md rework entry table: review+liaison→rework uses explicit rework_target_role
  // rework_target_role is required in DNA (enforced by workflow-engine requiresDna gate)
  if (fromStatus === 'review' && newStatus === 'rework' && currentRole === 'liaison') {
    if (!dna.rework_target_role) {
      db.close();
      error('rework_target_role required in DNA for review+liaison→rework. LIAISON must specify which role reworks: dev, pdsa, qa, or liaison.');
    }
    if (!VALID_ROLES.includes(dna.rework_target_role)) {
      db.close();
      error(`Invalid rework_target_role: ${dna.rework_target_role}. Valid: ${VALID_ROLES.join(', ')}`);
    }
    newRole = dna.rework_target_role;
  }

  // Per WORKFLOW.md: complete->rework uses dna.rework_target_role (human specifies re-entry point)
  if (fromStatus === 'complete' && newStatus === 'rework' && dna.rework_target_role) {
    if (!VALID_ROLES.includes(dna.rework_target_role)) {
      db.close();
      error(`Invalid rework_target_role: ${dna.rework_target_role}. Valid: ${VALID_ROLES.join(', ')}`);
    }
    newRole = dna.rework_target_role;
  }

  // Role consistency enforcement: reject transitions that produce wrong role for fixed-role states
  const effectiveRole = newRole || currentRole;
  const consistencyError = validateRoleConsistency(newStatus, effectiveRole);
  if (consistencyError) {
    db.close();
    error(consistencyError);
  }

  let updatedDna = dna;
  if (newRole && newRole !== currentRole) {
    updatedDna = { ...dna, role: newRole };
  }

  // Perform transition inside db.transaction() to prevent TOCTOU race conditions
  // between the read (line ~410) and write — ensures atomic read-modify-write
  const dnaChanged = (newRole && newRole !== currentRole) || fieldsToClear.length > 0;

  const performTransition = db.transaction(() => {
    let updateResult;
    if (dnaChanged) {
      updateResult = db.prepare(`
        UPDATE mindspace_nodes
        SET status = ?, dna_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newStatus, JSON.stringify(updatedDna), node.id);
    } else {
      updateResult = db.prepare(`
        UPDATE mindspace_nodes
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(newStatus, node.id);
    }

    // Check .changes — if 0 rows affected, the UPDATE silently failed
    if (updateResult.changes === 0) {
      throw new Error(`Transition UPDATE affected 0 rows for node ${node.id}. Possible SQLITE_BUSY lock contention or node was deleted.`);
    }

    // Verification read-back: confirm role persisted correctly after UPDATE
    const verifyNode = db.prepare('SELECT status, dna_json FROM mindspace_nodes WHERE id = ?').get(node.id);
    if (!verifyNode) {
      throw new Error(`Verification read-back failed: node ${node.id} not found after UPDATE`);
    }
    if (verifyNode.status !== newStatus) {
      throw new Error(`Verification read-back failed: expected status="${newStatus}" but got "${verifyNode.status}"`);
    }
    if (dnaChanged) {
      const verifyDna = JSON.parse(verifyNode.dna_json);
      const expectedRole = newRole || currentRole;
      if (verifyDna.role !== expectedRole) {
        throw new Error(`Verification read-back failed: expected role="${expectedRole}" but got "${verifyDna.role}". Role change did not persist.`);
      }
    }

    return updateResult;
  });

  try {
    performTransition();
  } catch (err) {
    db.close();
    error(`Transition failed: ${err.message}`);
  }

  const result = {
    success: true,
    id: node.id,
    slug: node.slug,
    transition: transition,
    actor: actor
  };

  if (newRole && newRole !== currentRole) {
    result.roleChanged = { from: currentRole, to: newRole };
  }

  if (fieldsToClear.length > 0) {
    result.dnaCleared = fieldsToClear;
  }

  // Brain marker: contribute transition marker with context after successful DB update
  const project = guessProject(process.env.DATABASE_PATH);
  const title = updatedDna.title || node.slug;
  const outcome = updatedDna.implementation || updatedDna.findings || updatedDna.qa_review || '';
  const outcomeSummary = outcome ? ` — ${String(outcome).substring(0, 120)}` : '';
  await contributeToBrain(
    `TASK ${fromStatus}→${newStatus}: ${actor.toUpperCase()} ${node.slug} (${project}) — ${title}${outcomeSummary}`,
    actor,
    node.slug
  );

  // NotificationService: Write to /tmp/human-notification.json on approval transition
  if (newStatus === 'approval') {
    const notification = {
      timestamp: new Date().toISOString(),
      node_id: node.id,
      slug: node.slug,
      title: updatedDna.title || node.slug,
      requires: 'Thomas approval',
      link: `viz/index.html?id=${node.id}`
    };
    writeFileSync('/tmp/human-notification.json', JSON.stringify(notification, null, 2));
    result.notification = 'Written to /tmp/human-notification.json';
  }

  // Auto micro-garden on complete transition (Layer 3)
  if (newStatus === 'complete') {
    const gardenResult = await microGarden(node.slug, project, updatedDna);
    if (gardenResult) result.gardening = gardenResult;
  }

  output(result);
  db.close();
}

function cmdUpdateDna(id, dnaJson, actor) {
  checkPermission(actor, 'updateDna');

  let dna;
  try {
    dna = JSON.parse(dnaJson);
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
  }

  // Validate DNA fields before write
  const validationErrors = validateDnaFields(dna);
  if (validationErrors.length > 0) {
    error(`Validation failed:\n${validationErrors.join('\n')}`);
  }

  // Protection: LIAISON cannot set human_confirmed via CLI
  if (actor === 'liaison' && dna.human_confirmed !== undefined) {
    error('human_confirmed can only be set via mindspace viz (human action). LIAISON agents cannot set this field.');
  }

  const db = getDb();

  // Get current node
  const node = db.prepare('SELECT * FROM mindspace_nodes WHERE id = ? OR slug = ?').get(id, id);
  if (!node) {
    error(`Node not found: ${id}`);
  }

  // Immutability rule: complete tasks cannot be modified
  if (node.status === 'complete') {
    db.close();
    error(`Cannot modify complete task [${node.slug}]. Create a child task instead.`);
  }

  // Merge DNA (preserve existing fields)
  const existingDna = JSON.parse(node.dna_json);
  const mergedDna = { ...existingDna, ...dna };

  // Update
  db.prepare(`
    UPDATE mindspace_nodes
    SET dna_json = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(JSON.stringify(mergedDna), node.id);

  output({
    success: true,
    id: node.id,
    slug: node.slug,
    actor: actor
  });

  db.close();
}

/**
 * Validate task_type field and enforce type-specific mandatory DNA fields.
 * task_type is optional for backward compat — only validated when set.
 * Types: 'design', 'test', 'impl', 'bug', 'research', 'content'
 */
const VALID_TASK_TYPES = ['design', 'test', 'impl', 'bug', 'research', 'content'];

function validateTaskType(dna) {
  const errors = [];

  // Base fields always required: title and role
  if (!dna.title) errors.push('title is required — missing title in DNA');
  if (!dna.role) errors.push('role is required — missing role in DNA');

  // task_type is optional — if not set, skip type-specific validation
  if (!dna.task_type) return errors;

  if (!VALID_TASK_TYPES.includes(dna.task_type)) {
    errors.push(`Invalid task_type: "${dna.task_type}". Valid: ${VALID_TASK_TYPES.join(', ')}`);
    return errors;
  }

  // Type-specific mandatory fields
  if (dna.task_type === 'design') {
    if (!dna.acceptance_criteria) errors.push('design type requires acceptance_criteria');
    if (!dna.scope_boundary) errors.push('design type requires scope_boundary');
  }

  if (dna.task_type === 'test' || dna.task_type === 'impl') {
    if (!dna.depends_on || (Array.isArray(dna.depends_on) && dna.depends_on.length === 0)) {
      errors.push(`${dna.task_type} type requires depends_on — must reference the design task`);
    }
  }

  return errors;
}

function cmdCreate(type, slug, dnaJson, actor) {
  checkPermission(actor, 'create');

  // Validate type - only task and bug allowed
  if (!VALID_TYPES.includes(type)) {
    error(`Invalid type: "${type}". Only allowed: ${VALID_TYPES.join(', ')}. Use 'task' for features/requirements, 'bug' for fixes.`);
  }

  let dna;
  try {
    dna = JSON.parse(dnaJson);
  } catch (e) {
    error(`Invalid JSON: ${e.message}`);
  }

  // Validate DNA fields before write
  const validationErrors = validateDnaFields(dna);
  if (validationErrors.length > 0) {
    error(`Validation failed:\n${validationErrors.join('\n')}`);
  }

  // Validate task_type and type-specific fields
  const typeErrors = validateTaskType(dna);
  if (typeErrors.length > 0) {
    error(`Task type validation failed:\n${typeErrors.join('\n')}`);
  }

  // Bug type requires parent_ids — every bug must link to the task it originated from
  if (type === 'bug') {
    if (!Array.isArray(dna.parent_ids) || dna.parent_ids.length === 0) {
      error('Bug type requires parent_ids — every bug must link to the task it originated from. Provide parent_ids as a non-empty array in DNA.');
    }
  }

  const db = getDb();

  // Check slug uniqueness
  const existing = db.prepare('SELECT id FROM mindspace_nodes WHERE slug = ?').get(slug);
  if (existing) {
    error(`Slug already exists: ${slug}`);
  }

  const id = randomUUID();

  // Auto-detect versioned_component from group field
  // VIZ group → versioned_component=viz, WORKFLOW → workflow, etc.
  const GROUP_TO_VERSIONED_COMPONENT = { VIZ: 'viz', WORKFLOW: 'workflow', API: 'api', BRAIN: 'brain' };
  if (!dna.versioned_component && dna.group) {
    const mapped = GROUP_TO_VERSIONED_COMPONENT[dna.group.toUpperCase()];
    if (mapped) dna.versioned_component = mapped;
  }

  // Extract parent_ids from DNA into its own column (avoid duplication)
  const parentIds = dna.parent_ids ? JSON.stringify(dna.parent_ids) : null;
  if (dna.parent_ids) delete dna.parent_ids;

  db.prepare(`
    INSERT INTO mindspace_nodes (id, type, status, slug, parent_ids, dna_json, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?, ?, datetime('now'), datetime('now'))
  `).run(id, type, slug, parentIds, JSON.stringify(dna));

  output({
    success: true,
    id: id,
    slug: slug,
    type: type,
    status: 'pending',
    actor: actor
  });

  db.close();
}

function cmdCapabilityStatus() {
  const db = getDb();

  // Check if capabilities table exists
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='capabilities'"
  ).get();
  if (!tableExists) {
    output({ capabilities: [], message: 'capabilities table not found' });
    db.close();
    return;
  }

  const capabilities = db.prepare(
    'SELECT c.id, c.title, c.status, c.mission_id, m.title AS mission_title FROM capabilities c LEFT JOIN missions m ON c.mission_id = m.id ORDER BY c.sort_order'
  ).all();

  const result = capabilities.map(cap => {
    const taskSlugs = db.prepare(
      'SELECT task_slug FROM capability_tasks WHERE capability_id = ?'
    ).all(cap.id).map(r => r.task_slug);

    let completeCount = 0;
    for (const slug of taskSlugs) {
      const node = db.prepare(
        'SELECT status FROM mindspace_nodes WHERE slug = ?'
      ).get(slug);
      if (node && node.status === 'complete') {
        completeCount++;
      }
    }

    const taskCount = taskSlugs.length;
    const progressPercent = taskCount > 0 ? Math.round((completeCount / taskCount) * 100) : 0;

    return {
      id: cap.id,
      title: cap.title,
      status: cap.status,
      mission_id: cap.mission_id,
      mission_title: cap.mission_title,
      task_count: taskCount,
      complete_count: completeCount,
      progress_percent: progressPercent
    };
  });

  output({ capabilities: result });
  db.close();
}

// Main — guarded so import doesn't trigger CLI execution
const __isMainCli = process.argv[1] && (
  process.argv[1].includes('interface-cli') ||
  fileURLToPath(import.meta.url) === process.argv[1]
);

if (__isMainCli) {

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.log(`
Database Interface CLI - Regulated PM System Access

Usage:
  node src/db/interface-cli.js <command> [args...]

Commands:
  get <id|slug>                              Get node by ID or slug
  list [--status=X] [--type=Y] [--role=Z]    List nodes with filters
  transition <id> <newStatus> <actor>        Change node status
  update-dna <id> <dnaJson> <actor>          Update node DNA (merge)
  create <type> <slug> <dnaJson> <actor>     Create new node

Status values: ${VALID_STATUSES.join(', ')}
Actors: ${VALID_ACTORS.join(', ')}

Examples:
  node src/db/interface-cli.js get my-task-slug
  node src/db/interface-cli.js list --status=ready --role=dev
  node src/db/interface-cli.js transition my-task active dev
  node src/db/interface-cli.js update-dna my-task '{"response":"done"}' pdsa
`);
  process.exit(0);
}

switch (command) {
  case 'get':
    if (!args[1]) error('Usage: get <id|slug>');
    cmdGet(args[1]);
    break;

  case 'list': {
    const filters = {};
    for (let i = 1; i < args.length; i++) {
      const match = args[i].match(/^--(\w+)=(.+)$/);
      if (match) {
        filters[match[1]] = match[2];
      }
    }
    cmdList(filters);
    break;
  }

  case 'transition':
    if (!args[1] || !args[2] || !args[3]) {
      error('Usage: transition <id|slug> <newStatus> <actor>');
    }
    await cmdTransition(args[1], args[2], args[3], args.slice(4));
    break;

  case 'update-dna':
    if (!args[1] || !args[2] || !args[3]) {
      error('Usage: update-dna <id|slug> <dnaJson> <actor>');
    }
    cmdUpdateDna(args[1], args[2], args[3]);
    break;

  case 'create':
    if (!args[1] || !args[2] || !args[3] || !args[4]) {
      error('Usage: create <type> <slug> <dnaJson> <actor>');
    }
    cmdCreate(args[1], args[2], args[3], args[4]);
    break;

  case 'capability-status':
    cmdCapabilityStatus();
    break;

  default:
    error(`Unknown command: ${command}`);
}

} // end __isMainCli guard
