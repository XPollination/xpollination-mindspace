/**
 * Kanban Board — A2A-powered task board with Digital Twins
 *
 * Connects via A2A, queries TaskTwins, renders columns by status.
 * Column mapping is configuration — change COLUMNS config, tasks auto-rearrange.
 * Rich DNA visible by default. Cross-linked to knowledge browser.
 */

import { A2AClient } from './a2a-client.js';
import { TwinCache } from './twin-cache.js';

const client = new A2AClient();
const cache = new TwinCache();

const boardEl = document.getElementById('board');
const statsEl = document.getElementById('stats');
const detailOverlay = document.getElementById('detail-overlay');
const detailPanel = document.getElementById('detail-panel');
const detailTitle = document.getElementById('detail-title');
const detailBody = document.getElementById('detail-body');
const detailActions = document.getElementById('detail-actions');
const projectFilter = document.getElementById('project-filter');
const searchInput = document.getElementById('search');

let selectedTaskId = null;
let currentFilter = sessionStorage.getItem('kanban-completed-filter') || 'active';

// --- Column Configuration ---
// Twin status → column mapping. Change this to rearrange tasks.
const COLUMNS = [
  { id: 'queue',    label: 'Queue',    statuses: ['pending', 'ready'],          color: 'var(--ms-status-ready)' },
  { id: 'active',   label: 'Active',   statuses: ['active', 'testing'],         color: 'var(--ms-status-active)' },
  { id: 'review',   label: 'Review',   statuses: ['review', 'approval'],        color: 'var(--ms-status-review)' },
  { id: 'approved', label: 'Approved', statuses: ['approved'],                  color: 'var(--ms-status-approved)' },
  { id: 'rework',   label: 'Rework',   statuses: ['rework'],                    color: 'var(--ms-status-rework)' },
  { id: 'blocked',  label: 'Blocked',  statuses: ['blocked', 'cancelled'],      color: 'var(--ms-status-blocked)' },
  { id: 'done',     label: 'Done',     statuses: ['complete'],                  color: 'var(--ms-status-complete)' },
];

function isWithinDays(updatedAt, days) {
  const updated = new Date(updatedAt).getTime();
  const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
  return updated >= cutoff;
}

const STATUS_COLORS = {
  pending: 'var(--ms-status-pending)', ready: 'var(--ms-status-ready)',
  active: 'var(--ms-status-active)', testing: 'var(--ms-status-testing)',
  review: 'var(--ms-status-review)', approval: 'var(--ms-status-approval)',
  approved: 'var(--ms-status-approved)', complete: 'var(--ms-status-complete)',
  rework: 'var(--ms-status-rework)', blocked: 'var(--ms-status-blocked)',
  cancelled: 'var(--ms-status-cancelled)',
};

const ROLE_COLORS = {
  liaison: 'var(--ms-role-liaison)', pdsa: 'var(--ms-role-pdsa)',
  dev: 'var(--ms-role-dev)', qa: 'var(--ms-role-qa)',
};

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Rendering ---

function getColumn(task) {
  for (const col of COLUMNS) {
    if (col.statuses.includes(task.status)) return col.id;
  }
  return 'queue';
}

function filterTasks(tasks) {
  let filtered = tasks;
  const search = searchInput.value.toLowerCase().trim();

  if (currentFilter === 'active') {
    filtered = filtered.filter(t => !['complete', 'cancelled'].includes(t.status));
  } else if (currentFilter === '1d' || currentFilter === '7d' || currentFilter === '30d') {
    const days = parseInt(currentFilter);
    filtered = filtered.filter(t => {
      if (!['complete', 'cancelled'].includes(t.status)) return true;
      return isWithinDays(t.updated_at || t.created_at, days);
    });
  }
  // 'all' = no terminal filter

  if (search) {
    filtered = filtered.filter(t => {
      const title = (t.dna?.title || t.slug || '').toLowerCase();
      const slug = (t.slug || '').toLowerCase();
      return title.includes(search) || slug.includes(search);
    });
  }

  const proj = projectFilter.value;
  if (proj !== 'all') {
    filtered = filtered.filter(t => t.project_slug === proj);
  }

  return filtered;
}

