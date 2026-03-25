// Task Twin — create, validate, diff

const VALID_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
const VALID_ROLES = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'];

export function createTask(input) {
  return {
    _type: 'task',
    _created_at: new Date().toISOString(),
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
