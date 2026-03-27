// Decision Twin — create, validate, diff
// Part of the Decision Interface: immutable decision chains with full conversation traceability.

const VALID_STATUSES = ['pending', 'resolved', 'expired', 'cancelled'];

export function createDecision(input) {
  const now = new Date().toISOString();
  return {
    _type: 'decision',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
    status: input.status || 'pending',
  };
}

export function validateDecision(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.frame || typeof twin.frame !== 'string') {
    errors.push('frame is required — context presented to decision-maker');
  }

  if (!Array.isArray(twin.options) || twin.options.length === 0) {
    errors.push('options[] is required — at least one choice must be presented');
  } else {
    for (const opt of twin.options) {
      if (!opt.id || !opt.label) {
        errors.push('each option must have id and label');
        break;
      }
    }
  }

  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Resolved decisions must have choice + resolved_by
  if (twin.status === 'resolved') {
    if (!twin.choice) errors.push('resolved decision must have choice');
    if (!twin.resolved_by) errors.push('resolved decision must have resolved_by');
  }

  // Chain integrity
  if (twin.chain_parent_cid && typeof twin.chain_parent_cid !== 'string') {
    warnings.push('chain_parent_cid should be a CID string');
  }

  // Task reference
  if (!twin.task_ref) {
    warnings.push('task_ref missing — decision not linked to a task');
  }

  // Human prompt (captures what the user actually said)
  if (twin.status === 'resolved' && !twin.human_prompt) {
    warnings.push('human_prompt missing — conversation traceability incomplete');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function diffDecision(current, original) {
  const changes = [];
  const fields = ['status', 'choice', 'reasoning', 'resolved_by', 'human_prompt', 'agent_response'];
  for (const field of fields) {
    if (current[field] !== original[field]) {
      changes.push({ field, from: original[field], to: current[field] });
    }
  }
  return { changed: changes.length > 0, changes };
}
