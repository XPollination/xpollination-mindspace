// Mission Twin — create, validate, diff

export function createMission(input) {
  const now = new Date().toISOString();
  return {
    _type: 'mission',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
  };
}

// MissionInterface v1.0 — 9 required sections (SKO Part 2)
const MISSION_SECTIONS = [
  'Vision', 'Rationale', 'Capabilities Composed', 'Current State',
  'Evidence', 'Implementation Sequence', 'Gaps', 'Decision Trail', 'Changelog'
];

export function validateMission(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.id || typeof twin.id !== 'string') {
    errors.push('id is required');
  }

  if (!twin.title || typeof twin.title !== 'string') {
    errors.push('title is required');
  } else if (twin.title.length > 200) {
    errors.push('title must be <= 200 characters');
  }

  const VALID_STATUSES = ['draft', 'ready', 'active', 'complete', 'deprecated'];
  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (twin.description !== undefined && typeof twin.description === 'string' && twin.description.length > 2000) {
    errors.push('description must be <= 2000 characters');
  }

  // MissionInterface v1.0: check required sections in content_md
  if (twin.content_md && typeof twin.content_md === 'string') {
    const md = twin.content_md;
    const missing = MISSION_SECTIONS.filter(s => !md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')));
    if (missing.length > 0) {
      warnings.push(`MissionInterface v1.0: missing sections (${missing.length}/${MISSION_SECTIONS.length}): ${missing.join(', ')}`);
    }
  } else if (twin.status === 'active' || twin.status === 'ready') {
    warnings.push('MissionInterface v1.0: content_md is empty — active/ready missions should have content');
  }

  const completeness = twin.content_md
    ? MISSION_SECTIONS.length - MISSION_SECTIONS.filter(s => !twin.content_md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))).length
    : 0;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    interface_compliance: {
      interface: 'MissionInterface',
      version: '1.0',
      sections_present: completeness,
      sections_required: MISSION_SECTIONS.length,
      completeness_percent: Math.round((completeness / MISSION_SECTIONS.length) * 100),
    }
  };
}

export function diffMission(current, original) {
  const diff = {};
  for (const key of Object.keys(current)) {
    if (key.startsWith('_')) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      diff[key] = { old: original[key], new: current[key] };
    }
  }
  return diff;
}
