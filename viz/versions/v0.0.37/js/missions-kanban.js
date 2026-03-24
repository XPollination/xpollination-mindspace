/**
 * Missions Kanban — Lifecycle board for Mission Digital Twins
 *
 * Same technology as task kanban. MissionTwin status drives column placement.
 * States: draft → ready → active → complete + deprecated
 */

import { A2AClient } from './a2a-client.js';
import { TwinCache } from './twin-cache.js';

const client = new A2AClient();
const cache = new TwinCache();

const boardEl = document.getElementById('board');
const statsEl = document.getElementById('stats');
const detailPanel = document.getElementById('detail-panel');
const detailOverlay = document.getElementById('detail-overlay');
const detailTitle = document.getElementById('detail-title');
const detailBody = document.getElementById('detail-body');
const detailActions = document.getElementById('detail-actions');
const projectFilter = document.getElementById('project-filter');
const searchInput = document.getElementById('search');

let selectedMissionId = null;

// --- Column Configuration (Mission Lifecycle) ---
const COLUMNS = [
  { id: 'draft',      label: 'Draft',      statuses: ['draft'],      color: 'var(--ms-status-pending)' },
  { id: 'ready',      label: 'Ready',      statuses: ['ready'],      color: 'var(--ms-status-ready)' },
  { id: 'active',     label: 'Active',     statuses: ['active'],     color: 'var(--ms-status-active)' },
  { id: 'complete',   label: 'Complete',    statuses: ['complete'],   color: 'var(--ms-status-complete)' },
  { id: 'deprecated', label: 'Deprecated',  statuses: ['deprecated'], color: 'var(--ms-status-cancelled)' },
];

const STATUS_COLORS = {
  draft: 'var(--ms-status-pending)', ready: 'var(--ms-status-ready)',
  active: 'var(--ms-status-active)', complete: 'var(--ms-status-complete)',
  deprecated: 'var(--ms-status-cancelled)',
};

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getColumn(mission) {
  for (const col of COLUMNS) {
    if (col.statuses.includes(mission.status)) return col.id;
  }
  return 'draft';
}

function filterMissions(missions) {
  let filtered = missions;
  const search = searchInput.value.toLowerCase().trim();
  if (search) {
    filtered = filtered.filter(m => (m.title || '').toLowerCase().includes(search) || (m.description || '').toLowerCase().includes(search));
  }
  const proj = projectFilter.value;
  if (proj !== 'all') {
    filtered = filtered.filter(m => m.project_slug === proj);
  }
  return filtered;
}

function renderBoard() {
  const allMissions = cache.getAll('mission');
  const missions = filterMissions(allMissions);

  const groups = {};
  for (const col of COLUMNS) groups[col.id] = [];
  for (const m of missions) {
    const colId = getColumn(m);
    if (groups[colId]) groups[colId].push(m);
  }

  boardEl.innerHTML = COLUMNS.map(col => {
    const cards = groups[col.id] || [];
    return `<div class="kanban-column">
      <div class="column-header">
        <span>${col.label}</span>
        <span class="column-count">${cards.length}</span>
      </div>
      <div class="column-cards">
        ${cards.map(m => renderCard(m)).join('')}
      </div>
    </div>`;
  }).join('');

  const active = allMissions.filter(m => m.status === 'active').length;
  statsEl.textContent = `${active} active / ${allMissions.length} total`;

  boardEl.querySelectorAll('.task-card').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const mission = cache.get('mission', id);
      if (mission) showDetail(mission);
    });
  });
}

function renderCard(m) {
  const capCount = (m.capabilities || []).length;
  const excerpt = (m.description || '').substring(0, 80);
  const isSelected = (m.id || m.short_id) === selectedMissionId;
  const dimmed = m.status === 'deprecated' ? 'opacity:0.6;' : '';

  return `<div class="task-card${isSelected ? ' selected' : ''}" data-id="${esc(m.id || m.short_id)}" style="${dimmed}border-left:3px solid ${STATUS_COLORS[m.status] || 'var(--ms-muted)'};">
    <div class="task-title">${esc(m.title)}</div>
    <div class="task-meta">
      <span class="task-badge" style="background:${STATUS_COLORS[m.status]}">${m.status}</span>
      ${capCount ? `<span class="task-project">${capCount} caps</span>` : ''}
    </div>
    ${excerpt ? `<div style="font-size:11px;color:var(--ms-muted);margin-top:4px;">${esc(excerpt)}${(m.description||'').length > 80 ? '...' : ''}</div>` : ''}
  </div>`;
}

// --- Detail Panel ---

