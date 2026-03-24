/**
 * Knowledge Browser — Client-rendered via A2A Digital Twins
 *
 * Handles /m/:id, /c/:id, /r/:id routes.
 * Parses type + ID from URL, queries A2A, renders content.
 * Replaces server-rendered renderNodePage() + handleKbRoute().
 */

import { A2AClient } from './a2a-client.js';

const client = new A2AClient();
const pageContent = document.getElementById('page-content');
const breadcrumbEl = document.getElementById('breadcrumb');
const metadataEl = document.getElementById('metadata');

const TYPE_MAP = {
  m: { objectType: 'mission', label: 'Mission', color: '#22c55e', childType: 'capability', childLabel: 'Capabilities', childPrefix: 'c' },
  c: { objectType: 'capability', label: 'Capability', color: '#8ab4f8', childType: 'requirement', childLabel: 'Requirements', childPrefix: 'r' },
  r: { objectType: 'requirement', label: 'Requirement', color: '#eab308', childType: null, childLabel: null, childPrefix: null },
};

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Render markdown using marked.js (loaded via CDN in knowledge.html) */
function renderMarkdown(md) {
  if (!md) return '';
  // Rewrite diagram image paths: docs/diagrams/... → /docs/diagrams/...
  const rewritten = md.replace(/!\[([^\]]*)\]\(docs\//g, '![$1](/docs/');
  // Use marked.js if available, fallback to pre-formatted
  if (typeof marked !== 'undefined' && marked.parse) {
    return marked.parse(rewritten);
  }
  // Fallback: pre-formatted text
  return '<div style="white-space:pre-wrap;">' + escapeHtml(rewritten) + '</div>';
}

function renderBreadcrumb(crumbs) {
  breadcrumbEl.innerHTML = crumbs.map(c =>
    c.href ? `<a href="${c.href}">${escapeHtml(c.label)}</a>` : `<span class="current">${escapeHtml(c.label)}</span>`
  ).join('');
}

function renderChildren(children, childPrefix, childLabel) {
  if (!children || children.length === 0) return '';
  return `<section class="children">
    <h2>${childLabel}</h2>
    <div class="child-grid">
      ${children.map(c => {
        const title = c.title || c.req_id_human || c.id;
        const desc = (c.description || '').slice(0, 100);
        const link = `/${childPrefix}/${c.short_id || c.id}`;
        return `<a href="${link}" class="child-card">
          <h3>${escapeHtml(title)}</h3>
          <p>${escapeHtml(desc)}${(c.description || '').length > 100 ? '...' : ''}</p>
        </a>`;
      }).join('')}
    </div>
  </section>`;
}

function showError(message) {
  pageContent.innerHTML = `<div class="error"><p>${escapeHtml(message)}</p><p><a href="/" style="color:var(--link);">Back to Mission Map</a></p></div>`;
}

async function loadMission(shortId) {
  const missions = await client.query('mission', { short_id: shortId, include_capabilities: true });
  if (missions.length === 0) { showError(`Mission not found: ${shortId}`); return; }
  const m = missions[0];

  document.title = `${m.title} — Mindspace`;
  renderBreadcrumb([
    { label: 'Mindspace', href: '/' },
    { label: m.title, href: null },
  ]);

  const content = m.content_md ? renderMarkdown(m.content_md) : (m.description ? `<p>${escapeHtml(m.description)}</p>` : '');
  const childrenHtml = renderChildren(m.capabilities || [], 'c', 'Capabilities');

  pageContent.innerHTML = `
    <div class="badge" style="background:#22c55e;">Mission</div>
    <h1>${escapeHtml(m.title)}</h1>
    <div class="content">${content}</div>
    ${childrenHtml}`;

  metadataEl.innerHTML = `Version ${m.content_version || 0} <span style="margin-left:16px;"><a href="/" style="color:var(--link);">Mission Map</a> · <a href="/kanban" style="color:var(--link);">Kanban</a></span>`;
}

async function loadCapability(shortId) {
  const caps = await client.query('capability', { short_id: shortId, include_requirements: true, include_tasks: true });
  if (caps.length === 0) { showError(`Capability not found: ${shortId}`); return; }
  const c = caps[0];

  // Get parent mission for breadcrumb
  let missionTitle = '';
  let missionShortId = '';
  if (c.mission_id) {
    const missions = await client.query('mission', { id: c.mission_id });
    if (missions.length > 0) { missionTitle = missions[0].title; missionShortId = missions[0].short_id; }
  }

  document.title = `${c.title} — Mindspace`;
  const crumbs = [{ label: 'Mindspace', href: '/' }];
  if (missionTitle) crumbs.push({ label: missionTitle, href: `/m/${missionShortId}` });
  crumbs.push({ label: c.title, href: null });
  renderBreadcrumb(crumbs);

  const content = c.content_md ? renderMarkdown(c.content_md) : (c.description ? `<p>${escapeHtml(c.description)}</p>` : '');
  const childrenHtml = renderChildren(c.requirements || [], 'r', 'Requirements');

  pageContent.innerHTML = `
    <div class="badge" style="background:#8ab4f8;">Capability</div>
    <h1>${escapeHtml(c.title)}</h1>
    <div class="content">${content}</div>
    ${childrenHtml}`;

  metadataEl.innerHTML = `Version ${c.content_version || 0} <span style="margin-left:16px;"><a href="/" style="color:var(--link);">Mission Map</a> · <a href="/kanban" style="color:var(--link);">Kanban</a></span>`;
}

async function loadRequirement(shortId) {
  const reqs = await client.query('requirement', { short_id: shortId });
  if (reqs.length === 0) { showError(`Requirement not found: ${shortId}`); return; }
  const r = reqs[0];

  document.title = `${r.title || r.req_id_human} — Mindspace`;

  // Build breadcrumb — try to find parent capability and mission
  const crumbs = [{ label: 'Mindspace', href: '/' }];
  if (r.capability_id) {
    const caps = await client.query('capability', { id: r.capability_id });
    if (caps.length > 0) {
      const cap = caps[0];
      if (cap.mission_id) {
        const missions = await client.query('mission', { id: cap.mission_id });
        if (missions.length > 0) crumbs.push({ label: missions[0].title, href: `/m/${missions[0].short_id}` });
      }
      crumbs.push({ label: cap.title, href: `/c/${cap.short_id}` });
    }
  }
  crumbs.push({ label: r.title || r.req_id_human, href: null });
  renderBreadcrumb(crumbs);

  const content = r.description ? `<p>${escapeHtml(r.description)}</p>` : '';

  pageContent.innerHTML = `
    <div class="badge" style="background:#eab308;">Requirement</div>
    <h1>${escapeHtml(r.title || r.req_id_human)}</h1>
    ${r.req_id_human ? `<p style="color:var(--muted);font-size:13px;">${escapeHtml(r.req_id_human)} · Priority: ${r.priority || 'medium'}</p>` : ''}
    <div class="content">${content}</div>`;

  metadataEl.innerHTML = `<a href="/" style="color:var(--link);">Mission Map</a> · <a href="/kanban" style="color:var(--link);">Kanban</a>`;
}

async function init() {
  // Parse URL: /m/{id}, /c/{id}, /r/{id}
  const match = window.location.pathname.match(/^\/(m|c|r)\/([a-zA-Z0-9]{1,12})/);
  if (!match) {
    showError('Invalid URL. Expected /m/{id}, /c/{id}, or /r/{id}');
    return;
  }

  const [, typePrefix, shortId] = match;
  const typeInfo = TYPE_MAP[typePrefix];
  if (!typeInfo) {
    showError(`Unknown type: ${typePrefix}`);
    return;
  }

  try {
    await client.connect('mindspace');

    switch (typePrefix) {
      case 'm': await loadMission(shortId); break;
      case 'c': await loadCapability(shortId); break;
      case 'r': await loadRequirement(shortId); break;
    }
  } catch (err) {
    console.error('Knowledge browser init failed:', err);
    if (err.message.includes('Access denied') || err.message.includes('Authentication')) {
      showError('Session expired or access denied. <a href="/login" style="color:var(--link);">Please log in again</a>');
    } else {
      showError(`Failed to load: ${err.message}`);
    }
  }
}

init();
