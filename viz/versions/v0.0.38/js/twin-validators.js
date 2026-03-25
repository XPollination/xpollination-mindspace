/**
 * Twin Validators — Browser-side validation for Digital Twins
 *
 * Port of src/twins/*.js validate functions. Pure field checks, no Node.js deps.
 * The browser validates before submitting — the server validates on receipt.
 * "The object validates itself."
 */

const MISSION_STATUSES = ['draft', 'ready', 'active', 'complete', 'deprecated'];
const CAPABILITY_STATUSES = ['draft', 'active', 'blocked', 'complete', 'cancelled'];
const REQUIREMENT_STATUSES = ['draft', 'active'];
const REQUIREMENT_PRIORITIES = ['low', 'medium', 'high', 'critical'];
const TASK_STATUSES = ['pending', 'ready', 'active', 'approval', 'approved', 'testing', 'review', 'rework', 'complete', 'blocked', 'cancelled'];
const TASK_ROLES = ['dev', 'pdsa', 'qa', 'liaison', 'orchestrator', 'system'];

const MISSION_SECTIONS = ['Vision', 'Rationale', 'Capabilities Composed', 'Current State', 'Evidence', 'Implementation Sequence', 'Gaps', 'Decision Trail', 'Changelog'];

export function validateMission(twin) {
  const errors = [];
  const warnings = [];
  if (!twin.id || typeof twin.id !== 'string') errors.push('id is required');
  if (!twin.title || typeof twin.title !== 'string') errors.push('title is required');
  else if (twin.title.length > 200) errors.push('title must be <= 200 characters');
  if (!MISSION_STATUSES.includes(twin.status)) errors.push(`status must be one of: ${MISSION_STATUSES.join(', ')}`);
  if (twin.description !== undefined && typeof twin.description === 'string' && twin.description.length > 2000) errors.push('description must be <= 2000 characters');
  // MissionInterface v1.0: section check
  const md = twin.content_md || '';
  const missing = md ? MISSION_SECTIONS.filter(s => !md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) : MISSION_SECTIONS;
  const present = MISSION_SECTIONS.length - missing.length;
  if (missing.length > 0) warnings.push(`MissionInterface v1.0: missing ${missing.length} sections: ${missing.join(', ')}`);
  return { valid: errors.length === 0, errors, warnings, interface_compliance: { interface: 'MissionInterface', version: '1.0', sections_present: present, sections_required: MISSION_SECTIONS.length, completeness_percent: Math.round((present / MISSION_SECTIONS.length) * 100) } };
}

const CAPABILITY_SECTIONS_V1 = ['What It Does', 'Why It Matters', 'Architecture', 'Reusability', 'Design Decisions', 'Current State'];

export function validateCapability(twin) {
  const errors = [];
  const warnings = [];
  if (!twin.mission_id || typeof twin.mission_id !== 'string') errors.push('mission_id is required');
  if (twin.title && twin.title.length > 200) errors.push('title must be <= 200 characters');
  if (!CAPABILITY_STATUSES.includes(twin.status)) errors.push(`status must be one of: ${CAPABILITY_STATUSES.join(', ')}`);
  if (twin.sort_order !== undefined && twin.sort_order < 0) errors.push('sort_order must be >= 0');
  const md = twin.content_md || '';
  const missing = md ? CAPABILITY_SECTIONS_V1.filter(s => !md.match(new RegExp('##\\s+.*' + s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))) : CAPABILITY_SECTIONS_V1;
  const present = CAPABILITY_SECTIONS_V1.length - missing.length;
  if (missing.length > 0) warnings.push(`CapabilityInterface v1.0: missing ${missing.length} sections: ${missing.join(', ')}`);
  return { valid: errors.length === 0, errors, warnings, interface_compliance: { interface: 'CapabilityInterface', version: '1.0', sections_present: present, sections_required: CAPABILITY_SECTIONS_V1.length, completeness_percent: Math.round((present / CAPABILITY_SECTIONS_V1.length) * 100) } };
}

export function validateRequirement(twin) {
  const errors = [];
  if (!twin.project_slug || typeof twin.project_slug !== 'string') errors.push('project_slug is required');
  const reqPattern = /^REQ-[A-Z0-9]{2,3}-\d{2,3}$/;
  if (!twin.req_id_human || !reqPattern.test(twin.req_id_human)) errors.push('req_id_human must match pattern REQ-XXX-### (e.g. REQ-A2A-001)');
  if (twin.title && twin.title.length > 200) errors.push('title must be <= 200 characters');
  if (!REQUIREMENT_STATUSES.includes(twin.status)) errors.push(`status must be one of: ${REQUIREMENT_STATUSES.join(', ')}`);
  if (!REQUIREMENT_PRIORITIES.includes(twin.priority)) errors.push(`priority must be one of: ${REQUIREMENT_PRIORITIES.join(', ')}`);
  return { valid: errors.length === 0, errors, warnings: [], interface_compliance: null };
}

export function validateTask(twin) {
  const errors = [];
  const warnings = [];
  if (!twin.slug || typeof twin.slug !== 'string') errors.push('slug is required');
  else if (!/^[a-z0-9-]+$/.test(twin.slug)) errors.push('slug must be lowercase with hyphens only');
  if (!TASK_STATUSES.includes(twin.status)) errors.push(`status must be one of: ${TASK_STATUSES.join(', ')}`);
  if (!twin.dna || !twin.dna.title) errors.push('dna.title is required');
  if (twin.dna && twin.dna.role && !TASK_ROLES.includes(twin.dna.role)) errors.push(`role must be one of: ${TASK_ROLES.join(', ')}`);
  return { valid: errors.length === 0, errors, warnings, interface_compliance: null };
}
