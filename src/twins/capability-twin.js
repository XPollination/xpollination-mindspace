// Capability Twin — create, validate, diff

export function createCapability(input) {
  return {
    _type: 'capability',
    _created_at: new Date().toISOString(),
    ...input,
  };
}

// CapabilityInterface v1.0 — 6 required sections (SKO Part 2)
const CAPABILITY_SECTIONS = [
  'What It Does', 'Why It Matters', 'Architecture',
  'Reusability', 'Design Decisions', 'Current State'
];

export function validateCapability(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.mission_id || typeof twin.mission_id !== 'string') {
    errors.push('mission_id is required');
  }

  if (twin.title && twin.title.length > 200) {
    errors.push('title must be <= 200 characters');
  }

  const VALID_STATUSES = ['draft', 'active', 'blocked', 'complete', 'cancelled'];
  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (twin.sort_order !== undefined && twin.sort_order < 0) {
    errors.push('sort_order must be >= 0');
  }

  // CapabilityInterface v1.0: check required sections
  const md = twin.content_md || '';
  const missing = md ? CAPABILITY_SECTIONS.filter(s => !md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) : CAPABILITY_SECTIONS;
  const present = CAPABILITY_SECTIONS.length - missing.length;
  if (missing.length > 0) {
    warnings.push(`CapabilityInterface v1.0: missing sections (${missing.length}/${CAPABILITY_SECTIONS.length}): ${missing.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    interface_compliance: {
      interface: 'CapabilityInterface',
      version: '1.0',
      sections_present: present,
      sections_required: CAPABILITY_SECTIONS.length,
      completeness_percent: Math.round((present / CAPABILITY_SECTIONS.length) * 100),
    }
  };
}

export function diffCapability(current, original) {
  const diff = {};
  for (const key of Object.keys(current)) {
    if (key.startsWith('_')) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      diff[key] = { old: original[key], new: current[key] };
    }
  }
  return diff;
}