function renderBoard() {
  const allTasks = cache.getAll('task');
  const tasks = filterTasks(allTasks);

  // Group by column
  const groups = {};
  for (const col of COLUMNS) groups[col.id] = [];
  for (const task of tasks) {
    const colId = getColumn(task);
    if (groups[colId]) groups[colId].push(task);
  }

  boardEl.innerHTML = COLUMNS.map(col => {
    const cards = groups[col.id] || [];
    return `<div class="kanban-column">
      <div class="column-header">
        <span>${col.label}</span>
        <span class="column-count">${cards.length}</span>
      </div>
      <div class="column-cards">
        ${cards.map(t => renderCard(t)).join('')}
      </div>
    </div>`;
  }).join('');

  // Stats
  const active = allTasks.filter(t => !['complete', 'cancelled'].includes(t.status)).length;
  const total = allTasks.length;
  statsEl.textContent = `${active} active / ${total} total`;

  // Re-attach click handlers
  boardEl.querySelectorAll('.task-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const task = cache.get('task', id);
      if (task) showDetail(task);
    });
  });
}

function renderCard(task) {
  const dna = task.dna || {};
  const title = esc(dna.title || task.slug || task.id);
  const role = dna.role;
  const project = task.project_slug;
  const isSelected = task.slug === selectedTaskId || task.id === selectedTaskId;

  const isTerminal = ['complete', 'cancelled'].includes(task.status);
  const isCancelled = task.status === 'cancelled';
  const isBlocked = task.status === 'blocked';
  const blockedReason = isBlocked && dna.blocked_reason ? dna.blocked_reason : '';

  return `<div class="task-card${isSelected ? ' selected' : ''}${isTerminal ? ' completed' : ''}${isCancelled ? ' cancelled' : ''}" data-id="${esc(task.slug || task.id)}">
    <div class="task-title">${title}</div>
    <div class="task-meta">
      <span class="task-badge" style="background:${STATUS_COLORS[task.status] || 'var(--ms-muted)'}">${task.status}</span>
      ${role ? `<span class="task-badge" style="background:${ROLE_COLORS[role] || 'var(--ms-muted)'}">${role}</span>` : ''}
      ${project ? `<span class="task-project">${esc(project)}</span>` : ''}
      ${dna.claimed_by ? `<span class="task-claimed" title="Claimed by ${esc(dna.claimed_by)}">${esc(dna.claimed_by).substring(0, 16)}…</span>` : ''}
    </div>
    ${blockedReason ? `<div class="task-blocked-reason">${esc(blockedReason)}</div>` : ''}
  </div>`;
}

// --- Detail Panel ---

