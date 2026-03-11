# PDSA: Viz v0.0.15 — Mindspace Logo + Favicons + PWA Install

**Task:** ms-viz-logo-favicon-pwa
**Version:** v0.0.1
**Status:** Design

## Plan

Three deliverables for v0.0.15, all using existing assets (committed in 056fc5a).

### 1. Mindspace Logo in Menu Bar

Add logo image before the project selector in the header:

```html
<div class="header">
  <img src="assets/mindspace-logo.png" alt="Mindspace" class="header-logo">
  <select id="project-selector" class="project-dropdown">
```

CSS:
```css
.header-logo {
  height: 28px;
  width: auto;
  margin-right: 8px;
  vertical-align: middle;
}
```

### 2. Favicon References in HTML Head

Add after `<title>`:

```html
<link rel="icon" type="image/x-icon" href="assets/favicons/favicon.ico">
<link rel="icon" type="image/png" sizes="16x16" href="assets/favicons/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/favicons/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="48x48" href="assets/favicons/favicon-48x48.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/favicons/apple-touch-icon-180x180.png">
<link rel="manifest" href="assets/favicons/manifest.webmanifest">
<meta name="theme-color" content="#1a1a2e">
```

### 3. PWA Install

The manifest.webmanifest needs updating (currently has placeholder name "Image to Favicon From Poper"):

```json
{
  "name": "Mindspace",
  "short_name": "Mindspace",
  "description": "Mindspace Flow Visualization",
  "display": "standalone",
  "start_url": "/",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "icons": [
    { "src": "/assets/favicons/android-chrome-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/favicons/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add a minimal PWA install prompt (beforeinstallprompt event listener) at the bottom of the HTML, after existing script:

```js
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Could add an install button — for now just make it installable
});
```

### Version Creation

1. Copy `viz/versions/v0.0.14/` to `viz/versions/v0.0.15/`
2. Apply all three changes to `viz/versions/v0.0.15/index.html`
3. Apply same changes to `viz/index.html` (root copy)
4. Update `viz/active` symlink to `v0.0.15`
5. Update `viz/changelog.json` with v0.0.15 entry

### Static Asset Serving

The viz server must serve `viz/assets/` directory. Check if `viz/server.js` already serves static files from the `viz/` directory — if so, `assets/` paths will work automatically. If not, add a static file route.

### Files to Change

1. `viz/versions/v0.0.15/index.html` — CREATE (copy v0.0.14 + changes)
2. `viz/index.html` — UPDATE (same changes)
3. `viz/assets/favicons/manifest.webmanifest` — UPDATE (fix name, paths, theme)
4. `viz/active` — UPDATE symlink → v0.0.15
5. `viz/changelog.json` — UPDATE (add v0.0.15 entry)
6. `viz/server.js` — UPDATE if static asset serving needed

## Do

Implementation by DEV agent.

## Study

- Logo visible in menu bar at correct size
- Favicon appears in browser tab
- PWA installable (manifest valid, icons load)
- Both PROD (:4100) and TEST (:4200) serve assets correctly

## Act

Deploy v0.0.15 to test env, verify on :4200.
