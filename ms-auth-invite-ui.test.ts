/**
 * TDD tests for ms-auth-invite-ui v0.0.2
 *
 * Invite Landing Page + Registration UI — /invite/{code} flow
 *
 * AC-1: /invite/{code} redirects to /register?code={code}
 * AC-2: /invite/ is in PUBLIC_PATHS
 * AC-3: register.html pre-fills invite_code from URL ?code= parameter
 * AC-4: Form fields: invite_code, name, email, password
 * AC-5: Form submits to /api/auth/register
 * AC-6: Auto-login after registration via /api/auth/login
 * AC-7: Error display on failure
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Invite Route ───

describe('AC-1: /invite/{code} redirects to /register', () => {
  it('should have /invite/ route handler in viz/server.js', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/\/invite\//);
  });

  it('should redirect to /register with code parameter', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Should have redirect logic with register and code
    expect(content).toMatch(/\/register\?code=|register.*code/);
  });

  it('should use encodeURIComponent on the invite code', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toContain('encodeURIComponent');
  });
});

describe('AC-2: /invite/ in PUBLIC_PATHS', () => {
  it('should include /invite/ in public paths array', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // PUBLIC_PATHS array should contain /invite/
    expect(content).toMatch(/PUBLIC_PATHS/);
    // Find the PUBLIC_PATHS array content and check for /invite/
    const arrayMatch = content.match(/PUBLIC_PATHS\s*=\s*\[([\s\S]*?)\]/);
    expect(arrayMatch).toBeTruthy();
    expect(arrayMatch![1]).toContain('/invite/');
  });
});

// ─── Registration Page ───

describe('AC-3: register.html pre-fills invite_code from URL', () => {
  it('should read code from URL search params', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/URLSearchParams|searchParams|location\.search/);
    expect(content).toContain('code');
  });
});

describe('AC-4: Form has invite_code, name, email, password fields', () => {
  it('should have invite_code field', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toContain('invite_code');
  });

  it('should have name field', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/name\s*=\s*["']name["']|placeholder\s*=\s*["'][^"']*[Nn]ame/);
  });

  it('should have email field', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/type\s*=\s*["']email["']/);
  });

  it('should have password field', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/type\s*=\s*["']password["']/);
  });
});

describe('AC-5: Form submits to /api/auth/register', () => {
  it('should POST to /api/auth/register', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toContain('/api/auth/register');
  });
});

describe('AC-6: Auto-login after registration', () => {
  it('should call /api/auth/login after successful registration', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toContain('/api/auth/login');
  });

  it('should redirect to dashboard on success', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/location\s*[.=].*['"]\/['"]|window\.location.*['"]\//);
  });
});

describe('AC-7: Error display on failure', () => {
  it('should show error message on failed registration', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/error|Error|err/);
  });
});
