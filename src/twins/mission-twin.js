// Mission Twin — create, validate, diff

export function createMission(input) {
  return {
    _type: 'mission',
    _created_at: new Date().toISOString(),
    ...input,
  };
}

export function validateMission(twin) {
  const errors = [];

  if (!twin.id || typeof twin.id !== 'string') {
    errors.push('id is required');
  }

  if (!twin.title || typeof twin.title !== 'string') {
    errors.push('title is required');
  } else if (twin.title.length > 200) {
    errors.push('title must be <= 200 characters');
  }

  const VALID_STATUSES = ['draft', 'active'];
  if (!VALID_STATUSES.includes(twin.status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  if (twin.description !== undefined && typeof twin.description === 'string' && twin.description.length > 2000) {
    errors.push('description must be <= 2000 characters');
  }

  return { valid: errors.length === 0, errors };
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