function showDetail(mission) {
  selectedMissionId = mission.id || mission.short_id;
  detailTitle.textContent = mission.title;
  detailPanel.classList.add('open');
  detailOverlay.classList.add('open');

  const caps = mission.capabilities || [];
  const contentHtml = mission.content_md && typeof marked !== 'undefined' && marked.parse
    ? marked.parse(mission.content_md.replace(/!\[([^\]]*)\]\(docs\//g, '![$1](/docs/'))
    : (mission.description ? `<p>${esc(mission.description)}</p>` : '<p style="color:var(--ms-muted);">No content yet.</p>');

  let html = '';
  html += `<div class="detail-section expanded">
    <div class="detail-section-title">Overview</div>
    <div class="detail-section-content">
      <div class="detail-field"><div class="detail-field-label">Status</div><div class="detail-field-value"><span class="task-badge" style="background:${STATUS_COLORS[mission.status]}">${mission.status}</span></div></div>
      ${mission.project_slug ? `<div class="detail-field"><div class="detail-field-label">Project</div><div class="detail-field-value">${esc(mission.project_slug)}</div></div>` : ''}
      <div class="detail-field"><div class="detail-field-label">Capabilities</div><div class="detail-field-value">${caps.length > 0 ? caps.map(c => `<a href="/c/${c.short_id || c.id}" class="detail-link">${esc(c.title)}</a>`).join(', ') : 'None'}</div></div>
    </div>
  </div>`;

  html += `<div class="detail-section expanded">
    <div class="detail-section-title">Content</div>
    <div class="detail-section-content"><div class="ms-content">${contentHtml}</div></div>
  </div>`;

  detailBody.innerHTML = html;

  // Transition buttons based on current state
  const transitions = {
    draft: [{ label: 'Approve Scope', to: 'ready', cls: 'ms-btn-primary' }],
    ready: [{ label: 'Start Implementation', to: 'active', cls: 'ms-btn-primary' }],
    active: [{ label: 'Mark Complete', to: 'complete', cls: 'ms-btn-primary' }],
    complete: [],
    deprecated: [],
  };
  const available = transitions[mission.status] || [];
  // Deprecate is always available except for already deprecated
  if (mission.status !== 'deprecated' && mission.status !== 'complete') {
    available.push({ label: 'Deprecate', to: 'deprecated', cls: 'ms-btn-danger' });
  }

  detailActions.innerHTML = available.map(t =>
    `<button class="ms-btn ${t.cls}" onclick="transitionMission('${esc(mission.id)}', '${t.to}')">${t.label}</button>`
  ).join('') + `<a href="/m/${mission.short_id || mission.id}" class="ms-btn ms-btn-ghost" style="text-decoration:none;">View Full Page</a>`;

  detailBody.querySelectorAll('.detail-section-title').forEach(el => {
    el.addEventListener('click', () => el.parentElement.classList.toggle('expanded'));
  });

  renderBoard();
}

window.closeDetail = function() {
  detailPanel.classList.remove('open');
  detailOverlay.classList.remove('open');
  selectedMissionId = null;
  renderBoard();
};

window.transitionMission = async function(missionId, toStatus) {
  try {
    // Use A2A TRANSITION with mission type indicator
    const res = await fetch('/a2a/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: client.agentId,
        type: 'TRANSITION',
        task_slug: missionId,
        to_status: toStatus,
        payload: { twin_type: 'mission' }
      }),
    });
    const data = await res.json();
    if (data.type === 'ERROR') { alert('Transition failed: ' + data.error); return; }

    // Refresh missions
    const updated = await client.query('mission', { id: missionId, include_capabilities: true });
    if (updated.length) {
      cache.set('mission', missionId, updated[0]);
      showDetail(updated[0]);
    }
  } catch (err) { alert('Transition failed: ' + err.message); }
};

searchInput.addEventListener('input', () => renderBoard());
projectFilter.addEventListener('change', () => renderBoard());

// --- Init ---

async function init() {
  try {
    const projectsRes = await fetch('/api/projects');
    const projects = Array.isArray(await projectsRes.json()) ? await (await fetch('/api/projects')).json() : [];

    if (projects.length === 0) {
      boardEl.innerHTML = `<div style="text-align:center;padding:60px 20px;grid-column:1/-1;">
        <div style="font-size:48px;margin-bottom:16px;">🎯</div>
        <h2 style="font-size:20px;margin-bottom:8px;">No projects yet</h2>
        <p style="color:var(--ms-muted);margin-bottom:24px;">Add a project to manage missions.</p>
        <a href="/settings" class="ms-btn ms-btn-primary" style="text-decoration:none;display:inline-block;padding:10px 24px;">Add your first project</a>
      </div>`;
      return;
    }

    await client.connect(projects[0].slug);

    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p.slug;
      opt.textContent = p.name;
      projectFilter.appendChild(opt);
    }

    const missions = await client.query('mission', { project_slug: '__all__', include_capabilities: true });
    cache.loadAll('mission', missions);
    renderBoard();

    client.on('transition', async () => {
      const updated = await client.query('mission', { project_slug: '__all__', include_capabilities: true });
      cache.loadAll('mission', updated);
      renderBoard();
    });

  } catch (err) {
    console.error('Missions kanban init failed:', err);
    boardEl.innerHTML = `<div class="ms-error">Failed to load: ${esc(err.message)}</div>`;
  }
}

init();
