# PDSA: Login Page Redesign — Light Theme, XPollination Branding

**Task:** ms-login-page-redesign
**Version:** v0.0.1
**Status:** PLAN
**Roadmap:** ROAD-001 v0.0.15 Phase 1.7

## Problem

Current login page (v0.0.25 on feature/auth-e2e) is dark-themed, minimal, no branding, no personality. First impression for users must communicate what Mindspace IS. Need light theme with XPollination branding and 2026 UX best practices.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Light theme — white/warm background (#fafafa or #f8f9fa) | Trust signal, professional product feel vs developer-tool dark |
| D2 | Image pipeline — generate 120px, 64px, 32px WebP+PNG from 723px source | Original 426KB must never be served; target <15KB total for login |
| D3 | Visual hierarchy — Logo (centered, 120px) → Tagline → Form → CTA | Clear information architecture |
| D4 | Tagline: "Where humans and agents think together" or similar | Communicates Mindspace's purpose on first contact |
| D5 | CTA button uses brand colors from logo (warm orange or blue-green gradient) | Brand consistency, moves away from generic GitHub-green |
| D6 | Micro-interactions — subtle focus animations, button states, inline feedback | 2026 UX: responsive, polished feel without JS frameworks |
| D7 | System-ui font stack, no external fonts | Performance: FCP < 1s, total page < 50KB |
| D8 | `<picture>` element with WebP primary + PNG fallback | Browser support optimization |
| D9 | Accessibility — AA contrast, focus indicators, aria-describedby on errors | WCAG compliance |
| D10 | Apply same redesign to register.html | Consistent brand experience |
| D11 | New viz version v0.0.27 (DNA says v0.0.26 but v0.0.25 is latest) | Iterate version for clean separation |
| D12 | Responsive: form max-width 400px, logo scales with viewport | Works on 320px mobile through desktop |

### Image Pipeline (MANDATORY)

```
Source: viz/assets/mindspace-logo.png (723x723, 426KB)

Generate:
- viz/assets/mindspace-logo-120.webp  (120x120, ~5KB)
- viz/assets/mindspace-logo-120.png   (120x120, ~8KB, fallback)
- viz/assets/mindspace-logo-64.webp   (64x64, ~3KB)
- viz/assets/mindspace-logo-64.png    (64x64, ~5KB, fallback)
- viz/assets/mindspace-logo-32.webp   (32x32, ~2KB)
- viz/assets/mindspace-logo-32.png    (32x32, ~3KB, fallback)

Tool: sharp (npm) or imagemagick CLI
```

### Acceptance Criteria

- AC1: Login page uses light theme (white/warm background, dark text)
- AC2: XPollination logo displayed centered above form at 120px
- AC3: Logo served as WebP with PNG fallback via `<picture>` element
- AC4: No image larger than 15KB served to browser
- AC5: Tagline visible below logo
- AC6: CTA button uses brand colors (not GitHub green)
- AC7: Input fields have focus animations
- AC8: Error/success feedback inline (not alert())
- AC9: Page weight < 50KB total
- AC10: Color contrast meets WCAG AA
- AC11: Register page matches login page styling
- AC12: Responsive down to 320px viewport
- AC13: All responsive logo sizes (120, 64, 32) generated as WebP+PNG

### Files to Change

- `viz/versions/v0.0.27/login.html` — New version, complete redesign
- `viz/versions/v0.0.27/register.html` — Matching redesign
- `viz/assets/mindspace-logo-120.webp` — Generated
- `viz/assets/mindspace-logo-120.png` — Generated
- `viz/assets/mindspace-logo-64.webp` — Generated
- `viz/assets/mindspace-logo-64.png` — Generated
- `viz/assets/mindspace-logo-32.webp` — Generated
- `viz/assets/mindspace-logo-32.png` — Generated

### Color Palette (from logo analysis)

- Background: #fafafa (near-white)
- Card: #ffffff with subtle shadow
- Text primary: #1a1a2e (near-black)
- Text secondary: #4a4a6a
- Accent/CTA: Extract from logo (warm orange or teal)
- Error: #dc3545
- Success: #28a745
- Border: #e0e0e0

### Test Plan

1. Visual: Open login page — light theme, logo visible, form centered
2. Performance: Page weight < 50KB, no external font requests
3. Accessibility: Run axe-core, verify AA contrast
4. Responsive: Test at 320px, 768px, 1440px
5. Functional: Login form still works (POST /api/auth/login)
6. Image: Verify WebP served to modern browsers, PNG fallback works

## Do

(Implementation by DEV agent)

## Study

(Post-implementation verification)

## Act

(Lessons learned)
