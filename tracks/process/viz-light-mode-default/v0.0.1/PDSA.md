# PDSA: Light Mode Default with Dark Mode Toggle

**Task:** `viz-light-mode-default`
**Version:** v0.0.1
**Status:** Design

## Plan

### CSS Variable Architecture

```css
/* Light theme (default — no data-theme attribute needed) */
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-card: #ffffff;
  --text-primary: #1a1a2e;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --accent: #e94560;
  --link: #2563eb;
  --success: #16a34a;
  --warning: #eab308;
  --error: #ef4444;
  --code-bg: #f3f4f6;
  --shadow: 0 1px 3px rgba(0,0,0,0.1);
}

/* Dark theme (activated via data-theme="dark") */
[data-theme="dark"] {
  --bg-primary: #0a0a1a;
  --bg-secondary: #1a1e2e;
  --bg-card: #161b22;
  --text-primary: #e0e0e0;
  --text-secondary: #8b949e;
  --border: #30363d;
  --accent: #e94560;
  --link: #58a6ff;
  --success: #22c55e;
  --warning: #eab308;
  --error: #ef4444;
  --code-bg: #1f2937;
  --shadow: 0 1px 3px rgba(0,0,0,0.3);
}
```

### Toggle Button (in header)

```html
<button id="theme-toggle" onclick="toggleTheme()" title="Toggle theme">
  <span id="theme-icon">☀️</span>
</button>
```

### JavaScript

```javascript
function initTheme() {
  const saved = localStorage.getItem('theme');
  const theme = saved || 'light'; // default to light
  applyTheme(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('theme', next);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.getElementById('theme-icon').textContent = '🌙';
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.getElementById('theme-icon').textContent = '☀️';
  }
}

// Initialize on load
initTheme();
```

### Migration Path

1. Current CSS uses hardcoded dark colors → replace with CSS variables
2. Add `:root` (light) and `[data-theme="dark"]` (dark) variable blocks
3. Replace all hardcoded color values with `var(--name)` references
4. Add toggle button to header
5. Add JS for theme switching + localStorage persistence

### Knowledge Browser Pages

`renderNodePage()` in viz/server.js must include the same CSS variables and toggle script so KB pages match the dashboard theme.

### New Version

Create next viz version (v0.0.37 or next available) with theme changes.

## Do

DEV:
1. Create new viz version directory
2. Replace hardcoded colors with CSS variables
3. Add light/dark variable blocks
4. Add toggle button and JS
5. Update renderNodePage() for KB pages
6. Update active symlink

## Study

Verify (browser):
- Default loads as light theme (white background)
- Toggle switches to dark instantly
- Refresh preserves choice (localStorage)
- Clear localStorage → defaults back to light
- Both dashboard and KB pages respect theme
- All text readable in both modes

## Act

### Design Decisions
1. **Light default**: Professional appearance for external visitors. Dark for power users who toggle.
2. **CSS custom properties**: One change point — all colors cascade automatically.
3. **localStorage, not server**: Client-side preference. No API call needed.
4. **No emoji in production**: Toggle icon uses CSS/SVG, not emoji (emoji shown here for readability).
5. **Accent color unchanged**: `#e94560` works on both light and dark backgrounds.
