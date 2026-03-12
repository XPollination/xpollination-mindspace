import { getDb } from '../db/connection.js';

// Default fallback rules when no config exists for a project/capability
const DEFAULT_RULES = [
  { name: 'tags_present', required: true },
  { name: 'refs_valid', required: true }
];

interface RulesConfig {
  id: string;
  project_slug: string;
  capability_id: string | null;
  rules: any[];
  rules_version: number;
}

/**
 * Get rules for a specific project and capability.
 * Falls back to project-level rules, then default rules if no config exists.
 */
export function getRulesForCapability(
  projectSlug: string,
  capabilityId?: string | null
): { rules: any[]; rules_version: number; source: string } {
  const db = getDb();

  // Try capability-specific rules first
  if (capabilityId) {
    const capRules = db.prepare(
      'SELECT * FROM attestation_rules WHERE project_slug = ? AND capability_id = ? ORDER BY created_at DESC LIMIT 1'
    ).get(projectSlug, capabilityId) as any;

    if (capRules) {
      return {
        rules: JSON.parse(capRules.rules || '[]'),
        rules_version: capRules.rules_version,
        source: 'capability'
      };
    }
  }

  // Fall back to project-level rules
  const projectRules = db.prepare(
    'SELECT * FROM attestation_rules WHERE project_slug = ? AND capability_id IS NULL ORDER BY created_at DESC LIMIT 1'
  ).get(projectSlug) as any;

  if (projectRules) {
    return {
      rules: JSON.parse(projectRules.rules || '[]'),
      rules_version: projectRules.rules_version,
      source: 'project'
    };
  }

  // Default fallback — no config exists
  return {
    rules: DEFAULT_RULES,
    rules_version: 0,
    source: 'default'
  };
}
