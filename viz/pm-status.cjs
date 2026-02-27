#!/usr/bin/env node
// pm-status.cjs v0.0.1 — PM status with integrated brain health
const http = require('http');
const { execSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, '..', 'src', 'db', 'interface-cli.js');
const DBS = {
  'best-practices': '/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db',
  'xpollination-mcp-server': '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db',
  'HomePage': '/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db'
};

async function main() {
  const result = { timestamp: new Date().toISOString(), projects: {}, brain_health: null };

  // Scan all project DBs (Step 1)
  for (const [name, dbPath] of Object.entries(DBS)) {
    try {
      const out = execSync(`DATABASE_PATH="${dbPath}" node ${CLI} list`, { encoding: 'utf8', timeout: 10000 });
      result.projects[name] = JSON.parse(out);
    } catch { result.projects[name] = { error: 'scan failed' }; }
  }

  // Brain health diagnostic (Step 1.5 — ALWAYS runs)
  result.brain_health = await brainHealth();

  console.log(JSON.stringify(result, null, 2));
}

async function brainHealth() {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      prompt: 'Recent brain activity across all domains and agents',
      agent_id: 'system', agent_name: 'PM-STATUS',
      read_only: true
    });
    const req = http.request('http://localhost:3200/api/v1/memory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const r = JSON.parse(body);
          const sources = r.result?.sources || [];
          const highways = r.result?.highways_nearby || [];
          resolve({
            status: sources.length > 0 ? 'healthy' : 'empty',
            recent_thoughts: sources.length,
            highways: highways.length,
            top_domains: [...new Set(sources.map(s => s.topic).filter(Boolean))].slice(0, 5)
          });
        } catch { resolve({ status: 'parse_error' }); }
      });
    });
    req.on('error', () => resolve({ status: 'unavailable' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

main();
