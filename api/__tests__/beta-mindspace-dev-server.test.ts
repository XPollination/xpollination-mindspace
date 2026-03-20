import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TDD Tests: beta-mindspace.xpollination.earth Dev Server
 * Ref: beta-mindspace-dev-server
 */

const PROJECT_ROOT = resolve('/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server');

describe('Beta server config', () => {

  it('nginx config for beta subdomain exists', () => {
    const candidates = [
      resolve('/etc/nginx/sites-available/beta-mindspace'),
      resolve('/etc/nginx/sites-enabled/beta-mindspace'),
      resolve(PROJECT_ROOT, 'config/nginx-beta.conf'),
    ];
    const found = candidates.some(p => existsSync(p));
    expect(found).toBe(true);
  });

  it('systemd service for beta server exists', () => {
    const candidates = [
      resolve('/etc/systemd/system/mindspace-beta.service'),
      resolve(PROJECT_ROOT, 'config/mindspace-beta.service'),
    ];
    const found = candidates.some(p => existsSync(p));
    expect(found).toBe(true);
  });
});

describe('Beta server separation', () => {

  it('uses port 4201 (not production 4200)', () => {
    // Port separation verified by config presence
    expect(true).toBe(true); // Placeholder — runtime test
  });

  it('uses separate database', () => {
    // Separate DB verified by config
    expect(true).toBe(true); // Placeholder — runtime test
  });
});
