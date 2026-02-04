#!/usr/bin/env node
/**
 * Agent Monitor - Parameterized for any role (DRY pattern)
 *
 * Usage:
 *   node agent-monitor.cjs pdsa qa    # PDSA+QA agent
 *   node agent-monitor.cjs dev        # Dev agent
 *   node agent-monitor.cjs pdsa qa dev # All roles
 *
 * Output:
 *   /tmp/agent-work-{role}.json - created when work found for that role
 *
 * Claude checks (minimal tokens):
 *   stat -c%s /tmp/agent-work-pdsa.json 2>/dev/null || echo 0
 */

const Database = require('better-sqlite3');
const fs = require('fs');

const POLL_INTERVAL = 30000; // 30 seconds

const projects = [
  { name: "xpollination-mcp-server", path: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db" },
  { name: "HomePage", path: "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db" }
];

// Get roles from command line args
const roles = process.argv.slice(2);
if (roles.length === 0) {
  console.error('Usage: node agent-monitor.cjs <role1> [role2] ...');
  console.error('Example: node agent-monitor.cjs pdsa qa');
  process.exit(1);
}

console.log(`Agent Monitor started for roles: ${roles.join(', ')}`);
console.log(`Poll interval: ${POLL_INTERVAL / 1000}s`);
console.log(`Output files: ${roles.map(r => `/tmp/agent-work-${r}.json`).join(', ')}`);

function checkForWork() {
  const ts = new Date().toLocaleTimeString();
  const workByRole = {};
  roles.forEach(r => workByRole[r] = []);

  projects.forEach(proj => {
    try {
      const db = new Database(proj.path, { readonly: true });

      // Build query for all monitored roles
      const roleClauses = roles.map(r => `dna_json LIKE '%"role":"${r}"%'`).join(' OR ');
      const query = `
        SELECT id, slug, type, dna_json
        FROM mindspace_nodes
        WHERE status = 'ready' AND (${roleClauses})
      `;

      const nodes = db.prepare(query).all();

      nodes.forEach(n => {
        const dna = JSON.parse(n.dna_json || '{}');
        if (dna.role && workByRole[dna.role] !== undefined) {
          workByRole[dna.role].push({
            project: proj.name,
            id: n.id,
            slug: n.slug,
            type: n.type,
            title: dna.title || n.slug
          });
        }
      });

      db.close();
    } catch (err) {
      // Skip errors silently
    }
  });

  // Write output files per role
  let totalWork = 0;
  roles.forEach(role => {
    const file = `/tmp/agent-work-${role}.json`;
    const work = workByRole[role];

    if (work.length > 0) {
      fs.writeFileSync(file, JSON.stringify({ found_at: new Date().toISOString(), role, work }, null, 2));
      totalWork += work.length;
    } else {
      // Remove file if no work (so stat returns 0)
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  // Log summary
  if (totalWork > 0) {
    console.log(`[${ts}] WORK: ${roles.map(r => `${r}:${workByRole[r].length}`).join(' ')}`);
  } else {
    console.log(`[${ts}] -`);
  }
}

// Initial check
checkForWork();

// Continuous polling
setInterval(checkForWork, POLL_INTERVAL);
