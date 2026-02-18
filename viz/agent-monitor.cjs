#!/usr/bin/env node
/**
 * Agent Monitor — Role-based work detection
 *
 * Simple principle: find tasks assigned to your role + role-agnostic statuses.
 * The workflow engine validates transitions — the monitor just surfaces work.
 *
 * Modes:
 *   Background: node agent-monitor.cjs <role>          Polls DB, writes work files continuously
 *   Wait:       node agent-monitor.cjs <role> --wait   Blocks until work appears, outputs JSON, exits
 *
 * Output: /tmp/agent-work-{role}.json
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
  },
  {
    name: "best-practices",
    dbPath: "/home/developer/workspaces/github/PichlerThomas/best-practices/data/xpollination.db",
    cliPath: "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js"
  }
];

/**
 * Simple monitoring: find tasks assigned to your role.
 * The workflow engine validates transitions — the monitor just surfaces work.
 *
 * Each role sees:
 *   1. ALL tasks with role={role} (excluding terminal statuses)
 *   2. Role-agnostic statuses (e.g., liaison sees all 'approval' tasks)
 *
 * Terminal statuses (not actionable): complete, cancelled
 */
const TERMINAL_STATUSES = ['complete', 'cancelled'];

// Role-agnostic: statuses a role monitors regardless of task role assignment
const ROLE_AGNOSTIC = {
  liaison: ['approval'],        // Human gate — any task needing Thomas's decision
  qa: ['approved', 'testing'],  // Human approved — QA writes tests / runs tests
};

// Parse command line args
const args = process.argv.slice(2);
const waitMode = args.includes('--wait');
const roles = args.filter(a => !a.startsWith('--'));

if (roles.length === 0) {
  console.error('Usage: node agent-monitor.cjs <role> [--wait]');
  console.error('Roles: liaison, pdsa, qa, dev');
  console.error('--wait: block until work found, output JSON, exit');
  process.exit(1);
}

function addIfNew(list, node, project) {
  if (!list.some(w => w.id === node.id)) {
    list.push({
      project,
      id: node.id,
      slug: node.slug,
      type: node.type,
      status: node.status,
      title: node.title || node.slug,
      taskRole: node.role || 'unknown'
    });
  }
}

function queryList(dbPath, cliPath, args) {
  try {
    const result = execSync(
      `DATABASE_PATH="${dbPath}" node "${cliPath}" list ${args}`,
      { encoding: 'utf-8', timeout: 10000 }
    );
    return JSON.parse(result).nodes || [];
  } catch { return []; }
}

function checkForWork() {
  const ts = new Date().toLocaleTimeString();
  const workByRole = {};
  roles.forEach(r => workByRole[r] = []);

  projects.forEach(proj => {
    roles.forEach(role => {
      // 1. All tasks assigned to this role (any status, filter out terminal)
      const roleTasks = queryList(proj.dbPath, proj.cliPath, `--role=${role}`);
      roleTasks
        .filter(n => !TERMINAL_STATUSES.includes(n.status))
        .forEach(n => addIfNew(workByRole[role], n, proj.name));

      // 2. Role-agnostic statuses (e.g., liaison sees 'approval', QA sees 'approved')
      const agnostic = ROLE_AGNOSTIC[role] || [];
      agnostic.forEach(status => {
        const tasks = queryList(proj.dbPath, proj.cliPath, `--status=${status}`);
        tasks.forEach(n => addIfNew(workByRole[role], n, proj.name));
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
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

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

if (waitMode) {
  // --wait mode: block until work appears, output JSON, exit
  const role = roles[0];
  const workFile = `/tmp/agent-work-${role}.json`;

  // Check if work file already has content
  function checkWorkFile() {
    try {
      if (fs.existsSync(workFile) && fs.statSync(workFile).size > 0) {
        const content = fs.readFileSync(workFile, 'utf-8');
        process.stdout.write(content);
        process.exit(0);
      }
    } catch {}
  }

  // Immediate check
  checkWorkFile();

  // Watch for file changes (event-driven, instant reaction)
  fs.watchFile(workFile, { interval: 1000 }, (curr) => {
    if (curr.size > 0) {
      checkWorkFile();
    }
  });

  // Safety: auto-exit after MAX_RUNTIME
  setTimeout(() => {
    fs.unwatchFile(workFile);
    process.exit(1);
  }, MAX_RUNTIME);

} else {
  // Background mode: continuous polling, writes work files
  console.log(`Agent Monitor started for roles: ${roles.join(', ')}`);
  console.log(`Poll interval: ${POLL_INTERVAL / 1000}s | Max runtime: ${MAX_RUNTIME / 60000} min`);
  console.log(`Output files: ${roles.map(r => `/tmp/agent-work-${r}.json`).join(', ')}`);

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
}
