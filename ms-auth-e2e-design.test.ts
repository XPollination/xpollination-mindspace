/**
 * TDD tests for ms-auth-e2e-design (v0.0.1)
 *
 * End-to-End Auth Architecture — Viz login gate, JWT sessions, invite-only registration.
 *
 * D1: Viz Auth Gate
 * AC-D1-1: viz/server.js checks ms_session cookie on requests
 * AC-D1-2: Unauthenticated requests redirect to /login
 * AC-D1-3: PUBLIC_PATHS bypass auth (login, assets, health, api/auth)
 *
 * D2: JWT as httpOnly Cookie
 * AC-D2-1: Cookie set with HttpOnly flag
 * AC-D2-2: Cookie set with SameSite=Strict
 * AC-D2-3: Cookie named ms_session
 *
 * D3: Viz Auth Middleware
 * AC-D3-1: Extracts cookie from request headers
 * AC-D3-2: Verifies JWT with JWT_SECRET
 * AC-D3-3: Returns 401 for API requests without valid auth
 *
 * D4: Invite-Only Registration
 * AC-D4-1: invites table migration exists (008-invites.sql)
 * AC-D4-2: invites table has required columns (id, code, created_by, used_by, expires_at)
 * AC-D4-3: Register endpoint requires invite_code
 *
 * D5: Invite Quota
 * AC-D5-1: users table has invite_quota column
 * AC-D5-2: Invite creation checks quota
 *
 * D6: Logout
 * AC-D6-1: Logout endpoint clears ms_session cookie
 * AC-D6-2: Cookie cleared with Max-Age=0
 *
 * D7: Viz Proxies Auth to API
 * AC-D7-1: viz/server.js proxies POST /api/auth/login to API server
 * AC-D7-2: viz/server.js proxies POST /api/auth/register to API server
 * AC-D7-3: Proxy sets Set-Cookie on successful login response
 *
 * D8: API Route Protection
 * AC-D8-1: keysRouter uses requireApiKeyOrJwt
 * AC-D8-2: projectsRouter uses requireApiKeyOrJwt
 * AC-D8-3: agentsRouter uses requireApiKeyOrJwt
 *
 * D9: Shared JWT_SECRET
 * AC-D9-1: viz/server.js reads JWT_SECRET from environment
 * AC-D9-2: api/routes/auth.ts reads JWT_SECRET from environment
 *
 * D10: Login Page
 * AC-D10-1: viz/active/login.html exists
 * AC-D10-2: Login page has email and password inputs
 * AC-D10-3: Login page posts to /api/auth/login
 *
 * D11: Registration Page
 * AC-D11-1: viz/active/register.html exists
 * AC-D11-2: Registration page has invite_code field
 * AC-D11-3: Registration page has email, name, password fields
 *
 * D12: Admin Bootstrap
 * AC-D12-1: api/scripts/create-admin.js exists
 * AC-D12-2: Script sets is_system_admin = 1
 * AC-D12-3: Script bypasses invite requirement
 *
 * D13: CORS Lockdown
 * AC-D13-1: viz/server.js does NOT use Access-Control-Allow-Origin: *
 * AC-D13-2: CORS uses configurable allowed origins
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(__dirname, '.');

function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── D1: Viz Auth Gate ───

describe('AC-D1-1: viz/server.js checks ms_session cookie', () => {
  it('should parse cookies and look for ms_session', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toContain('ms_session');
  });

  it('should have cookie parsing logic', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Must parse cookies from request headers
    expect(content).toMatch(/cookie|Cookie/);
    expect(content).toMatch(/parse|split|=>/);
  });
});

describe('AC-D1-2: Unauthenticated requests redirect to /login', () => {
  it('should redirect to /login when no valid session', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toContain('/login');
    // Should have redirect logic (302 or Location header)
    expect(content).toMatch(/302|redirect|Location.*\/login/);
  });
});

describe('AC-D1-3: PUBLIC_PATHS bypass auth', () => {
  it('should define public paths that skip auth', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Must have a list of paths that don't require auth
    expect(content).toMatch(/PUBLIC_PATHS|public.*path|PUBLIC_ROUTES|AUTH_EXEMPT/i);
  });

  it('should exempt /login from auth', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Login page must be accessible without auth
    const lines = content.split('\n').filter(l =>
      (l.includes('/login') || l.includes('login')) &&
      (l.includes('public') || l.includes('PUBLIC') || l.includes('exempt') || l.includes('skip') || l.includes('bypass'))
    );
    // At least reference login in public/exempt context, or in a path array
    expect(content).toMatch(/['"`]\/login['"`]/);
  });

  it('should exempt /health from auth', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/['"`]\/health['"`]|health.*public|health.*exempt/i);
  });
});

// ─── D2: JWT as httpOnly Cookie ───

describe('AC-D2-1: Cookie set with HttpOnly flag', () => {
  it('should set HttpOnly on ms_session cookie', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/HttpOnly/i);
  });
});

describe('AC-D2-2: Cookie set with SameSite=Strict', () => {
  it('should set SameSite=Strict on ms_session cookie', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/SameSite\s*=\s*Strict/i);
  });
});

describe('AC-D2-3: Cookie named ms_session', () => {
  it('should use ms_session as cookie name', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/ms_session\s*=/);
  });
});

// ─── D3: Viz Auth Middleware ───

describe('AC-D3-1: Extracts cookie from request headers', () => {
  it('should access request cookie header', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/req\.headers\.cookie|headers\[['"]cookie['"]\]/);
  });
});

describe('AC-D3-2: Verifies JWT with JWT_SECRET', () => {
  it('should import or use jsonwebtoken for verification', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/jwt\.verify|jsonwebtoken|jwt/i);
  });

  it('should reference JWT_SECRET', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toContain('JWT_SECRET');
  });
});

describe('AC-D3-3: Returns 401 for API requests without valid auth', () => {
  it('should return 401 for unauthenticated API requests', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/401/);
  });
});

// ─── D4: Invite-Only Registration ───

describe('AC-D4-1: Invites migration exists', () => {
  it('should have an invites migration file', () => {
    // Look for any migration with "invites" in the name
    const migrationsDir = path.join(PROJECT_ROOT, 'api/db/migrations');
    const files = fs.readdirSync(migrationsDir);
    const inviteMigration = files.find(f => f.includes('invite'));
    expect(inviteMigration).toBeDefined();
  });
});

describe('AC-D4-2: Invites table has required columns', () => {
  it('should define invites table with id, code, created_by, used_by, expires_at', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'api/db/migrations');
    const files = fs.readdirSync(migrationsDir);
    const inviteMigration = files.find(f => f.includes('invite'));
    expect(inviteMigration).toBeDefined();
    const content = readFile(path.join(migrationsDir, inviteMigration!));
    expect(content).toMatch(/CREATE TABLE.*invites/is);
    expect(content).toContain('id TEXT PRIMARY KEY');
    expect(content).toMatch(/code TEXT.*UNIQUE|code TEXT.*NOT NULL/);
    expect(content).toContain('created_by');
    expect(content).toContain('used_by');
    expect(content).toContain('expires_at');
  });
});

describe('AC-D4-3: Register endpoint requires invite_code', () => {
  it('should check for invite_code in register handler', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/routes/auth.ts'));
    expect(content).toContain('invite_code');
  });

  it('should reject registration without valid invite', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/routes/auth.ts'));
    // Should have validation that rejects missing/invalid invite
    const lines = content.split('\n').filter(l =>
      l.includes('invite') && (l.includes('400') || l.includes('error') || l.includes('invalid') || l.includes('required'))
    );
    expect(lines.length).toBeGreaterThan(0);
  });
});

// ─── D5: Invite Quota ───

describe('AC-D5-1: Users table has invite_quota column', () => {
  it('should add invite_quota to users via migration', () => {
    const migrationsDir = path.join(PROJECT_ROOT, 'api/db/migrations');
    const files = fs.readdirSync(migrationsDir);
    const inviteMigration = files.find(f => f.includes('invite'));
    expect(inviteMigration).toBeDefined();
    const content = readFile(path.join(migrationsDir, inviteMigration!));
    expect(content).toContain('invite_quota');
  });
});

describe('AC-D5-2: Invite creation checks quota', () => {
  it('should have invite routes or logic that checks quota', () => {
    // Check invites route file or auth routes
    const invitesRoute = path.join(PROJECT_ROOT, 'api/routes/invites.ts');
    if (fileExists(invitesRoute)) {
      const content = readFile(invitesRoute);
      expect(content).toMatch(/quota|count|limit/i);
    } else {
      // May be in auth.ts as inline logic
      const content = readFile(path.join(PROJECT_ROOT, 'api/routes/auth.ts'));
      expect(content).toMatch(/quota|invite.*count|invite.*limit/i);
    }
  });
});

// ─── D6: Logout ───

describe('AC-D6-1: Logout endpoint clears ms_session cookie', () => {
  it('should handle logout request', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/logout/i);
  });

  it('should clear ms_session on logout', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Must have cookie clearing for ms_session
    const lines = content.split('\n').filter(l =>
      l.includes('ms_session') && (l.includes('Max-Age=0') || l.includes('max-age=0') || l.includes('=""') || l.includes("=''") || l.includes('expires'))
    );
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('AC-D6-2: Cookie cleared with Max-Age=0', () => {
  it('should set Max-Age=0 when clearing cookie', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/Max-Age\s*=\s*0/i);
  });
});

// ─── D7: Viz Proxies Auth to API ───

describe('AC-D7-1: viz/server.js proxies login to API', () => {
  it('should proxy /api/auth/login to API server', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Must have proxy logic for login
    expect(content).toMatch(/\/api\/auth\/login/);
    // Should reference API server port or URL
    expect(content).toMatch(/3100|API_PORT|localhost/);
  });
});

describe('AC-D7-2: viz/server.js proxies register to API', () => {
  it('should proxy /api/auth/register to API server', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/\/api\/auth\/register/);
  });
});

describe('AC-D7-3: Proxy sets Set-Cookie on successful login', () => {
  it('should set Set-Cookie header after successful proxy response', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/Set-Cookie|setCookie|setHeader.*cookie/i);
  });
});

// ─── D8: API Route Protection ───

describe('AC-D8-1: keysRouter uses auth middleware', () => {
  it('should apply requireApiKeyOrJwt to /api/keys', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/server.ts'));
    // Check that keysRouter has auth middleware
    const keysLine = content.split('\n').find(l => l.includes('keysRouter') && l.includes('use'));
    expect(keysLine).toBeDefined();
    expect(content).toMatch(/keys.*requireApiKeyOrJwt|requireApiKeyOrJwt.*keys/);
  });
});

describe('AC-D8-2: projectsRouter uses auth middleware', () => {
  it('should apply requireApiKeyOrJwt to /api/projects', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/server.ts'));
    expect(content).toMatch(/projects.*requireApiKeyOrJwt|requireApiKeyOrJwt.*projects/);
  });
});

describe('AC-D8-3: agentsRouter uses auth middleware', () => {
  it('should apply requireApiKeyOrJwt to /api/agents', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/server.ts'));
    expect(content).toMatch(/agents.*requireApiKeyOrJwt|requireApiKeyOrJwt.*agents/);
  });
});

// ─── D9: Shared JWT_SECRET ───

describe('AC-D9-1: viz/server.js reads JWT_SECRET', () => {
  it('should read JWT_SECRET from environment', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/process\.env\.JWT_SECRET|JWT_SECRET/);
  });
});

describe('AC-D9-2: API auth reads JWT_SECRET', () => {
  it('should read JWT_SECRET from environment', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'api/routes/auth.ts'));
    expect(content).toContain('process.env.JWT_SECRET');
  });
});

// ─── D10: Login Page ───

describe('AC-D10-1: login.html exists', () => {
  it('viz/active/login.html should exist', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'viz/active/login.html'))).toBe(true);
  });
});

describe('AC-D10-2: Login page has email and password inputs', () => {
  it('should have email input', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/login.html'));
    expect(content).toMatch(/type\s*=\s*["']email["']/);
  });

  it('should have password input', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/login.html'));
    expect(content).toMatch(/type\s*=\s*["']password["']/);
  });
});

describe('AC-D10-3: Login page posts to /api/auth/login', () => {
  it('should submit to /api/auth/login', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/login.html'));
    expect(content).toContain('/api/auth/login');
  });
});

// ─── D11: Registration Page ───

describe('AC-D11-1: register.html exists', () => {
  it('viz/active/register.html should exist', () => {
    expect(fileExists(path.join(PROJECT_ROOT, 'viz/active/register.html'))).toBe(true);
  });
});

describe('AC-D11-2: Registration page has invite_code field', () => {
  it('should include invite_code in the form', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toContain('invite_code');
  });
});

describe('AC-D11-3: Registration page has email, name, password fields', () => {
  it('should have email input', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/type\s*=\s*["']email["']/);
  });

  it('should have name input', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/name\s*=\s*["']name["']|placeholder\s*=\s*["'][^"']*[Nn]ame/);
  });

  it('should have password input', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toMatch(/type\s*=\s*["']password["']/);
  });

  it('should post to /api/auth/register', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/active/register.html'));
    expect(content).toContain('/api/auth/register');
  });
});

// ─── D12: Admin Bootstrap ───

describe('AC-D12-1: create-admin script exists', () => {
  it('api/scripts/create-admin.js should exist', () => {
    // Allow .js or .ts
    const jsExists = fileExists(path.join(PROJECT_ROOT, 'api/scripts/create-admin.js'));
    const tsExists = fileExists(path.join(PROJECT_ROOT, 'api/scripts/create-admin.ts'));
    expect(jsExists || tsExists).toBe(true);
  });
});

describe('AC-D12-2: Script sets is_system_admin', () => {
  it('should set is_system_admin = 1 for the created user', () => {
    const jsPath = path.join(PROJECT_ROOT, 'api/scripts/create-admin.js');
    const tsPath = path.join(PROJECT_ROOT, 'api/scripts/create-admin.ts');
    const content = fileExists(jsPath) ? readFile(jsPath) : readFile(tsPath);
    expect(content).toContain('is_system_admin');
  });
});

describe('AC-D12-3: Script bypasses invite requirement', () => {
  it('should create user without requiring invite code', () => {
    const jsPath = path.join(PROJECT_ROOT, 'api/scripts/create-admin.js');
    const tsPath = path.join(PROJECT_ROOT, 'api/scripts/create-admin.ts');
    const content = fileExists(jsPath) ? readFile(jsPath) : readFile(tsPath);
    // Should directly insert into users table without invite validation
    expect(content).toMatch(/INSERT.*users|users.*INSERT/i);
    // Should NOT require invite_code
    const hasInviteCheck = content.split('\n').filter(l =>
      l.includes('invite_code') && !l.trim().startsWith('//')
    );
    expect(hasInviteCheck.length).toBe(0);
  });
});

// ─── D13: CORS Lockdown ───

describe('AC-D13-1: viz/server.js does NOT use wildcard CORS', () => {
  it('should not have Access-Control-Allow-Origin: * in active code', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    // Find non-comment lines with wildcard CORS
    const wildcardCorsLines = content.split('\n').filter(l => {
      const trimmed = l.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return false;
      return l.includes("'*'") && l.toLowerCase().includes('access-control-allow-origin');
    });
    expect(wildcardCorsLines).toEqual([]);
  });
});

describe('AC-D13-2: CORS uses configurable allowed origins', () => {
  it('should have configurable CORS origins', () => {
    const content = readFile(path.join(PROJECT_ROOT, 'viz/server.js'));
    expect(content).toMatch(/ALLOWED_ORIGINS|CORS_ORIGINS|allowedOrigins|corsOrigins/);
  });
});
