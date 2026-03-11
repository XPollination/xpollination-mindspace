# PDSA: Flag Configuration YAML Export

**Task:** ms-a10-4-flag-yaml
**Status:** Design
**Version:** v0.0.1

## Plan

Add a GET endpoint that exports all feature flags for a project as YAML content.

### Dependencies

- **ms-a10-1-feature-flags-table** (complete): feature_flags table + CRUD

### Investigation

**DNA description:** GET /api/projects/:slug/flags/export returns YAML format feature-flags.yml content. Includes all flags with state, approved_by, dates.

**Design decisions:**
- Endpoint: GET /api/projects/:slug/flags/export
- Content-Type: text/yaml (or application/x-yaml)
- No external YAML library — generate simple YAML manually (flags are flat key-value)
- Format: each flag as a top-level key with state, task_id, toggled_by, toggled_at, created_at, expires_at
- Optional ?format=json query param for JSON export alternative
- Viewer access level

## Do

### File Changes

#### 1. `api/routes/feature-flags.ts` (UPDATE — add export endpoint)

Add before the `/:flagId` routes (order matters for Express routing):

```typescript
// GET /export — export flags as YAML (viewer)
featureFlagsRouter.get('/export', requireProjectAccess('viewer'), (req: Request, res: Response) => {
  const { slug } = req.params;
  const { format } = req.query;
  const db = getDb();

  const flags = db.prepare(
    'SELECT * FROM feature_flags WHERE project_slug = ? ORDER BY flag_name ASC'
  ).all(slug) as any[];

  if (format === 'json') {
    res.status(200).json(flags);
    return;
  }

  // Generate YAML
  let yaml = `# Feature flags for project: ${slug}\n`;
  yaml += `# Generated: ${new Date().toISOString()}\n`;
  yaml += `# Total flags: ${flags.length}\n\n`;

  for (const flag of flags) {
    yaml += `${flag.flag_name}:\n`;
    yaml += `  state: ${flag.state}\n`;
    if (flag.task_id) yaml += `  task_id: ${flag.task_id}\n`;
    yaml += `  toggled_by: ${flag.toggled_by || 'null'}\n`;
    yaml += `  toggled_at: ${flag.toggled_at || 'null'}\n`;
    yaml += `  created_at: ${flag.created_at}\n`;
    if (flag.expires_at) yaml += `  expires_at: ${flag.expires_at}\n`;
    yaml += '\n';
  }

  res.setHeader('Content-Type', 'text/yaml');
  res.setHeader('Content-Disposition', `attachment; filename="feature-flags-${slug}.yml"`);
  res.status(200).send(yaml);
});
```

## Study

### Test Cases (8 total)

**YAML export (4):**
1. Returns valid YAML with Content-Type text/yaml
2. Includes all flags with correct field values
3. Flags sorted alphabetically by flag_name
4. Empty project returns header-only YAML

**JSON export (2):**
5. ?format=json returns JSON array
6. JSON includes all flag fields

**Content headers (1):**
7. Response includes Content-Disposition with filename

**Access control (1):**
8. Viewer can access export endpoint

## Act

### Deployment

- 1 file: feature-flags.ts (UPDATE — add /export route)
- No migration needed
- Route must be registered before /:flagId to avoid conflicts