function showDetail(task) {
  selectedTaskId = task.slug || task.id;
  detailTitle.textContent = task.dna?.title || task.slug || 'Task Detail';
  detailPanel.classList.add('open');
  detailOverlay.classList.add('open');

  const dna = task.dna || {};
  let html = '';

  // Overview
  html += renderSection('Overview', [
    field('Status', `<span class="task-badge" style="background:${STATUS_COLORS[task.status]}">${task.status}</span>`),
    dna.role ? field('Role', `<span class="task-badge" style="background:${ROLE_COLORS[dna.role]}">${dna.role}</span>`) : '',
    field('Slug', `<span class="task-slug">${esc(task.slug || task.id)}</span>`),
    task.project_slug ? field('Project', esc(task.project_slug)) : '',
    dna.priority ? field('Priority', esc(dna.priority)) : '',
    dna.group ? field('Group', esc(dna.group)) : '',
    dna.description ? field('Description', esc(dna.description)) : '',
    dna.acceptance_criteria ? field('Acceptance Criteria', `<pre>${esc(dna.acceptance_criteria)}</pre>`) : '',
  ].filter(Boolean), true);

  // Work
  const workFields = [
    dna.findings ? field('Findings', `<pre>${esc(typeof dna.findings === 'string' ? dna.findings : JSON.stringify(dna.findings, null, 2))}</pre>`) : '',
    dna.proposed_design ? field('Proposed Design', `<pre>${esc(typeof dna.proposed_design === 'string' ? dna.proposed_design : JSON.stringify(dna.proposed_design, null, 2))}</pre>`) : '',
    dna.implementation ? field('Implementation', formatImpl(dna.implementation)) : '',
    dna.dev_findings ? field('Dev Findings', `<pre>${esc(dna.dev_findings)}</pre>`) : '',
  ].filter(Boolean);
  if (workFields.length) html += renderSection('Work', workFields, false);

  // Reviews
  const reviewFields = [
    dna.qa_review ? field('QA Review', formatReview(dna.qa_review)) : '',
    dna.pdsa_review ? field('PDSA Review', formatReview(dna.pdsa_review)) : '',
    dna.qa_tests ? field('QA Tests', esc(dna.qa_tests)) : '',
    dna.test_pass_count !== undefined ? field('Tests', `${dna.test_pass_count}/${dna.test_total_count} passed`) : '',
  ].filter(Boolean);
  if (reviewFields.length) html += renderSection('Reviews', reviewFields, false);

  // Decisions
  const decisionFields = [
    dna.human_answer ? field('Human Decision', esc(dna.human_answer)) : '',
    dna.human_answer_at ? field('Decision Time', esc(dna.human_answer_at)) : '',
    dna.approval_mode ? field('Approval Mode', esc(dna.approval_mode)) : '',
    dna.liaison_reasoning ? field('Liaison Reasoning', esc(dna.liaison_reasoning)) : '',
    dna.rework_reason ? field('Rework Reason', esc(dna.rework_reason)) : '',
    dna.rework_count ? field('Rework Count', String(dna.rework_count)) : '',
  ].filter(Boolean);
  if (decisionFields.length) html += renderSection('Decisions', decisionFields, false);

  // Links
  const linkFields = [
    dna.requirement_refs?.length ? field('Requirements', dna.requirement_refs.map(r => `<a href="/r/${r}" class="detail-link">${esc(r)}</a>`).join(', ')) : '',
    dna.pdsa_ref ? field('PDSA Ref', esc(dna.pdsa_ref)) : '',
    dna.abstract_ref ? field('Abstract', esc(dna.abstract_ref)) : '',
    dna.changelog_ref ? field('Changelog', esc(dna.changelog_ref)) : '',
    dna.depends_on?.length ? field('Depends On', dna.depends_on.map(d => esc(d)).join(', ')) : '',
  ].filter(Boolean);
  if (linkFields.length) html += renderSection('Links', linkFields, false);

  // Meta
  html += renderSection('Meta', [
    task.created_at ? field('Created', esc(task.created_at)) : '',
    task.updated_at ? field('Updated', esc(task.updated_at)) : '',
  ].filter(Boolean), false);

  detailBody.innerHTML = html;

  // Actions
  const canConfirm = ['review', 'approval'].includes(task.status);
  const canRework = !['complete', 'cancelled', 'pending'].includes(task.status);
  detailActions.innerHTML = `
    ${canConfirm ? `<button class="ms-btn ms-btn-primary" onclick="confirmTask('${esc(task.slug || task.id)}')">Confirm</button>` : ''}
    ${canRework ? `<button class="ms-btn ms-btn-danger" onclick="reworkTask('${esc(task.slug || task.id)}')">Rework</button>` : ''}
  `;

  // Toggle sections
  detailBody.querySelectorAll('.detail-section-title').forEach(el => {
    el.addEventListener('click', () => {
      el.parentElement.classList.toggle('expanded');
    });
  });

  renderBoard(); // refresh to highlight selected
}

function renderSection(title, fields, expanded = true) {
  if (!fields.length) return '';
  return `<div class="detail-section${expanded ? ' expanded' : ''}">
    <div class="detail-section-title">${title}</div>
    <div class="detail-section-content">${fields.join('')}</div>
  </div>`;
}

function field(label, value) {
  return `<div class="detail-field">
    <div class="detail-field-label">${label}</div>
    <div class="detail-field-value">${value}</div>
  </div>`;
}

