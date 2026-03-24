/**
 * Twin Formatter — wraps raw DB rows into Digital Twin format
 *
 * Uses the existing twin modules (src/twins/) to produce structured,
 * validated, self-describing objects. The API returns these to browsers
 * and agents via A2A OBJECT_DATA messages.
 */

import { createMission, validateMission } from '../../src/twins/mission-twin.js';
import { createCapability, validateCapability } from '../../src/twins/capability-twin.js';
import { createRequirement, validateRequirement } from '../../src/twins/requirement-twin.js';
import { createTask, validateTask } from '../../src/twins/task-twin.js';

export function formatMissionTwin(row: any) {
  const twin = createMission({
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    slug: row.slug || undefined,
    short_id: row.short_id || undefined,
    content_md: row.content_md || undefined,
    content_version: row.content_version || 0,
    project_slug: row.project_slug || undefined,
  });
  const validation = validateMission(twin);
  return { ...twin, _valid: validation.valid, _errors: validation.errors };
}

export function formatCapabilityTwin(row: any) {
  let dependencyIds: string[] = [];
  try {
    dependencyIds = JSON.parse(row.dependency_ids || '[]');
  } catch { /* ignore */ }

  const twin = createCapability({
    id: row.id,
    mission_id: row.mission_id,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    sort_order: row.sort_order ?? 0,
    short_id: row.short_id || undefined,
    dependency_ids: dependencyIds,
    content_md: row.content_md || undefined,
    content_version: row.content_version || 0,
  });
  const validation = validateCapability(twin);
  return { ...twin, _valid: validation.valid, _errors: validation.errors };
}

export function formatRequirementTwin(row: any) {
  const twin = createRequirement({
    id: row.id,
    project_slug: row.project_slug,
    capability_id: row.capability_id,
    req_id_human: row.req_id_human,
    title: row.title,
    description: row.description || undefined,
    status: row.status,
    priority: row.priority || 'medium',
    short_id: row.short_id || undefined,
  });
  const validation = validateRequirement(twin);
  return { ...twin, _valid: validation.valid, _errors: validation.errors };
}

export function formatTaskTwin(row: any) {
  let dna: any = {};
  if (row.dna_json) {
    try { dna = JSON.parse(row.dna_json); } catch { /* ignore */ }
  }
  if (row.dna && typeof row.dna === 'object') {
    dna = { ...dna, ...row.dna };
  }

  const twin = createTask({
    slug: row.slug || row.id,
    status: row.status,
    dna: {
      title: row.title || dna.title || row.slug || row.id,
      role: row.current_role || dna.role || undefined,
      description: row.description || dna.description || undefined,
      ...dna,
    },
    project_slug: row.project_slug || undefined,
    requirement_id: row.requirement_id || undefined,
  });
  const validation = validateTask(twin);
  return { ...twin, _valid: validation.valid, _errors: validation.errors };
}
