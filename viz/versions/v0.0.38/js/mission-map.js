/**
 * Mission Map — Client-rendered via A2A Digital Twins
 *
 * Connects to A2A, queries missions with capabilities, renders cards.
 * Replaces server-rendered renderMissionMap() + getMissionOverview().
 */

import { A2AClient } from './a2a-client.js';
import { TwinCache } from './twin-cache.js';

const client = new A2AClient();
const cache = new TwinCache();
const content = document.getElementById('mission-content');
const footerStats = document.getElementById('footer-stats');

const STATUS_COLORS = {
  active: '#48bb78',
  draft: '#4299e1',
  deprecated: '#a0aec0',
  blocked: '#e53e3e',
  complete: '#38a169',
};

function renderCard(mission, dimmed = false) {
  const caps = mission.capabilities || [];
  const capCount = caps.length;
  const color = STATUS_COLORS[mission.status] || '#a0aec0';
  const link = mission.short_id ? `/m/${mission.short_id}` : `/m/${mission.id}`;
  const excerpt = (mission.description || '').substring(0, 120);
  const cardStyle = dimmed ? 'opacity:0.6;' : '';

  return `<a href="${link}" class="mission-card" style="${cardStyle}border-left:3px solid ${color};">
    <div class="card-header">
      <h3 class="card-title">${escapeHtml(mission.title)}</h3>
      <span class="status-badge" style="background:${color};">${mission.status}</span>
    </div>
    <p class="card-description">${escapeHtml(excerpt)}${(mission.description || '').length > 120 ? '...' : ''}</p>
    <span class="cap-count">${capCount} capabilities</span>
  </a>`;
}

function renderMissions(missions) {
  if (missions.length === 0) {
    content.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--ms-muted);">
        <p style="font-size:16px;margin-bottom:8px;">No missions yet in your projects.</p>
        <p style="font-size:13px;">Missions will appear here as they are created in your projects.</p>
      </div>`;
    footerStats.innerHTML = '';
    return;
  }

  const active = missions.filter(m => m.status === 'active');
  const deprecated = missions.filter(m => m.status !== 'active');
  const totalCaps = missions.reduce((sum, m) => sum + (m.capabilities || []).length, 0);

  let html = '<div class="mission-grid">';
  html += active.map(m => renderCard(m)).join('');
  html += '</div>';

  if (deprecated.length > 0) {
    html += '<section class="deprecated"><h2>Deprecated</h2>';
    html += '<div class="mission-grid dimmed">';
    html += deprecated.map(m => renderCard(m, true)).join('');
    html += '</div></section>';
  }

  content.innerHTML = html;
  footerStats.innerHTML = `<span>${active.length} active &middot; ${totalCaps} capabilities &middot; <a href="/kanban" style="color:var(--link);text-decoration:none;">Kanban Board</a></span>`;
}

function showError(message) {
  content.innerHTML = `<div class="error"><p>${escapeHtml(message)}</p><p><a href="/" style="color:var(--link);">Retry</a></p></div>`;
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showOnboarding() {
  content.innerHTML = `
    <div style="text-align:center;padding:60px 20px;">
      <div style="font-size:48px;margin-bottom:16px;">🚀</div>
      <h2 style="font-size:20px;margin-bottom:8px;">Welcome to Mindspace!</h2>
      <p style="color:var(--ms-muted);margin-bottom:24px;">You're not part of any projects yet.</p>
      <a href="/settings" class="ms-btn ms-btn-primary" style="text-decoration:none;display:inline-block;padding:10px 24px;font-size:15px;">Add your first project</a>
      <p style="color:var(--ms-muted);margin-top:16px;font-size:13px;">Paste a Git URL in Settings to get started — or ask a project admin to invite you.</p>
    </div>`;
  footerStats.innerHTML = '';
}

async function init() {
  try {
    // Check if user has any projects before connecting to A2A
    const projectsRes = await fetch('/api/projects');
    const projects = await projectsRes.json();
    const projectList = Array.isArray(projects) ? projects : [];

    if (projectList.length === 0) {
      showOnboarding();
      return;
    }

    // Connect to A2A using first project
    await client.connect(projectList[0].slug);

    // Query only ACTIVE missions (knowledge-first view). Draft/ready/deprecated are on /missions board.
    const missions = await client.query('mission', { status: 'active', include_capabilities: true });

    // Cache them
    cache.loadAll('mission', missions);

    // Render
    renderMissions(missions);

    // Listen for live updates
    client.on('transition', (data) => {
      client.query('mission', { include_capabilities: true }).then(updated => {
        cache.loadAll('mission', updated);
        renderMissions(updated);
      }).catch(() => {});
    });

  } catch (err) {
    console.error('Mission Map init failed:', err);
    if (err.message.includes('Access denied') || err.message.includes('Authentication')) {
      showError('Session expired. <a href="/login" style="color:var(--link);">Please log in again</a>');
    } else {
      showError(`Failed to load missions: ${err.message}`);
    }
  }
}

init();