function formatImpl(impl) {
  if (typeof impl === 'string') return `<pre>${esc(impl)}</pre>`;
  let html = '';
  if (impl.summary) html += esc(impl.summary);
  if (impl.commit) html += `<div style="font-family:monospace;font-size:11px;color:var(--ms-muted);margin-top:4px;">Commit: ${esc(impl.commit)}</div>`;
  if (impl.branch) html += `<div style="font-family:monospace;font-size:11px;color:var(--ms-muted);">Branch: ${esc(impl.branch)}</div>`;
  return html || `<pre>${esc(JSON.stringify(impl, null, 2))}</pre>`;
}

function formatReview(review) {
  if (typeof review === 'string') return esc(review);
  let html = '';
  if (review.verdict) html += `<strong>${esc(review.verdict)}</strong><br>`;
  if (review.notes) html += esc(review.notes);
  return html || esc(JSON.stringify(review));
}

// --- Global functions (called from HTML onclick) ---

window.closeDetail = function() {
  detailPanel.classList.remove('open');
  detailOverlay.classList.remove('open');
  selectedTaskId = null;
  renderBoard();
};

window.confirmTask = async function(slug) {
  try {
    await client.transition(slug, 'complete', { human_confirmed: true, human_confirmed_via: 'viz' });
    const tasks = await client.query('task', { slug });
    if (tasks.length) cache.set('task', slug, tasks[0]);
    closeDetail();
  } catch (err) { alert('Confirm failed: ' + err.message); }
};

window.reworkTask = async function(slug) {
  const reason = prompt('Rework reason:');
  if (!reason) return;
  try {
    await client.transition(slug, 'rework', { rework_reason: reason });
    const tasks = await client.query('task', { slug });
    if (tasks.length) cache.set('task', slug, tasks[0]);
    closeDetail();
  } catch (err) { alert('Rework failed: ' + err.message); }
};

// --- Filters ---

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    sessionStorage.setItem('kanban-completed-filter', currentFilter);
    renderBoard();
  });
});

// Completed filter dropdown
const completedFilterEl = document.getElementById('completed-filter');
if (completedFilterEl) {
  completedFilterEl.value = currentFilter;
  completedFilterEl.addEventListener('change', () => {
    currentFilter = completedFilterEl.value;
    sessionStorage.setItem('kanban-completed-filter', currentFilter);
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    renderBoard();
  });
}

searchInput.addEventListener('input', () => renderBoard());
projectFilter.addEventListener('change', () => renderBoard());

// --- Init ---

async function init() {
  try {
    // Check if user has any projects
    const projectsRes = await fetch('/api/projects');
    const projectList = await projectsRes.json();
    const projects = Array.isArray(projectList) ? projectList : [];

    if (projects.length === 0) {
      boardEl.innerHTML = `
        <div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
          <div style="font-size:48px;margin-bottom:16px;">📋</div>
          <h2 style="font-size:20px;margin-bottom:8px;">No projects yet</h2>
          <p style="color:var(--ms-muted);margin-bottom:24px;">Add a project to start tracking tasks.</p>
          <a href="/settings" class="ms-btn ms-btn-primary" style="text-decoration:none;display:inline-block;padding:10px 24px;font-size:15px;">Add your first project</a>
          <p style="color:var(--ms-muted);margin-top:16px;font-size:13px;">Paste a Git URL in Settings to get started.</p>
        </div>`;
      statsEl.textContent = '';
      return;
    }

    // Connect to A2A using first project
    await client.connect(projects[0].slug);

    // Populate project filter dropdown
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.slug;
      opt.textContent = p.name;
      projectFilter.appendChild(opt);
    }

    // Query tasks from all projects
    const tasks = await client.query('task', { project_slug: '__all__', limit: 1000 });
    cache.loadAll('task', tasks);
    renderBoard();

    // SSE push updates
    client.on('transition', async (data) => {
      try {
        const updated = await client.query('task', { slug: data.task_slug });
        if (updated.length) {
          cache.set('task', data.task_slug, updated[0]);
          renderBoard();
        }
      } catch { /* silent */ }
    });

    client.on('object_create', async (data) => {
      if (data.object_type === 'task') {
        try {
          const slug = data.twin?.slug || data.twin?.id;
          if (slug) {
            const tasks = await client.query('task', { slug });
            if (tasks.length) { cache.set('task', slug, tasks[0]); renderBoard(); }
          }
        } catch { /* silent */ }
      }
    });

    client.on('object_update', async (data) => {
      if (data.object_type === 'task') {
        try {
          const updated = await client.query('task', { id: data.object_id });
          if (updated.length) {
            const slug = updated[0].slug || updated[0].id;
            cache.set('task', slug, updated[0]);
            renderBoard();
          }
        } catch { /* silent */ }
      }
    });

    // Deep link: /kanban?task=slug
    const params = new URLSearchParams(window.location.search);
    const taskParam = params.get('task');
    if (taskParam) {
      const task = cache.get('task', taskParam);
      if (task) showDetail(task);
    }

  } catch (err) {
    console.error('Kanban init failed:', err);
    if (err.message.includes('Access denied') || err.message.includes('Authentication')) {
      boardEl.innerHTML = '<div class="ms-error">Session expired. <a href="/login">Please log in again</a></div>';
    } else {
      boardEl.innerHTML = `<div class="ms-error">Failed to load: ${esc(err.message)}</div>`;
    }
  }
}

