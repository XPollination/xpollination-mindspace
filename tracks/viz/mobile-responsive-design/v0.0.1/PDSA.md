# PDSA: Mobile-Responsive CSS for Viz

**Task:** mobile-responsive-design
**Version:** v0.0.1
**Status:** PLAN
**Requirement:** REQ-VKF-004

## Problem

Viz pages are desktop-only. No responsive breakpoints, touch targets too small, tables overflow on mobile.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | CSS-only hamburger menu (checkbox hack) | No JS needed. Works without JavaScript. Accessible. |
| D2 | Horizontal scroll for tables | Stacking rows loses column context. Scroll preserves structure. |
| D3 | Two breakpoints: 768px (tablet), 480px (mobile) | Standard breakpoints. Covers 95% of devices. |

### Breakpoints

```css
/* Tablet: 768px */
@media (max-width: 768px) {
  .mission-grid { grid-template-columns: repeat(2, 1fr); }
  .container { padding: 16px 12px; }
  .header nav { display: none; }
  .hamburger { display: block; }
}

/* Mobile: 480px */
@media (max-width: 480px) {
  .mission-grid { grid-template-columns: 1fr; }
  .child-grid { grid-template-columns: 1fr; }
  h1 { font-size: 22px; }
  h2 { font-size: 18px; }
}
```

### Touch Targets

All interactive elements minimum 44x44px (WCAG). Padding increased on buttons, links, tab items at mobile breakpoints.

### Table Overflow

```css
.content table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

### Hamburger Menu

CSS checkbox hack: hidden checkbox + label (hamburger icon) + nav visibility tied to :checked state. Menu slides from right.

### Acceptance Criteria

- AC1: Mission cards stack 2-col at 768px, 1-col at 480px
- AC2: Tables horizontally scrollable on mobile
- AC3: Touch targets minimum 44px
- AC4: Hamburger menu replaces nav tabs on mobile
- AC5: Font sizes scale down at mobile
- AC6: No horizontal page overflow at any breakpoint

### Test Plan

api/__tests__/mobile-responsive.test.ts
