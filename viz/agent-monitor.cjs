#!/usr/bin/env node
/**
 * Agent Monitor - Per WORKFLOW.md v9
 * Uses interface-cli.js for regulated database access
 *
 * Key concept: State + Role = Context
 * Some states are monitored regardless of task role (e.g., liaison monitors 'approval' for any task)
 * Some states require role match (e.g., 'review+pdsa' means review state with role=pdsa)
 *
 * Usage:
 *   node agent-monitor.cjs liaison    # Liaison agent
 *   node agent-monitor.cjs pdsa       # PDSA agent
 *   node agent-monitor.cjs qa         # QA agent
 *   node agent-monitor.cjs dev        # Dev agent
 *
 * Output:
 *   /tmp/agent-work-{role}.json - created when work found for that role
 *
 * Claude checks (minimal tokens):
 *   stat -c%s /tmp/agent-work-liaison.json 2>/dev/null || echo 0
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_RUNTIME = 7200000; // 120 minutes max, then exit

const projects = [
  {
    name: "xpollination-mcp-server",
    dbPath: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/data/xpollination.db",
    cliPath: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js"
  },
  {
    name: "HomePage",
    dbPath: "/home/developer/workspaces/github/PichlerThomas/HomePage/data/xpollination.db",
    cliPath: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js"
  }
];

/**
 * WORKFLOW.md v9 Monitoring Rules
 * Format: { status, roleFilter } where roleFilter = null means any role
 *
 * LIAISON monitors:
 *   - approval (any) - PDSA submitted, human reviews
 *   - review+liaison - present to human for final approval
 *   - complete (any) - oversight
 *   - rework+liaison - human rejected liaison content
 *   - ready+liaison, active+liaison - own liaison tasks
 *
 * PDSA monitors:
 *   - ready+pdsa, active+pdsa - own design tasks
 *   - review+pdsa - verify design match after QA
 *   - rework+pdsa - design rejected
 *
 * QA monitors:
 *   - approved (any) - human approved, write tests
 *   - testing (any) - running tests
 *   - review+qa - review dev implementation
 *   - rework+qa - human reopened to update tests
 *
 * DEV monitors:
 *   - ready+dev, active+dev - implementation tasks
 *   - rework+dev - issues found
 */
const MONITOR_RULES = {
  liaison: [
    { status: 'approval', roleFilter: null },      // Any task in approval
    { status: 'review', roleFilter: 'liaison' },   // review+liaison
    { status: 'complete', roleFilter: null },      // Any completed (oversight)
    { status: 'rework', roleFilter: 'liaison' },   // rework+liaison
    { status: 'ready', roleFilter: 'liaison' },    // Own tasks
    { status: 'active', roleFilter: 'liaison' },   // Own tasks (recovery)
  ],
  pdsa: [
    { status: 'ready', roleFilter: 'pdsa' },
    { status: 'active', roleFilter: 'pdsa' },
    { status: 'review', roleFilter: 'pdsa' },      // review+pdsa
    { status: 'rework', roleFilter: 'pdsa' },
  ],
  qa: [
    { status: 'approved', roleFilter: null },      // Any approved task
    { status: 'testing', roleFilter: null },       // Any testing task
    { status: 'review', roleFilter: 'qa' },        // review+qa
    { status: 'rework', roleFilter: 'qa' },
  ],
  dev: [
    { status: 'ready', roleFilter: 'dev' },
    { status: 'active', roleFilter: 'dev' },
    { status: 'rework', roleFilter: 'dev' },
  ],
};

// Get roles from command line args
const roles = process.argv.slice(2);
if (roles.length === 0) {
  console.error('Usage: node agent-monitor.cjs <role>');
  console.error('Roles: liaison, pdsa, qa, dev');
  process.exit(1);
}

console.log(`Agent Monitor started for roles: ${roles.join(', ')}`);
console.log(`Poll interval: ${POLL_INTERVAL / 1000}s | Max runtime: ${MAX_RUNTIME / 60000} min`);
console.log(`Output files: ${roles.map(r => `/tmp/agent-work-${r}.json`).join(', ')}`);

function checkForWork() {
  const ts = new Date().toLocaleTimeString();
  const workByRole = {};
  roles.forEach(r => workByRole[r] = []);

  projects.forEach(proj => {
    roles.forEach(role => {
      const rules = MONITOR_RULES[role] || [];

      rules.forEach(({ status, roleFilter }) => {
        try {
          // Build query - with or without role filter
          const roleArg = roleFilter ? ` --role=${roleFilter}` : '';
          const result = execSync(
            `DATABASE_PATH="${proj.dbPath}" node "${proj.cliPath}" list --status=${status}${roleArg}`,
            { encoding: 'utf-8', timeout: 10000 }
          );

          const data = JSON.parse(result);

          if (data.nodes && data.nodes.length > 0) {
            data.nodes.forEach(n => {
              // Avoid duplicates
              const exists = workByRole[role].some(w => w.id === n.id);
              if (!exists) {
                workByRole[role].push({
                  project: proj.name,
                  id: n.id,
                  slug: n.slug,
                  type: n.type,
                  status: n.status || status,
                  title: n.title || n.slug,
                  taskRole: n.role || 'unknown'
                });
              }
            });
          }
        } catch (err) {
          // Skip errors silently (project may not have DB)
        }
      });
    });
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

/**
 * AC11: Detect orphaned work
 * - Tasks in 'active' status >24h without update
 * - Output: /tmp/orphan-alerts.json
 */
function checkForOrphans() {
  const ts = new Date().toLocaleTimeString();
  const orphans = [];
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  projects.forEach(proj => {
    try {
      // Get all active tasks
      const result = execSync(
        `DATABASE_PATH="${proj.dbPath}" node "${proj.cliPath}" list --status=active`,
        { encoding: 'utf-8', timeout: 10000 }
      );

      const data = JSON.parse(result);

      if (data.nodes && data.nodes.length > 0) {
        data.nodes.forEach(n => {
          // Check if updated_at is older than 24h
          if (n.updated_at) {
            const updated = new Date(n.updated_at + ' UTC').getTime();
            const age = now - updated;
            if (age > TWENTY_FOUR_HOURS) {
              orphans.push({
                project: proj.name,
                id: n.id,
                slug: n.slug,
                title: n.title || n.slug,
                role: n.role,
                status: n.status,
                updated_at: n.updated_at,
                stale_hours: Math.round(age / (60 * 60 * 1000))
              });
            }
          }
        });
      }
    } catch (err) {
      // Skip errors silently
    }
  });

  // Write orphan alerts
  const file = '/tmp/orphan-alerts.json';
  if (orphans.length > 0) {
    fs.writeFileSync(file, JSON.stringify({
      found_at: new Date().toISOString(),
      alert: 'ORPHANED TASKS - active >24h without update',
      orphans
    }, null, 2));
    console.log(`[${ts}] ORPHAN ALERT: ${orphans.length} task(s) stuck in active >24h`);
  } else {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

// Initial check
checkForWork();
checkForOrphans();

// Continuous polling
setInterval(checkForWork, POLL_INTERVAL);
setInterval(checkForOrphans, POLL_INTERVAL * 10); // Check orphans every 5 minutes

// Auto-exit after MAX_RUNTIME (prevents overnight loops)
setTimeout(() => {
  console.log(`[${new Date().toLocaleTimeString()}] MAX_RUNTIME (${MAX_RUNTIME / 60000} min) reached. Exiting.`);
  process.exit(0);
}, MAX_RUNTIME);
