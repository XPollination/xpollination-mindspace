#!/usr/bin/env node
// pm-status.cjs v0.0.3 — PM status via A2A (no direct DB access)
//
// Queries tasks via A2A OBJECT_QUERY and brain via A2A BRAIN_QUERY.
// Uses the body's session token from /tmp/xpo-agent-{role}.env.
// Falls back to MINDSPACE_API_URL env var for standalone use.

const fs = require('fs');
const path = require('path');

// Resolve A2A credentials from body env file or environment
function loadA2ACredentials() {
  // Try body env files (any role)
  for (const role of ['liaison', 'pdsa', 'dev', 'qa']) {
    try {
      const envFile = `/tmp/xpo-agent-${role}.env`;
      const content = fs.readFileSync(envFile, 'utf-8');
      const vars = {};
      for (const line of content.split('\n')) {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) vars[key.trim()] = rest.join('=').trim();
      }
      if (vars.A2A_API_URL && vars.A2A_TOKEN) {
        return { apiUrl: vars.A2A_API_URL, token: vars.A2A_TOKEN, agentId: vars.A2A_AGENT_ID || 'pm-status' };
      }
    } catch { /* try next role */ }
  }
  // Fallback: env vars
  const apiUrl = process.env.MINDSPACE_API_URL || 'http://localhost:3101';
  return { apiUrl, token: null, agentId: 'pm-status' };
}

const { apiUrl, token, agentId } = loadA2ACredentials();

async function a2aMessage(body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${apiUrl}/a2a/message`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, agent_id: agentId }),
  });
  return res.json();
}

async function main() {
  const result = { timestamp: new Date().toISOString(), projects: {}, brain_health: null };

  // Query all tasks via A2A OBJECT_QUERY (across all projects)
  try {
    const data = await a2aMessage({
      type: 'OBJECT_QUERY',
      object_type: 'task',
      filters: { project_slug: '__all__', status_not_in: 'complete,cancelled' },
    });
    const tasks = data.objects || [];

    // Group by project
    for (const task of tasks) {
      const project = task.project_slug || task.project || 'unknown';
      if (!result.projects[project]) result.projects[project] = { count: 0, nodes: [] };
      result.projects[project].count++;
      result.projects[project].nodes.push(task);
    }
  } catch (err) {
    result.projects['error'] = { error: `A2A query failed: ${err.message}` };
  }

  // Brain health via A2A BRAIN_QUERY
  try {
    const data = await a2aMessage({
      type: 'BRAIN_QUERY',
      prompt: 'Recent brain activity across all domains and agents',
      read_only: true,
      full_content: false,
    });
    const sources = data.result?.sources || [];
    const highways = data.result?.highways_nearby || [];

    // Duplicate detection
    const groups = {};
    for (const s of sources) {
      const key = s.content_preview || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    const dupGroups = Object.values(groups).filter(g => g.length >= 3);

    result.brain_health = {
      status: sources.length > 0 ? 'healthy' : 'empty',
      recent_thoughts: sources.length,
      highways: highways.length,
      top_domains: [...new Set(sources.map(s => s.topic).filter(Boolean))].slice(0, 5),
      duplicate_groups: dupGroups.length,
      needs_gardening: dupGroups.length > 0,
    };
  } catch {
    result.brain_health = { status: 'unavailable', duplicate_groups: 0, needs_gardening: false };
  }

  return result;
}

main().then(r => console.log(JSON.stringify(r, null, 2))).catch(err => {
  console.error('PM Status failed:', err.message);
  process.exit(1);
});
