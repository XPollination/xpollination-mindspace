// Task Twin — create, validate, diff

const VALID_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
const VALID_ROLES = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'];

export function createTask(input) {
  const now = new Date().toISOString();
  return {
    _type: 'task',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
    status: input.status || 'pending',
  };
}

// TaskInterface v1.0 — type-specific required DNA fields (SKO Part 2)
const TASK_TYPE_FIELDS = {
  pdsa: { required: ['description', 'requirement_refs'], label: 'PDSA Design' },
  dev:  { required: ['description', 'requirement_refs'], label: 'DEV Implementation' },
  qa:   { required: ['description'], label: 'QA Test' },
};

export function validateTask(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.slug || typeof twin.slug !== 'string') {
    errors.push('slug is required');
  } else if (!/^[a-z0-9-]+$/.test(twin.slug)) {
    errors.push('slug must be lowercase with hyphens only');
  }

  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (!twin.dna || !twin.dna.title) {
    errors.push('dna.title is required');
  }

  if (twin.dna && twin.dna.role && !VALID_ROLES.includes(twin.dna.role)) {
    errors.push(`role must be one of: ${VALID_ROLES.join(', ')}`);
  }

  // TaskInterface v1.0: type-specific field checks
  const role = twin.dna?.role;
  const typeSpec = role ? TASK_TYPE_FIELDS[role] : null;
  let compliance = null;

  if (typeSpec && twin.dna) {
    const missing = typeSpec.required.filter(f => !twin.dna[f]);
    const present = typeSpec.required.length - missing.length;
    if (missing.length > 0) {
      warnings.push(`TaskInterface v1.0 (${typeSpec.label}): missing DNA fields: ${missing.join(', ')}`);
    }
    compliance = {
      interface: 'TaskInterface',
      version: '1.0',
      task_type: role,
      fields_present: present,
      fields_required: typeSpec.required.length,
      completeness_percent: Math.round((present / typeSpec.required.length) * 100),
    };
  }

  return { valid: errors.length === 0, errors, warnings, interface_compliance: compliance };
}

// Available transitions per status (from WORKFLOW.md v19)
const TRANSITIONS_BY_STATUS = {
  pending: [{ to_status: 'ready', actor_constraint: 'liaison' }, { to_status: 'cancelled', required_dna: ['abstract_ref'] }],
  ready: [{ to_status: 'active', required_dna: ['memory_query_session'] }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  active: [{ to_status: 'approval', required_dna: ['pdsa_ref', 'memory_contribution_id'] }, { to_status: 'review' }, { to_status: 'testing' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  approval: [{ to_status: 'approved', actor_constraint: 'liaison' }, { to_status: 'complete', actor_constraint: 'liaison', required_dna: ['abstract_ref'] }, { to_status: 'rework', actor_constraint: 'liaison' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  approved: [{ to_status: 'active' }, { to_status: 'testing' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  testing: [{ to_status: 'ready' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  review: [{ to_status: 'review' }, { to_status: 'complete', actor_constraint: 'liaison', required_dna: ['abstract_ref'] }, { to_status: 'rework' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  rework: [{ to_status: 'active' }, { to_status: 'blocked', required_dna: ['blocked_reason'] }],
  complete: [{ to_status: 'rework', actor_constraint: 'liaison' }],
  blocked: [{ to_status: 'restore' }],
  cancelled: [],
};

const VIZ_CATEGORIES = { pending: 'queue', ready: 'queue', rework: 'queue', active: 'active', testing: 'active', review: 'review', approval: 'review', approved: 'approved', complete: 'complete', blocked: 'blocked', cancelled: 'blocked' };

export function workflowContext(twin) {
  const status = twin.status || 'pending';
  const role = twin.dna?.role || null;
  const isTerminal = status === 'complete' || status === 'cancelled';
  const isBlocked = status === 'blocked';
  const transitions = TRANSITIONS_BY_STATUS[status] || [];
  return {
    current_state: status,
    current_role: role,
    available_transitions: transitions,
    is_terminal: isTerminal,
    is_blocked: isBlocked,
    progress: VIZ_CATEGORIES[status] || 'unknown',
  };
}

export function diffTask(current, original) {
  const diff = {};
  for (const key of Object.keys(current)) {
    if (key.startsWith('_')) continue;
    if (key === 'dna') {
      // Deep diff DNA fields
      const curDna = current.dna || {};
      const origDna = original.dna || {};
      for (const dnaKey of Object.keys(curDna)) {
        if (JSON.stringify(curDna[dnaKey]) !== JSON.stringify(origDna[dnaKey])) {
          diff[`dna.${dnaKey}`] = { old: origDna[dnaKey], new: curDna[dnaKey] };
        }
      }
      continue;
    }
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      diff[key] = { old: original[key], new: current[key] };
    }
  }
  return diff;
}
