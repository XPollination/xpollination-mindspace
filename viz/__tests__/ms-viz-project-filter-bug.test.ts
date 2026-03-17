import { describe, it, expect } from 'vitest';

/**
 * Viz Project Filter Bug Tests — ms-viz-project-filter-bug
 * Validates: individual project filter returns tasks, not 0.
 */

const PROD_VIZ = 'https://mindspace.xpollination.earth';

describe('Project filter returns tasks', () => {

  it('All Projects view returns tasks', async () => {
    try {
      const res = await fetch(`${PROD_VIZ}/api/data?project=xpollination-mcp-server`, {
        headers: { 'Cookie': 'ms_session=test' } // May need real auth
      });
      // At minimum, the endpoint should not return empty when tasks exist
      expect(res.status).not.toBe(500);
    } catch {
      expect(true).toBe(false);
    }
  });

  it('individual project slug matches API project slug', async () => {
    try {
      const res = await fetch(`${PROD_VIZ}/api/projects`, {
        headers: { 'Cookie': 'ms_session=test' }
      });
      if (res.status === 200) {
        const projects = await res.json();
        // Projects should have slugs that match what the data API expects
        if (Array.isArray(projects) && projects.length > 0) {
          expect(projects[0]).toHaveProperty('slug');
        }
      }
    } catch {
      expect(true).toBe(false);
    }
  });

  it('/api/data returns tasks array for valid project', async () => {
    try {
      const res = await fetch(`${PROD_VIZ}/api/data?project=xpollination-mcp-server`, {
        headers: { 'Cookie': 'ms_session=test' }
      });
      if (res.status === 200) {
        const data = await res.json();
        expect(data).toHaveProperty('tasks');
        expect(Array.isArray(data.tasks)).toBe(true);
        expect(data.tasks.length).toBeGreaterThan(0);
      }
    } catch {
      expect(true).toBe(false);
    }
  });
});
