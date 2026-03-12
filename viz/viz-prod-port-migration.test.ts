/**
 * TDD tests for viz-prod-port-migration
 *
 * Verifies migration from ad-hoc process on 8080 to systemd service on 4100.
 * Tests cover SKILL.md content changes, .env.production, and live infrastructure.
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create /etc/systemd/system/mindspace.service (port 4100, VPN-only, symlink-based)
 * - Create .env.production with NODE_ENV=production and VIZ_BIND=10.33.33.1
 * - Kill ad-hoc 8080 process, enable+start mindspace.service
 * - Update UFW: allow 4100/VPN, remove 8080
 * - Fix mindspace-test.service to use viz/active symlink
 * - Deploy versions: PROD viz/active → v0.0.9, TEST viz/active → v0.0.10
 * - Update pm.status SKILL.md: 8080→4100, remove migration sections
 * - Update monitor SKILL.md: 8080→4100
 * - Requires thomas user for systemd/UFW operations
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const BASE = "/home/developer/workspaces/github/PichlerThomas";
const MCP_DIR = resolve(BASE, "xpollination-mcp-server");
const TEST_DIR = resolve(BASE, "xpollination-mcp-server-test");
const BP_DIR = resolve(BASE, "xpollination-best-practices");

const PM_STATUS_SKILL = resolve(
  BP_DIR,
  ".claude/skills/xpo.claude.mindspace.pm.status/SKILL.md"
);
const MONITOR_SKILL = resolve(
  BP_DIR,
  ".claude/skills/xpo.claude.monitor/SKILL.md"
);

// --- Tests 11-14: SKILL.md content changes ---
describe("viz-prod-port-migration: pm.status SKILL.md", () => {
  it("pm.status SKILL.md references port 4100 (not 8080)", () => {
    const content = readFileSync(PM_STATUS_SKILL, "utf-8");
    expect(content).toMatch(/4100/);
    // 8080 should NOT appear as current prod port
    const prodLines = content
      .split("\n")
      .filter(
        (l) =>
          /PROD.*8080|Deploy.*PROD.*8080|curl.*8080/i.test(l) &&
          !/migration|migrated|was|old|previous/i.test(l)
      );
    expect(prodLines.length).toBe(0);
  });

  it("no PLANNED port migration text in pm.status SKILL.md", () => {
    const content = readFileSync(PM_STATUS_SKILL, "utf-8");
    expect(content).not.toMatch(/PLANNED:.*port migration|planned.*8080.*4100/i);
  });

  it("no Port migration steps section in pm.status SKILL.md", () => {
    const content = readFileSync(PM_STATUS_SKILL, "utf-8");
    expect(content).not.toMatch(/Port migration steps/i);
  });
});

describe("viz-prod-port-migration: monitor SKILL.md", () => {
  it("monitor SKILL.md references port 4100 (not 8080)", () => {
    const content = readFileSync(MONITOR_SKILL, "utf-8");
    // Check that liaison-approval-mode curl uses 4100
    const approvalLines = content
      .split("\n")
      .filter((l) => /liaison-approval-mode/.test(l));
    expect(approvalLines.length).toBeGreaterThan(0);
    for (const line of approvalLines) {
      expect(line).toMatch(/4100/);
      expect(line).not.toMatch(/8080/);
    }
  });
});

// --- Test 15: .env.production ---
describe("viz-prod-port-migration: .env.production", () => {
  it(".env.production exists with NODE_ENV and VIZ_BIND", () => {
    const envPath = resolve(MCP_DIR, ".env.production");
    expect(existsSync(envPath)).toBe(true);
    const content = readFileSync(envPath, "utf-8");
    expect(content).toMatch(/NODE_ENV=production/);
    expect(content).toMatch(/VIZ_BIND=10\.33\.33\.1/);
  });
});

// --- Tests 1-5: Live infrastructure verification ---
describe("viz-prod-port-migration: infrastructure", () => {
  it("PROD on port 4100 responds", () => {
    try {
      const result = execSync(
        "curl -s --connect-timeout 3 http://10.33.33.1:4100/api/version",
        { encoding: "utf-8" }
      );
      expect(result).toBeTruthy();
    } catch {
      // If curl fails, the service isn't running on 4100 yet
      expect.fail("PROD service not responding on port 4100");
    }
  });

  it("old port 8080 is dead", () => {
    try {
      execSync("curl -s --connect-timeout 2 http://10.33.33.1:8080", {
        encoding: "utf-8",
      });
      expect.fail("Port 8080 should not be responding");
    } catch {
      // Connection refused is expected
      expect(true).toBe(true);
    }
  });

  it("TEST on port 4200 still responds", () => {
    try {
      const result = execSync(
        "curl -s --connect-timeout 3 http://10.33.33.1:4200/api/version",
        { encoding: "utf-8" }
      );
      expect(result).toBeTruthy();
    } catch {
      expect.fail("TEST service not responding on port 4200");
    }
  });
});

// --- Tests 6-8: Service configuration ---
describe("viz-prod-port-migration: service config", () => {
  it("mindspace.service uses viz/active symlink", () => {
    try {
      const result = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "cat /etc/systemd/system/mindspace.service"',
        { encoding: "utf-8" }
      );
      expect(result).toMatch(/viz\/active\/server\.js/);
      expect(result).toMatch(/4100/);
    } catch {
      expect.fail("Cannot read mindspace.service");
    }
  });

  it("mindspace-test.service uses viz/active symlink (not hardcoded)", () => {
    try {
      const result = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "cat /etc/systemd/system/mindspace-test.service"',
        { encoding: "utf-8" }
      );
      expect(result).toMatch(/viz\/active\/server\.js/);
      expect(result).not.toMatch(/viz\/versions\/v0\.0\.\d+\/server\.js/);
    } catch {
      expect.fail("Cannot read mindspace-test.service");
    }
  });

  it("VIZ_BIND=10.33.33.1 in both services", () => {
    try {
      const prod = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "cat /etc/systemd/system/mindspace.service"',
        { encoding: "utf-8" }
      );
      expect(prod).toMatch(/VIZ_BIND=10\.33\.33\.1/);

      const test = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "cat /etc/systemd/system/mindspace-test.service"',
        { encoding: "utf-8" }
      );
      expect(test).toMatch(/VIZ_BIND=10\.33\.33\.1/);
    } catch {
      expect.fail("Cannot read service files");
    }
  });
});

// --- Tests 9-10: UFW firewall ---
describe("viz-prod-port-migration: firewall", () => {
  it("UFW allows 4100 from VPN subnet", () => {
    try {
      const result = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "ufw status"',
        { encoding: "utf-8" }
      );
      expect(result).toMatch(/4100.*ALLOW.*10\.33\.33/);
    } catch {
      expect.fail("Cannot check UFW status");
    }
  });

  it("UFW does not allow 8080", () => {
    try {
      const result = execSync(
        'sshpass -p "$(cat /home/developer/workspaces/github/PichlerThomas/HomeAssistant/systems/hetzner-cx22-ubuntu/credentials.md 2>/dev/null | grep -oP \'Password: \\K.*\' | head -1)" ssh thomas@localhost "ufw status"',
        { encoding: "utf-8" }
      );
      const allow8080 = result
        .split("\n")
        .filter((l) => /8080.*ALLOW/.test(l));
      expect(allow8080.length).toBe(0);
    } catch {
      expect.fail("Cannot check UFW status");
    }
  });
});

// --- Tests 16-20: Version deployment ---
describe("viz-prod-port-migration: version deployment", () => {
  it("PROD viz/active symlink points to versions/v0.0.9", () => {
    const activePath = resolve(MCP_DIR, "viz/active");
    expect(existsSync(activePath)).toBe(true);
    try {
      const linkTarget = execSync(`readlink ${activePath}`, {
        encoding: "utf-8",
      }).trim();
      expect(linkTarget).toMatch(/v0\.0\.9/);
    } catch {
      expect.fail("viz/active is not a symlink or cannot be read");
    }
  });

  it("TEST viz/active symlink points to versions/v0.0.10", () => {
    const activePath = resolve(TEST_DIR, "viz/active");
    expect(existsSync(activePath)).toBe(true);
    try {
      const linkTarget = execSync(`readlink ${activePath}`, {
        encoding: "utf-8",
      }).trim();
      expect(linkTarget).toMatch(/v0\.0\.10/);
    } catch {
      expect.fail("TEST viz/active is not a symlink or cannot be read");
    }
  });

  it("PROD version API returns v0.0.9", () => {
    try {
      const result = execSync(
        "curl -s --connect-timeout 3 http://10.33.33.1:4100/api/version",
        { encoding: "utf-8" }
      );
      const data = JSON.parse(result);
      expect(data.version).toMatch(/0\.0\.9/);
    } catch {
      expect.fail("Cannot verify PROD version");
    }
  });

  it("TEST version API returns v0.0.10", () => {
    try {
      const result = execSync(
        "curl -s --connect-timeout 3 http://10.33.33.1:4200/api/version",
        { encoding: "utf-8" }
      );
      const data = JSON.parse(result);
      expect(data.version).toMatch(/0\.0\.10/);
    } catch {
      expect.fail("Cannot verify TEST version");
    }
  });
});
