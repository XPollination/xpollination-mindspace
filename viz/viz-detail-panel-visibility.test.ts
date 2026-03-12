/**
 * TDD tests for viz-detail-panel-visibility
 *
 * Bug: showCapabilityDetail() and showTaskDetail() use classList.add('open')
 * but CSS only has .detail-panel.visible rule. Panel stays invisible.
 * Fix: Change to classList.add('visible') in both functions. v0.0.25.
 *
 * AC-VIS1: showCapabilityDetail uses classList.add('visible'), not 'open'
 * AC-VIS2: showTaskDetail uses classList.add('visible'), not 'open'
 * AC-VIS3: CSS rule .detail-panel.visible exists
 * AC-VIS4: No classList.add('open') in drill-down functions
 * AC-VIS5: Version v0.0.25 created
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIZ_DIR = path.join(__dirname, '.');
const ACTIVE_LINK = path.join(VIZ_DIR, 'active');

function getActiveFile(filename: string): string {
  return fs.readFileSync(path.join(ACTIVE_LINK, filename), 'utf-8');
}

describe('viz-detail-panel-visibility: CSS class mismatch fix', () => {

  describe('AC-VIS1: showCapabilityDetail uses visible class', () => {
    it('showCapabilityDetail should add visible class to detail panel', () => {
      const indexSrc = getActiveFile('index.html');
      const capDetailSection = indexSrc.slice(
        indexSrc.indexOf('showCapabilityDetail'),
        indexSrc.indexOf('showCapabilityDetail') + 1500
      );
      expect(capDetailSection).toContain("classList.add('visible')");
    });
  });

  describe('AC-VIS2: showTaskDetail uses visible class', () => {
    it('showTaskDetail should add visible class to detail panel', () => {
      const indexSrc = getActiveFile('index.html');
      const taskDetailSection = indexSrc.slice(
        indexSrc.indexOf('showTaskDetail'),
        indexSrc.indexOf('showTaskDetail') + 1500
      );
      expect(taskDetailSection).toContain("classList.add('visible')");
    });
  });

  describe('AC-VIS3: CSS rule exists for .detail-panel.visible', () => {
    it('CSS should have .detail-panel.visible display rule', () => {
      const indexSrc = getActiveFile('index.html');
      expect(indexSrc).toMatch(/\.detail-panel\.visible\s*\{[^}]*display\s*:\s*block/);
    });
  });

  describe('AC-VIS4: No classList.add open in drill-down functions', () => {
    it('should not use classList.add open anywhere for detail panel', () => {
      const indexSrc = getActiveFile('index.html');
      // After the fix, there should be no classList.add('open') for detail panel
      // in showCapabilityDetail or showTaskDetail
      const capSection = indexSrc.slice(
        indexSrc.indexOf('showCapabilityDetail'),
        indexSrc.indexOf('showCapabilityDetail') + 1500
      );
      const taskSection = indexSrc.slice(
        indexSrc.indexOf('showTaskDetail'),
        indexSrc.indexOf('showTaskDetail') + 1500
      );
      expect(capSection).not.toContain("classList.add('open')");
      expect(taskSection).not.toContain("classList.add('open')");
    });
  });

  describe('AC-VIS5: Version v0.0.25', () => {
    it('v0.0.25 directory should exist', () => {
      const v25 = path.join(VIZ_DIR, 'versions', 'v0.0.25');
      expect(fs.existsSync(v25)).toBe(true);
    });

    it('active symlink should point to v0.0.25', () => {
      const target = fs.readlinkSync(ACTIVE_LINK);
      expect(target).toContain('v0.0.25');
    });
  });
});
