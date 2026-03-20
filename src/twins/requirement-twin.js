// Requirement Twin — create, validate, diff

export function createRequirement(input) {
  return {
    _type: 'requirement',
    _created_at: new Date().toISOString(),
    ...input,
  };
}

export function validateRequirement(twin) {
  const errors = [];

  if (!twin.project_slug || typeof twin.project_slug !== 'string') {
    errors.push('project_slug is required');
  }

  const reqPattern = /^REQ-[A-Z0-9]{2,3}-\d{2,3}$/;
  if (!twin.req_id_human || !reqPattern.test(twin.req_id_human)) {
    errors.push('req_id_human must match pattern REQ-XXX-### (e.g. REQ-A2A-001)');
  }

  if (twin.title && twin.title.length > 200) {
    errors.push('title must be <= 200 characters');
  }

  const VALID_STATUSES = ['draft', 'active'];
  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];
  if (!VALID_PRIORITIES.includes(twin.priority)) {
    errors.push(`priority must be one of: ${VALID_PRIORITIES.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

export function diffRequirement(current, original) {
  const diff = {};
  for (const key of Object.keys(current)) {
    if (key.startsWith('_')) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      diff[key] = { old: original[key], new: current[key] };
    }
  }
  return diff;
}
