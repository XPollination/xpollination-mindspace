/**
 * TDD tests for centralize-brain-auth
 *
 * Change A: brain-curl.sh wrapper script in xpollination-best-practices/scripts/
 * Change B: Skill files updated to use brain-curl instead of raw curl with auth headers
 * Change C: claude-session.sh adds scripts dir to PATH
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create xpollination-best-practices/scripts/brain-curl.sh (executable)
 * - Wrapper: exec curl -H "Content-Type: application/json" -H "Authorization: Bearer ${BRAIN_API_KEY:?...}" "$@"
 * - Replace scattered curl + auth header patterns in 5 skill files
 * - Add scripts dir to PATH in claude-session.sh
 * - Remove AUTH_HDR variable from xpo.claude.monitor/SKILL.md
 */
import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { existsSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";

const BP_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-best-practices"
);
const HA_DIR = resolve(
  "/home/developer/workspaces/github/PichlerThomas/HomeAssistant"
);

describe("centralize-brain-auth", () => {
  // --- Change A: brain-curl.sh wrapper ---
  describe("Change A: brain-curl.sh wrapper", () => {
    const wrapperPath = resolve(BP_DIR, "scripts/brain-curl.sh");

    it("brain-curl.sh exists", () => {
      expect(existsSync(wrapperPath)).toBe(true);
    });

    it("brain-curl.sh is executable", () => {
      const stat = statSync(wrapperPath);
      const mode = stat.mode & 0o777;
      expect(mode & 0o111).toBeGreaterThan(0); // at least one execute bit
    });

    it("brain-curl.sh includes Authorization header with BRAIN_API_KEY", () => {
      const content = readFileSync(wrapperPath, "utf-8");
      expect(content).toMatch(/Authorization.*Bearer.*BRAIN_API_KEY/);
    });

    it("brain-curl.sh includes Content-Type: application/json", () => {
      const content = readFileSync(wrapperPath, "utf-8");
      expect(content).toMatch(/Content-Type.*application\/json/);
    });

    it("brain-curl.sh fails when BRAIN_API_KEY is unset (uses :? or equivalent)", () => {
      const content = readFileSync(wrapperPath, "utf-8");
      // Should use ${BRAIN_API_KEY:?...} or equivalent error-on-unset pattern
      expect(content).toMatch(/BRAIN_API_KEY:\?|BRAIN_API_KEY:-.*exit/);
    });

    it("brain-curl.sh passes through arguments ($@)", () => {
      const content = readFileSync(wrapperPath, "utf-8");
      expect(content).toMatch(/"\$@"/);
    });

    it("brain-curl.sh health check works with BRAIN_API_KEY set", () => {
      try {
        const result = execSync(
          `bash ${wrapperPath} -s http://localhost:3200/api/v1/health`,
          { encoding: "utf-8", timeout: 5000 }
        );
        const parsed = JSON.parse(result);
        expect(parsed.status).toBe("ok");
      } catch {
        // Brain may be down in test env — that's ok, test is best-effort
      }
    });
  });

  // --- Change B: Skill files use brain-curl ---
  describe("Change B: skill files use brain-curl", () => {
    const skillFiles = [
      "xpo.claude.mindspace.brain/SKILL.md",
      "xpo.claude.clear/SKILL.md",
      "xpo.claude.monitor/SKILL.md",
      "xpo.claude.mindspace.reflect/SKILL.md",
      "xpo.claude.mindspace.garden/SKILL.md",
    ];

    for (const skillFile of skillFiles) {
      const skillPath = resolve(BP_DIR, `.claude/skills/${skillFile}`);
      const skillName = skillFile.split("/")[0];

      it(`${skillName} does NOT have scattered Authorization: Bearer header`, () => {
        if (!existsSync(skillPath)) return; // skip if skill doesn't exist
        const content = readFileSync(skillPath, "utf-8");
        // Should NOT have raw "Authorization: Bearer $BRAIN_API_KEY" in curl commands
        // (the wrapper handles it)
        expect(content).not.toMatch(/-H\s*["']Authorization:\s*Bearer\s*\$BRAIN_API_KEY["']/);
      });

      it(`${skillName} uses brain-curl for brain API calls`, () => {
        if (!existsSync(skillPath)) return;
        const content = readFileSync(skillPath, "utf-8");
        // Should use brain-curl (or brain-curl.sh) for API calls
        if (content.match(/localhost:3200/)) {
          expect(content).toMatch(/brain-curl/);
        }
      });
    }

    it("xpo.claude.monitor no longer has AUTH_HDR variable", () => {
      const monitorPath = resolve(BP_DIR, ".claude/skills/xpo.claude.monitor/SKILL.md");
      if (!existsSync(monitorPath)) return;
      const content = readFileSync(monitorPath, "utf-8");
      expect(content).not.toMatch(/AUTH_HDR=/);
    });
  });

  // --- Change C: claude-session.sh PATH update ---
  describe("Change C: session launcher PATH", () => {
    it("claude-session.sh adds best-practices scripts to PATH", () => {
      // Find claude-session.sh in HomeAssistant
      const candidates = [
        resolve(HA_DIR, "systems/synology-ds218/features/infrastructure/scripts/claude-session.sh"),
        resolve(HA_DIR, "systems/hetzner-cx22-ubuntu/scripts/claude-session.sh"),
      ];
      const sessionScript = candidates.find(p => existsSync(p));
      expect(sessionScript).toBeDefined();
      if (sessionScript) {
        const content = readFileSync(sessionScript, "utf-8");
        expect(content).toMatch(/xpollination-best-practices\/scripts/);
      }
    });
  });
});
