#!/usr/bin/env node
// pm-status.cjs v0.0.2 — PM status with integrated brain health + Layer 1 auto-gardening
const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const fs = require('fs');
const { discoverProjects } = require('./discover-projects.cjs');
const CLI = path.join(__dirname, '..', 'src', 'db', 'interface-cli.js');

// Convert shared discovery format to {name: dbPath} map for backward compat
const DBS = {};
for (const p of discoverProjects()) { DBS[p.name] = p.dbPath; }

const BRAIN_BASE = process.env.BRAIN_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

async function main() {
  const result = { timestamp: new Date().toISOString(), projects: {}, brain_health: null, gardening: null };

  // Scan all project DBs
  for (const [name, dbPath] of Object.entries(DBS)) {
    try {
      const out = execSync(`DATABASE_PATH="${dbPath}" node ${CLI} list`, { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
      result.projects[name] = JSON.parse(out);
    } catch { result.projects[name] = { error: 'scan failed' }; }
  }

  // Brain health diagnostic (ALWAYS runs)
  result.brain_health = await brainHealth();

  // Layer 1 auto-gardening (only when needed)
  if (result.brain_health && result.brain_health.needs_gardening && result.brain_health._sources) {
    result.gardening = await layer1Garden(result.brain_health._sources);
  }

  // Remove internal _sources from output
  if (result.brain_health) {
    delete result.brain_health._sources;
  }

  return result;
}

async function brainHealth() {
  const url = new URL('/api/v1/memory', BRAIN_BASE);
  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: 'Recent brain activity across all domains and agents',
      agent_id: 'system', agent_name: 'PM-STATUS',
      read_only: true,
      full_content: true
    });
    const req = http.request(url.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(BRAIN_API_KEY ? { 'Authorization': `Bearer ${BRAIN_API_KEY}` } : {})
      },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const r = JSON.parse(body);
          const sources = r.result?.sources || [];
          const highways = r.result?.highways_nearby || [];

          // Duplicate detection: group by content_preview, count groups with 3+
          const groups = {};
          for (const s of sources) {
            const key = s.content_preview || '';
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
          }
          const dupGroups = Object.values(groups).filter(g => g.length >= 3);

          resolve({
            status: sources.length > 0 ? 'healthy' : 'empty',
            recent_thoughts: sources.length,
            highways: highways.length,
            top_domains: [...new Set(sources.map(s => s.topic).filter(Boolean))].slice(0, 5),
            duplicate_groups: dupGroups.length,
            needs_gardening: dupGroups.length > 0,
            _sources: sources
          });
        } catch { resolve({ status: 'parse_error', duplicate_groups: 0, needs_gardening: false }); }
      });
    });
    req.on('error', () => resolve({ status: 'unavailable', duplicate_groups: 0, needs_gardening: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', duplicate_groups: 0, needs_gardening: false }); });
    req.write(data);
    req.end();
  });
}

async function layer1Garden(sources) {
  // Group by content_preview, find groups with 3+ duplicates
  const groups = {};
  for (const s of sources) {
    const key = s.content_preview || '';
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  const dupGroups = Object.values(groups).filter(g => g.length >= 3);

  if (dupGroups.length === 0) {
    return { status: 'ok', groups_found: 0, consolidated: 0 };
  }

  // Max 3 consolidations per invocation
  const toProcess = dupGroups.slice(0, 3);
  let consolidated = 0;

  let lastReason = null;
  for (const group of toProcess) {
    try {
      const ids = group.map(s => s.thought_id);
      const res = await postConsolidation(ids, group[0].content_preview);
      if (res.ok) consolidated++;
      else lastReason = res.reason || 'error';
    } catch {
      lastReason = 'error';
    }
  }

  // If ALL consolidations failed, report as skipped
  if (consolidated === 0 && toProcess.length > 0) {
    const result = { status: 'skipped', groups_found: dupGroups.length, consolidated: 0 };
    if (lastReason === 'timeout') result.reason = 'timeout';
    return result;
  }

  return { status: 'ok', groups_found: dupGroups.length, consolidated };
}

function postConsolidation(ids, contentPreview) {
  const url = new URL('/api/v1/memory', BRAIN_BASE);
  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: `Consolidated ${ids.length} duplicate thoughts: ${contentPreview}`,
      consolidates: ids,
      thought_category: 'consolidation',
      agent_id: 'system',
      agent_name: 'GARDENER'
    });
    const req = http.request(url.href, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(BRAIN_API_KEY ? { 'Authorization': `Bearer ${BRAIN_API_KEY}` } : {})
      },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, reason: 'error' });
        }
      });
    });
    req.on('error', () => resolve({ ok: false, reason: 'error' }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

// Guard: only auto-run when executed directly
if (require.main === module) {
  main().then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { brainHealth, layer1Garden, main };
