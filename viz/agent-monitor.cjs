#!/usr/bin/env node
/**
 * Agent Monitor v0.0.2 — Role-based work detection
 *
 * Simple principle: find tasks assigned to your role + role-agnostic statuses.
 * The workflow engine validates transitions — the monitor just surfaces work.
 *
 * Modes:
 *   Background: node agent-monitor.cjs <role>          Polls DB, writes work files continuously
 *   Wait:       node agent-monitor.cjs <role> --wait   Queries DB directly, blocks until actionable work, exits
 *
 * Output: /tmp/agent-work-{role}.json
 *
 * v0.0.2 fixes (2026-02-19):
 *   - --wait mode queries DB directly (no stale file dependency)
 *   - Added actionable field per task (agent knows what to claim)
 *   - Cleanup work file on background monitor exit
 *   - Freshness check on existing work files
 *   - PDSA trace: HomeAssistant/systems/hetzner-cx22-ubuntu/pdca/monitoring/v0.0.2/
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const POLL_INTERVAL = 30000; // 30 seconds
const MAX_RUNTIME = 7200000; // 120 minutes max, then exit

// Shared project discovery — single source of truth
const { discoverProjects: _discoverProjects } = require('./discover-projects.cjs');
const WORKSPACE_PATH = process.env.XPO_WORKSPACE_PATH || "/home/developer/workspaces/github/PichlerThomas";
const CLI_PATH = process.env.XPO_CLI_PATH || `${WORKSPACE_PATH}/xpollination-mcp-server/src/db/interface-cli.js`;

// Add cliPath to each discovered project for backward compat
const projects = _discoverProjects().map(p => ({ ...p, cliPath: CLI_PATH }));

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

// Actionable statuses: tasks the agent can claim and work on RIGHT NOW
// Other statuses are visible (for context) but not actionable
const ACTIONABLE_STATUSES = {
  pdsa:    ['ready', 'rework', 'review'],
  dev:     ['ready', 'rework'],
  liaison: ['ready', 'rework', 'approval', 'review'],
  qa:      ['ready', 'rework', 'approved', 'testing', 'review'],
};

const STALE_THRESHOLD = POLL_INTERVAL * 2; // 60s — reject work files older than this

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

function addIfNew(list, node, project, role) {
  if (!list.some(w => w.id === node.id)) {
    const actionableFor = ACTIONABLE_STATUSES[role] || [];
    list.push({
      project,
      id: node.id,
      slug: node.slug,
      type: node.type,
      status: node.status,
      title: node.title || node.slug,
      taskRole: node.role || 'unknown',
      actionable: actionableFor.includes(node.status)
    });
  }
}

function queryList(dbPath, cliPath, args) {
  try {
    const result = execSync(
      `DATABASE_PATH="${dbPath}" node "${cliPath}" list ${args}`,
      { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(result).nodes || [];
  } catch { return []; }
}

function getLiaisonApprovalMode() {
  try {
    const Database = require('better-sqlite3');
    for (const proj of projects) {
      if (!fs.existsSync(proj.dbPath)) continue;
      try {
        const db = new Database(proj.dbPath, { readonly: true });
        const row = db.prepare("SELECT value FROM system_settings WHERE key = 'liaison_approval_mode'").get();
        db.close();
        if (row) return row.value;
      } catch { /* try next project */ }
    }
  } catch { /* better-sqlite3 not available */ }
  return 'manual';
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
        .forEach(n => addIfNew(workByRole[role], n, proj.name, role));

      // 2. Role-agnostic statuses (e.g., liaison sees 'approval', QA sees 'approved')
      const agnostic = ROLE_AGNOSTIC[role] || [];
      agnostic.forEach(status => {
        const tasks = queryList(proj.dbPath, proj.cliPath, `--status=${status}`);
        tasks.forEach(n => addIfNew(workByRole[role], n, proj.name, role));
      });
    });
  });

  // Write output files per role
  let totalWork = 0;
  roles.forEach(role => {
    const file = `/tmp/agent-work-${role}.json`;
    const work = workByRole[role];

    if (work.length > 0) {
      const output = { found_at: new Date().toISOString(), role, work };
      if (role === 'liaison') output.liaison_approval_mode = getLiaisonApprovalMode();
      fs.writeFileSync(file, JSON.stringify(output, null, 2));
      totalWork += work.length;
    } else {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  });

  if (totalWork > 0) {
    const summary = roles.map(r => {
      const actionable = workByRole[r].filter(w => w.actionable).length;
      return `${r}:${workByRole[r].length}(${actionable} actionable)`;
    }).join(' ');
    console.log(`[${ts}] WORK: ${summary}`);
  } else {
    console.log(`[${ts}] -`);
  }

  return workByRole;
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
        { encoding: 'utf-8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] }
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
  // --wait mode: queries DB directly, blocks until actionable work found, exits
  // v0.0.2: self-sufficient — does NOT depend on background monitor's work file
  const role = roles[0];
  const workFile = `/tmp/agent-work-${role}.json`;

  function queryAndCheck() {
    // Query DB directly (same as background mode)
    const workByRole = checkForWork();
    const work = workByRole[role] || [];
    const actionable = work.filter(w => w.actionable);

    if (actionable.length > 0) {
      // Found actionable work — output and exit
      const output = { found_at: new Date().toISOString(), role, work, actionable_count: actionable.length };
      if (role === 'liaison') output.liaison_approval_mode = getLiaisonApprovalMode();
      const json = JSON.stringify(output, null, 2);
      // Also write to work file for consistency
      fs.writeFileSync(workFile, json);
      process.stdout.write(json);
      process.exit(0);
    }
    // No actionable work yet — will poll again
  }

  // Check if existing work file is fresh AND has actionable items
  try {
    if (fs.existsSync(workFile) && fs.statSync(workFile).size > 0) {
      const content = JSON.parse(fs.readFileSync(workFile, 'utf-8'));
      const age = Date.now() - new Date(content.found_at).getTime();
      const actionable = (content.work || []).filter(w => w.actionable);
      if (age < STALE_THRESHOLD && actionable.length > 0) {
        // Fresh file with actionable work — use it
        process.stdout.write(JSON.stringify(content, null, 2));
        process.exit(0);
      }
      // Stale or no actionable items — query DB instead
    }
  } catch {}

  // Immediate DB query
  queryAndCheck();

  // Poll DB directly every POLL_INTERVAL until actionable work appears
  const pollTimer = setInterval(queryAndCheck, POLL_INTERVAL);

  // Safety: auto-exit after MAX_RUNTIME
  setTimeout(() => {
    clearInterval(pollTimer);
    console.error(`[${new Date().toLocaleTimeString()}] --wait: MAX_RUNTIME reached with no actionable work. Exiting.`);
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
  // v0.0.2: cleanup work files on exit to prevent stale data
  setTimeout(() => {
    console.log(`[${new Date().toLocaleTimeString()}] MAX_RUNTIME (${MAX_RUNTIME / 60000} min) reached. Cleaning up.`);
    roles.forEach(role => {
      const file = `/tmp/agent-work-${role}.json`;
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`[${new Date().toLocaleTimeString()}] Deleted stale work file: ${file}`);
      }
    });
    process.exit(0);
  }, MAX_RUNTIME);
}
