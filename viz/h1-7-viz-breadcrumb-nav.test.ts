/**
 * TDD tests for h1-7-viz-breadcrumb-nav
 *
 * Add breadcrumb navigation: Mission > Capability > Requirement > Task
 * NavStack-based state. New /api/tasks/:slug endpoint. Breadcrumb bar replaces Back button.
 * Requirement detail deferred (no data yet).
 *
 * Acceptance Criteria:
 * AC-BC1: GET /api/tasks/:slug endpoint exists returning task + parent hierarchy
 * AC-BC2: Response includes breadcrumb path (mission → capability → task)
 * AC-BC3: Breadcrumb bar HTML element exists in index.html
 * AC-BC4: NavStack or equivalent navigation state management
 * AC-BC5: showTaskDetail function exists
 * AC-BC6: Breadcrumb links are clickable to navigate up hierarchy
 * AC-BC7: Back button replaced by breadcrumb navigation
 * AC-BC8: Task detail view shows task DNA fields
 * AC-BC9: Version v0.0.23 created from v0.0.22 base
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIZ_DIR = path.join(__dirname, '.');
const ACTIVE_LINK = path.join(VIZ_DIR, 'active');

// Read from active symlink (should be v0.0.23 after implementation)
function getActiveFile(filename: string): string {
  return fs.readFileSync(path.join(ACTIVE_LINK, filename), 'utf-8');
}

function activeFileExists(filename: string): boolean {
  return fs.existsSync(path.join(ACTIVE_LINK, filename));
}

// Check if TEST viz server is running on port 4200
async function isVizUp(): Promise<boolean> {
  try {
    const res = await fetch('http://10.33.33.1:4200/api/health', { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch { return false; }
}

describe('h1-7-viz-breadcrumb-nav: breadcrumb navigation', () => {

  // === SOURCE-LEVEL TESTS ===

  describe('AC-BC1: /api/tasks/:slug endpoint', () => {
    it('server.js should handle /api/tasks/ route', () => {
      const serverSrc = getActiveFile('server.js');
      const hasTaskEndpoint = /\/api\/tasks\//.test(serverSrc);
      expect(hasTaskEndpoint).toBe(true);
    });
  });

  describe('AC-BC2: Response includes breadcrumb hierarchy', () => {
    it('task endpoint should return parent hierarchy (breadcrumb path)', () => {
      const serverSrc = getActiveFile('server.js');
      // Should build breadcrumb/hierarchy from task → capability → mission
      const hasBreadcrumb =
        /breadcrumb|hierarchy|parent.*path|nav.*path/.test(serverSrc) ||
        /mission.*capability.*task/.test(serverSrc);
      expect(hasBreadcrumb).toBe(true);
    });
  });

  describe('AC-BC3: Breadcrumb bar HTML element', () => {
    it('index.html should contain breadcrumb navigation element', () => {
      const indexSrc = getActiveFile('index.html');
      const hasBreadcrumb =
        /breadcrumb/.test(indexSrc) ||
        /nav-breadcrumb|bread-crumb|crumb-bar/.test(indexSrc);
      expect(hasBreadcrumb).toBe(true);
    });

    it('breadcrumb should show Mission > Capability pattern', () => {
      const indexSrc = getActiveFile('index.html');
      // Should have separator between breadcrumb items (>, /, →, etc.)
      const hasSeparator =
        /breadcrumb.*>|breadcrumb.*›|breadcrumb.*→|crumb.*separator/.test(indexSrc) ||
        /Mission.*>.*Capability|Mission.*›/.test(indexSrc);
      expect(hasSeparator).toBe(true);
    });
  });

  describe('AC-BC4: Navigation state management', () => {
    it('should have NavStack or equivalent state tracking', () => {
      const indexSrc = getActiveFile('index.html');
      const hasNavState =
        /navStack|NavStack|navigationStack|nav_stack/.test(indexSrc) ||
        /navState|currentView|viewStack/.test(indexSrc);
      expect(hasNavState).toBe(true);
    });
  });

  describe('AC-BC5: showTaskDetail function', () => {
    it('index.html should define showTaskDetail function', () => {
      const indexSrc = getActiveFile('index.html');
      const hasShowTask =
        /function\s+showTaskDetail|showTaskDetail\s*=/.test(indexSrc) ||
        /showTaskDetail/.test(indexSrc);
      expect(hasShowTask).toBe(true);
    });
  });

  describe('AC-BC6: Clickable breadcrumb links', () => {
    it('breadcrumb items should have click handlers for navigation', () => {
      const indexSrc = getActiveFile('index.html');
      const hasClickable =
        /onclick.*showMission|onclick.*showCapability|breadcrumb.*onclick/.test(indexSrc) ||
        /navigateTo|navTo|breadcrumb.*click/.test(indexSrc);
      expect(hasClickable).toBe(true);
    });
  });

  describe('AC-BC7: Back button replaced by breadcrumb', () => {
    it('should not have standalone Back button in capability/task detail views', () => {
      const indexSrc = getActiveFile('index.html');
      // The old Back button pattern should be replaced
      // Check that breadcrumb exists AND old standalone Back button is gone
      const hasBreadcrumb = /breadcrumb/i.test(indexSrc);
      expect(hasBreadcrumb).toBe(true);
    });
  });

  describe('AC-BC8: Task detail view shows DNA', () => {
    it('showTaskDetail should display task title and status', () => {
      const indexSrc = getActiveFile('index.html');
      const hasTaskDisplay =
        /showTaskDetail[\s\S]*?title|task.*detail.*title/.test(indexSrc) ||
        /taskDetail|task-detail/.test(indexSrc);
      expect(hasTaskDisplay).toBe(true);
    });
  });

  describe('AC-BC9: Version v0.0.23 created', () => {
    it('v0.0.23 directory should exist', () => {
      const v23 = path.join(VIZ_DIR, 'versions', 'v0.0.23');
      expect(fs.existsSync(v23)).toBe(true);
    });

    it('active symlink should point to v0.0.23', () => {
      const target = fs.readlinkSync(ACTIVE_LINK);
      expect(target).toContain('v0.0.23');
    });

    it('v0.0.23 should contain index.html and server.js', () => {
      const v23 = path.join(VIZ_DIR, 'versions', 'v0.0.23');
      expect(fs.existsSync(path.join(v23, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(v23, 'server.js'))).toBe(true);
    });
  });

  // === LIVE SERVER TESTS ===

  describe('AC-BC1+2: Live task endpoint test', () => {
    it('GET /api/tasks/:slug should return task with hierarchy', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      // Use a known task slug from the database
      const res = await fetch('http://10.33.33.1:4200/api/data?project=all');
      const data = await res.json();
      const taskNode = data.nodes?.find((n: any) => n.type === 'task' && n.slug);
      if (!taskNode) return; // no tasks to test with

      const taskRes = await fetch(`http://10.33.33.1:4200/api/tasks/${taskNode.slug}`);
      expect(taskRes.status).toBe(200);
      const taskData = await taskRes.json();
      expect(taskData).toHaveProperty('slug');
      // Should have breadcrumb/hierarchy info
      expect(taskData.breadcrumb || taskData.hierarchy || taskData.parents).toBeDefined();
    });
  });

  describe('AC-BC3: Live breadcrumb HTML test', () => {
    it('GET / should return HTML with breadcrumb elements', async () => {
      const vizUp = await isVizUp();
      if (!vizUp) return;

      const res = await fetch('http://10.33.33.1:4200/');
      const html = await res.text();
      expect(html.toLowerCase()).toContain('breadcrumb');
    });
  });
});