// --- Liaison Approval Mode ---
const liaisonModeEl = document.getElementById('liaison-mode');
async function loadApprovalMode() {
  try {
    const project = projectFilter?.value !== 'all' ? `?project=${projectFilter.value}` : '';
    const res = await fetch(`/api/settings/liaison-approval-mode${project}`);
    if (res.ok) {
      const { mode } = await res.json();
      if (liaisonModeEl) liaisonModeEl.value = mode;
    }
  } catch { /* ignore */ }
}
if (liaisonModeEl) {
  liaisonModeEl.addEventListener('change', async () => {
    const project = projectFilter?.value !== 'all' ? projectFilter.value : undefined;
    await fetch('/api/settings/liaison-approval-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: liaisonModeEl.value, project }),
    });
  });
}

init().then(() => loadApprovalMode());

// ═══════════════════════════════════════════════════════════════
// Team Management — per-project runner control
// Decision 842: Team added via Tasks view, not agent tab.
// ═══════════════════════════════════════════════════════════════

let teamAgents = [];

function getTeamProject() {
  return document.getElementById('project-filter')?.value || 'mindspace';
}

async function addAgent(role) {
  const project = getTeamProject();
  try {
    const res = await fetch(`/api/team/${project}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    teamAgents.push(data);
    renderTeamStatus();
  } catch (e) { console.warn('addAgent failed:', e); }
}

async function addFullTeam() {
  const project = getTeamProject();
  try {
    const res = await fetch(`/api/team/${project}/full`, { method: 'POST' });
    const data = await res.json();
    if (data.agents) teamAgents.push(...data.agents);
    renderTeamStatus();
  } catch (e) { console.warn('addFullTeam failed:', e); }
}

async function terminateAgent(id) {
  const project = getTeamProject();
  await fetch(`/api/team/${project}/agent/${id}`, { method: 'DELETE' });
  teamAgents = teamAgents.filter(a => a.id !== id);
  renderTeamStatus();
}

async function loadTeam() {
  const project = getTeamProject();
  try {
    const res = await fetch(`/api/team/${project}`);
    const data = await res.json();
    teamAgents = data.agents || [];
    renderTeamStatus();
  } catch { /* API may not be ready */ }
}

function renderTeamStatus() {
  const el = document.getElementById('team-status');
  if (!el) return;
  if (teamAgents.length === 0) {
    el.textContent = 'No agents';
    return;
  }
  const dots = teamAgents.map(a =>
    `<span class="team-runner-dot ${a.status || 'ready'}" title="${a.role}: ${a.status || 'ready'}"></span>`
  ).join('');
  el.innerHTML = `${dots} ${teamAgents.length} agent${teamAgents.length > 1 ? 's' : ''}`;
}

// Reload team when project filter changes
document.getElementById('project-filter')?.addEventListener('change', loadTeam);

// Initial team load
setTimeout(loadTeam, 1500);
