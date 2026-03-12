/**
 * TDD tests for mindspace-docker-installer
 *
 * Docker containerization + self-documenting installer for Mindspace.
 * Single container: API (3100) + viz (4200) + SQLite via Docker volume.
 * Multi-stage Dockerfile, self-documenting startup.sh, dev mode compose override.
 *
 * Acceptance Criteria:
 * AC-DOCK1: Dockerfile exists with multi-stage build (builder + runtime)
 * AC-DOCK2: node:22-slim base image (multi-arch: amd64 + arm64)
 * AC-DOCK3: Builder stage installs python3, make, g++ for better-sqlite3
 * AC-DOCK4: Runtime stage is slim (no build tools)
 * AC-COMP1: docker-compose.yml exists with mindspace service
 * AC-COMP2: Ports 3100 and 4200 exposed
 * AC-COMP3: Named volume for SQLite data persistence
 * AC-COMP4: docker-compose.dev.yml exists for dev mode
 * AC-START1: scripts/startup.sh exists and is self-documenting
 * AC-START2: startup.sh runs migrations
 * AC-START3: startup.sh runs seed
 * AC-START4: startup.sh starts API and viz
 * AC-START5: startup.sh produces human-readable narration (not silent)
 * AC-IGN1: .dockerignore excludes node_modules, .git, data/, *.db
 * AC-PKG1: package.json start script wraps docker compose
 * AC-PKG2: package.json has start:native for non-Docker environments
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

describe('mindspace-docker-installer: Docker + self-documenting installer', () => {

  // === AC-DOCK1-4: Dockerfile ===

  describe('AC-DOCK1: Dockerfile exists with multi-stage build', () => {
    it('Dockerfile should exist in project root', () => {
      expect(fileExists(path.join(PROJECT_ROOT, 'Dockerfile'))).toBe(true);
    });

    it('Dockerfile should have builder stage', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/AS\s+builder/i);
    });

    it('Dockerfile should have runtime stage', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/AS\s+runtime/i);
    });
  });

  describe('AC-DOCK2: node:22-slim base image', () => {
    it('should use node:22-slim (or node:22.*slim) as base', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/FROM\s+node:22.*slim/i);
    });
  });

  describe('AC-DOCK3: Builder installs native build tools', () => {
    it('builder stage should install python3, make, g++', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/python3/);
      expect(df).toMatch(/make/);
      expect(df).toMatch(/g\+\+/);
    });

    it('should run npm ci or npm install in builder', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/npm\s+(ci|install)/);
    });
  });

  describe('AC-DOCK4: Runtime stage is slim', () => {
    it('runtime should COPY from builder (not install build tools)', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      expect(df).toMatch(/COPY\s+--from=builder/);
    });

    it('runtime should NOT have apt-get install for build tools', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      // Split by stages — only check runtime stage
      const runtimeIdx = df.search(/AS\s+runtime/i);
      if (runtimeIdx === -1) return;
      const runtimeSection = df.slice(runtimeIdx);
      // Runtime should NOT install python3/make/g++
      expect(runtimeSection).not.toMatch(/apt-get\s+install.*python3/);
      expect(runtimeSection).not.toMatch(/apt-get\s+install.*g\+\+/);
    });
  });

  describe('AC-DOCK: Dockerfile is self-documenting', () => {
    it('Dockerfile should contain explanatory comments', () => {
      const df = readFile(path.join(PROJECT_ROOT, 'Dockerfile'));
      // Should have meaningful comments (not just FROM/COPY)
      const comments = df.split('\n').filter(l => l.trim().startsWith('#'));
      expect(comments.length).toBeGreaterThan(5);
    });
  });

  // === AC-COMP1-4: Docker Compose ===

  describe('AC-COMP1: docker-compose.yml exists', () => {
    it('docker-compose.yml should exist', () => {
      expect(fileExists(path.join(PROJECT_ROOT, 'docker-compose.yml'))).toBe(true);
    });

    it('should define mindspace service', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.yml'));
      expect(dc).toMatch(/mindspace/);
      expect(dc).toMatch(/services:/);
    });
  });

  describe('AC-COMP2: Ports 3100 and 4200 exposed', () => {
    it('compose should expose port 3100 (API)', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.yml'));
      expect(dc).toMatch(/3100/);
    });

    it('compose should expose port 4200 (viz)', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.yml'));
      expect(dc).toMatch(/4200/);
    });
  });

  describe('AC-COMP3: Named volume for data persistence', () => {
    it('compose should define a named volume', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.yml'));
      expect(dc).toMatch(/volumes:/);
      // Should have a named volume (not just bind mount)
      expect(dc).toMatch(/mindspace-data|data:/);
    });

    it('volume should mount to /app/data', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.yml'));
      expect(dc).toMatch(/\/app\/data/);
    });
  });

  describe('AC-COMP4: Dev mode compose override', () => {
    it('docker-compose.dev.yml should exist', () => {
      expect(fileExists(path.join(PROJECT_ROOT, 'docker-compose.dev.yml'))).toBe(true);
    });

    it('dev compose should mount source directories', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.dev.yml'));
      // Should mount at least api/ or viz/ source for hot-reload
      const mountsSrc = /\.\/api:|\.\/viz:|\.\/src:/m.test(dc);
      expect(mountsSrc).toBe(true);
    });

    it('dev compose should set NODE_ENV=development', () => {
      const dc = readFile(path.join(PROJECT_ROOT, 'docker-compose.dev.yml'));
      expect(dc).toMatch(/development/);
    });
  });

  // === AC-START1-5: Startup script ===

  describe('AC-START1: startup.sh exists', () => {
    it('scripts/startup.sh should exist', () => {
      expect(fileExists(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'))).toBe(true);
    });

    it('startup.sh should be executable (has shebang)', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      expect(sh).toMatch(/^#!.*(?:bash|sh)/);
    });
  });

  describe('AC-START2: startup.sh runs migrations', () => {
    it('should run database migrations', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      expect(sh).toMatch(/migrat/i);
    });
  });

  describe('AC-START3: startup.sh runs seed', () => {
    it('should run seed scripts', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      expect(sh).toMatch(/seed/i);
    });
  });

  describe('AC-START4: startup.sh starts API and viz', () => {
    it('should start API server', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      expect(sh).toMatch(/api|3100|server/i);
    });

    it('should start viz server', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      expect(sh).toMatch(/viz|4200/i);
    });
  });

  describe('AC-START5: startup.sh is self-documenting (narration)', () => {
    it('should contain step narration (Step 1, Step 2, etc. or equivalent)', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      const hasNarration =
        /Step\s+\d|▸|════|MINDSPACE|STARTUP/i.test(sh);
      expect(hasNarration).toBe(true);
    });

    it('should explain what Mindspace is in startup output', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      const explainsSystem =
        /Mission.*Capabilit|hierarchy|project.*management/i.test(sh);
      expect(explainsSystem).toBe(true);
    });

    it('should narrate migration and seed steps', () => {
      const sh = readFile(path.join(PROJECT_ROOT, 'scripts', 'startup.sh'));
      // Should echo/printf messages about what is happening
      const hasEchoNarration =
        /echo.*migrat|echo.*seed|printf.*migrat|printf.*seed/i.test(sh);
      expect(hasEchoNarration).toBe(true);
    });
  });

  // === AC-IGN1: .dockerignore ===

  describe('AC-IGN1: .dockerignore excludes unnecessary files', () => {
    it('.dockerignore should exist', () => {
      expect(fileExists(path.join(PROJECT_ROOT, '.dockerignore'))).toBe(true);
    });

    it('should exclude node_modules', () => {
      const di = readFile(path.join(PROJECT_ROOT, '.dockerignore'));
      expect(di).toMatch(/node_modules/);
    });

    it('should exclude .git', () => {
      const di = readFile(path.join(PROJECT_ROOT, '.dockerignore'));
      expect(di).toMatch(/\.git/);
    });

    it('should exclude data/ or *.db', () => {
      const di = readFile(path.join(PROJECT_ROOT, '.dockerignore'));
      const excludesData = /data\/|\*\.db/.test(di);
      expect(excludesData).toBe(true);
    });
  });

  // === AC-PKG1-2: package.json scripts ===

  describe('AC-PKG1: npm start wraps docker compose', () => {
    it('start script should reference docker compose', () => {
      const pkg = JSON.parse(readFile(path.join(PROJECT_ROOT, 'package.json')));
      expect(pkg.scripts.start).toMatch(/docker\s+compose/);
    });
  });

  describe('AC-PKG2: start:native for non-Docker environments', () => {
    it('should have start:native script', () => {
      const pkg = JSON.parse(readFile(path.join(PROJECT_ROOT, 'package.json')));
      expect(pkg.scripts['start:native']).toBeDefined();
    });
  });
});
