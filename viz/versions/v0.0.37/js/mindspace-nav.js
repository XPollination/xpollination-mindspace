/**
 * Mindspace Navigation — Shared nav bar + theme toggle
 *
 * Import on every page: <script type="module" src="/js/mindspace-nav.js"></script>
 * Auto-injects nav bar, sets active link, handles theme persistence.
 * On /login and /register: injects theme toggle only, no full nav.
 */

// --- Theme: apply immediately (before DOM renders) to prevent flash ---
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// --- Nav injection ---
const AUTH_PATHS = ['/login', '/register'];
const NAV_LINKS = [
  { href: '/', label: 'Mission Map', match: (p) => p === '/' },
  { href: '/kanban', label: 'Kanban', match: (p) => p === '/kanban' || p === '/tasks' },
];

function isAuthPage() {
  return AUTH_PATHS.some(p => window.location.pathname === p);
}

function createNav() {
  const path = window.location.pathname;
  const nav = document.createElement('nav');
  nav.className = 'ms-nav';

  // Brand
  const brand = document.createElement('a');
  brand.href = '/';
  brand.className = 'ms-nav-brand';
  brand.innerHTML = '<img src="/assets/mindspace-logo-64.webp" alt="" width="28" height="28"><span>Mindspace</span>';

  // Links
  const links = document.createElement('div');
  links.className = 'ms-nav-links';
  for (const link of NAV_LINKS) {
    const a = document.createElement('a');
    a.href = link.href;
    a.className = 'ms-nav-link' + (link.match(path) ? ' active' : '');
    a.textContent = link.label;
    links.appendChild(a);
  }

  // Right side
  const right = document.createElement('div');
  right.className = 'ms-nav-right';

  const themeBtn = document.createElement('button');
  themeBtn.className = 'ms-theme-toggle';
  themeBtn.innerHTML = '&#127763;';
  themeBtn.title = 'Toggle dark mode';
  themeBtn.onclick = toggleTheme;

  const settingsLink = document.createElement('a');
  settingsLink.href = '/settings';
  settingsLink.className = 'ms-nav-link' + (path === '/settings' ? ' active' : '');
  settingsLink.textContent = 'Settings';

  const logoutLink = document.createElement('a');
  logoutLink.href = '/logout';
  logoutLink.className = 'ms-nav-link';
  logoutLink.textContent = 'Logout';

  // Meeting icon (feature-flagged)
  // Show immediately from cache, refresh in background to stay in sync
  const meetingLink = document.createElement('a');
  meetingLink.href = '/meeting';
  meetingLink.className = 'ms-nav-link' + (path === '/meeting' ? ' active' : '');
  meetingLink.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>';
  meetingLink.title = 'Meeting';
  const cachedFlag = sessionStorage.getItem('flag:XPO_FEATURE_LIVEKIT_MEETING');
  meetingLink.style.display = cachedFlag === '1' ? '' : 'none';
  fetch('/api/projects/xpollination-mindspace/flags/mine')
    .then(r => r.ok ? r.json() : [])
    .then(flags => {
      const has = flags.some(f => f.flag_name === 'XPO_FEATURE_LIVEKIT_MEETING');
      sessionStorage.setItem('flag:XPO_FEATURE_LIVEKIT_MEETING', has ? '1' : '0');
      meetingLink.style.display = has ? '' : 'none';
    })
    .catch(() => {});

  right.appendChild(themeBtn);
  right.appendChild(meetingLink);
  right.appendChild(settingsLink);
  right.appendChild(logoutLink);

  nav.appendChild(brand);
  nav.appendChild(links);
  nav.appendChild(right);

  return nav;
}

function createThemeToggleOnly() {
  const btn = document.createElement('button');
  btn.className = 'ms-theme-toggle';
  btn.style.cssText = 'position:fixed;top:12px;right:12px;z-index:100;';
  btn.innerHTML = '&#127763;';
  btn.title = 'Toggle dark mode';
  btn.onclick = toggleTheme;
  return btn;
}

document.addEventListener('DOMContentLoaded', () => {
  if (isAuthPage()) {
    document.body.appendChild(createThemeToggleOnly());
  } else {
    document.body.prepend(createNav());
    document.body.classList.add('ms-has-nav');
  }
});

export { toggleTheme };
