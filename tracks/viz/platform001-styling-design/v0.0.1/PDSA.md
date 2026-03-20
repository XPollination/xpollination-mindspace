# PDSA: PLATFORM-001 Document Styling for Knowledge Browser

**Task:** platform001-styling-design  
**Version:** v0.0.1  
**Status:** PLAN  
**Requirement:** REQ-KB-006

## Problem

KB pages use basic inline CSS. Missing: alternating table rows, syntax highlighting, heading hierarchy, SVG styling, print-friendly layout.

## Plan

### Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Custom CSS vars (no framework) | Already using CSS vars. No build pipeline. |
| D2 | highlight.js for syntax highlighting | Lightweight, works with marked.js, auto-detect. |
| D3 | Extend existing inline style block | Server-rendered pattern preserved. |
| D4 | Print-friendly @media print | Hide nav, force white bg. |
| D5 | SVG: max-width + center + white bg dark mode | Protect light-designed diagrams. |

### Typography Scale

Body 15px/1.7, h1 28px/700, h2 22px/600, h3 18px/600, h4 15px/600. Code 13px. Table 14px.

### Table Styling

New --stripe-bg var (#f9fafb light, #1e1e30 dark). tr:nth-child(even) td gets stripe. Bottom border only on td.

### Code Syntax Highlighting

highlight.js: JS, TS, SQL, bash, JSON. Custom marked renderer wraps in hljs class. Dual theme tokens.

### Print Stylesheet

Hide theme-toggle, nav, siblings. Force white bg, 12pt. Show URLs after links.

### Acceptance Criteria

- AC1: Alternating table rows
- AC2: Code syntax highlighting (JS, TS, SQL, bash, JSON)
- AC3: Typography scale (h1-h4)
- AC4: SVG centering with borders
- AC5: Print view hides navigation
- AC6: Both themes correct
- AC7: highlight.js npm dependency

### Test Plan

api/__tests__/platform001-styling.test.ts: nth-child, hljs, typography, SVG, print, dependency.
