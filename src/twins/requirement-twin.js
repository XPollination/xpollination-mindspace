// Requirement Twin — create, validate, diff

export function createRequirement(input) {
  const now = new Date().toISOString();
  return {
    _type: 'requirement',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
  };
}

// RequirementInterface v1.0 — 9 required sections (SKO Part 2)
const REQUIREMENT_SECTIONS = [
  'Statement', 'Rationale', 'Scope', 'Acceptance Criteria',
  'Behavior', 'Constraints', 'Dependencies', 'Verification', 'Change Impact'
];

export function validateRequirement(twin) {
  const errors = [];
  const warnings = [];

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

  // RequirementInterface v1.0: check required sections
  const md = twin.description || '';
  if (md.length > 100) {
    const missing = REQUIREMENT_SECTIONS.filter(s => !md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));
    const present = REQUIREMENT_SECTIONS.length - missing.length;
    if (missing.length > 0) {
      warnings.push(`RequirementInterface v1.0: missing sections (${missing.length}/${REQUIREMENT_SECTIONS.length}): ${missing.join(', ')}`);
    }
    return {
      valid: errors.length === 0, errors, warnings,
      interface_compliance: { interface: 'RequirementInterface', version: '1.0', sections_present: present, sections_required: REQUIREMENT_SECTIONS.length, completeness_percent: Math.round((present / REQUIREMENT_SECTIONS.length) * 100) }
    };
  }

  return { valid: errors.length === 0, errors, warnings, interface_compliance: null };
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
