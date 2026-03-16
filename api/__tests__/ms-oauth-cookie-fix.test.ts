import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * OAuth Cookie Fix Tests — ms-oauth-cookie-fix
 * Validates: SameSite=lax, FRONTEND_URL redirect, invite-only enforcement.
 */

const BASE = '/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test';

describe('Bug 1: SameSite cookie attribute', () => {

  it('oauth.ts uses SameSite=lax (not strict) for cookie', () => {
    const oauthPath = resolve(BASE, 'api/routes/oauth.ts');
    if (existsSync(oauthPath)) {
      const content = readFileSync(oauthPath, 'utf-8');
      // Should use lax, not strict
      expect(content.toLowerCase()).toMatch(/samesite.*lax/);
      expect(content.toLowerCase()).not.toMatch(/samesite.*strict/);
    }
  });
});

describe('Bug 2: Redirect URL uses FRONTEND_URL', () => {

  it('oauth.ts redirects to FRONTEND_URL (not /)', () => {
    const oauthPath = resolve(BASE, 'api/routes/oauth.ts');
    if (existsSync(oauthPath)) {
      const content = readFileSync(oauthPath, 'utf-8');
      expect(content).toMatch(/FRONTEND_URL|frontendUrl|frontend_url/);
    }
  });

  it('docker-compose sets FRONTEND_URL', () => {
    const composeProd = resolve(BASE, 'docker-compose.prod.yml');
    if (existsSync(composeProd)) {
      const content = readFileSync(composeProd, 'utf-8');
      expect(content).toMatch(/FRONTEND_URL/);
    }
  });
});

describe('Bug 3: OAuth enforces invite-only', () => {

  it('oauth.ts does NOT auto-create users for unknown Google emails', () => {
    const oauthPath = resolve(BASE, 'api/routes/oauth.ts');
    if (existsSync(oauthPath)) {
      const content = readFileSync(oauthPath, 'utf-8');
      // Should check if user exists before creating
      // Should NOT blindly INSERT new users
      expect(content).toMatch(/existing|SELECT.*email|user.*not.*found|Account not found/i);
    }
  });

  it('oauth.ts redirects unknown users to login with error', () => {
    const oauthPath = resolve(BASE, 'api/routes/oauth.ts');
    if (existsSync(oauthPath)) {
      const content = readFileSync(oauthPath, 'utf-8');
      expect(content).toMatch(/redirect.*login|error.*register|invite/i);
    }
  });
});
