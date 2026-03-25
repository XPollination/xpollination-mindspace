// Station Twin — create, validate for P2P station discovery

export function createStation(input) {
  const now = new Date().toISOString();
  return {
    _type: 'station',
    _schema_version: '1.0.0',
    _created_at: now,
    _updated_at: now,
    ...input,
  };
}

export function validateStation(twin) {
  const errors = [];
  const warnings = [];

  if (!twin.station_id || typeof twin.station_id !== 'string') {
    errors.push('station_id is required');
  }

  if (!twin.station_name || typeof twin.station_name !== 'string') {
    errors.push('station_name is required');
  }

  if (!twin.hub_url || typeof twin.hub_url !== 'string') {
    errors.push('hub_url is required');
  } else if (!/^https?:\/\//.test(twin.hub_url)) {
    errors.push('hub_url must be a valid HTTP(S) URL');
  }

  if (!twin.trust_domain || typeof twin.trust_domain !== 'string') {
    errors.push('trust_domain is required');
  }

  if (!twin.schema_versions || typeof twin.schema_versions !== 'object') {
    errors.push('schema_versions is required');
  } else {
    if (!twin.schema_versions.twin) warnings.push('schema_versions.twin not set');
    if (!twin.schema_versions.a2a_protocol) warnings.push('schema_versions.a2a_protocol not set');
    if (!twin.schema_versions.station) warnings.push('schema_versions.station not set');
  }

  return { valid: errors.length === 0, errors, warnings };
}
