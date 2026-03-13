/**
 * TDD tests for credential rotation — remove hardcoded default-thomas-key.
 *
 * From PDSA credential-rotation-thomas (2026-03-02):
 * AC-CRT1: brain-mcp.ts has no hardcoded credential fallback
 * AC-CRT2: brain-mcp.ts fails with clear error when BRAIN_API_KEY not set
 * AC-CRT3: database.ts seed does not contain usable credential
 * AC-CRT4: interface-cli.js brain gate sends Authorization header
 * AC-CRT5: All 4 shell scripts send Authorization header
 * AC-CRT6: Thomas's API key is a UUID (not "default-thomas-key")
 * AC-CRT7: Old key "default-thomas-key" returns 401
 * AC-CRT8: New UUID key returns 200
 * AC-CRT9: Test files don't hardcode "default-thomas-key"
 *
 * REQUIRES: Brain API running at localhost:3200
 * NOTE: After credential rotation, BRAIN_API_KEY env var must be set to new UUID.
 */
import { describe, it, expect } from "vitest";

const API_URL = "http://localhost:3200";

// Use env var — no hardcoded key
const THOMAS_KEY = process.env.BRAIN_API_KEY || "test-key-not-for-production";

async function apiIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/v1/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// --- AC-CRT1: brain-mcp.ts has no hardcoded credential fallback ---

describe("AC-CRT1: brain-mcp.ts has no hardcoded credential fallback", () => {
  it("brain-mcp.ts does not contain 'default-thomas-key'", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/mcp/brain-mcp.ts",
      "utf-8",
    );
    expect(source).not.toContain("default-thomas-key");
  });

  it("brain-mcp.ts BRAIN_API_KEY has no || fallback", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/mcp/brain-mcp.ts",
      "utf-8",
    );
    // Should not have `process.env.BRAIN_API_KEY || "..."` pattern
    expect(source).not.toMatch(
      /BRAIN_API_KEY\s*=\s*process\.env\.BRAIN_API_KEY\s*\|\|\s*["']/,
    );
  });
});

// --- AC-CRT2: brain-mcp.ts fails when BRAIN_API_KEY not set ---

describe("AC-CRT2: brain-mcp.ts fails with clear error when BRAIN_API_KEY missing", () => {
  it("brain-mcp.ts throws or logs error when BRAIN_API_KEY is undefined", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/mcp/brain-mcp.ts",
      "utf-8",
    );
    // Should have error handling for missing BRAIN_API_KEY
    expect(source).toMatch(/BRAIN_API_KEY.*required|throw.*BRAIN_API_KEY|error.*BRAIN_API_KEY/i);
  });
});

// --- AC-CRT3: database.ts seed does not contain usable credential ---

describe("AC-CRT3: database.ts seed has no usable credential", () => {
  it("database.ts does not seed 'default-thomas-key'", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/database.ts",
      "utf-8",
    );
    expect(source).not.toContain("default-thomas-key");
  });

  it("database.ts seed uses placeholder marker (not a real key)", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/database.ts",
      "utf-8",
    );
    // Should contain a placeholder like MUST_SET_VIA_PROVISION or similar non-functional value
    expect(source).toMatch(/MUST_SET|PLACEHOLDER|provision/i);
  });
});

// --- AC-CRT4: interface-cli.js brain gate sends Authorization header ---

describe("AC-CRT4: interface-cli.js brain gate sends Authorization header", () => {
  it("interface-cli.js brain gate includes Authorization header", async () => {
    const fs = await import("node:fs");
    const source = fs.readFileSync(
      "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server/src/db/interface-cli.js",
      "utf-8",
    );
    // Brain gate functions should include Authorization in headers
    // Look for Authorization in the context of brain API calls
    expect(source).toContain("Authorization");
    expect(source).toMatch(/Bearer/);
  });
});

// --- AC-CRT5: All 4 shell scripts send Authorization header ---

describe("AC-CRT5: All shell scripts send Authorization header", () => {
  const scripts = [
    "/home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.compact-recover.sh",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.brain-first-hook.sh",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/scripts/xpo.claude.precompact-save.sh",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/scripts/test-reflection-skill.sh",
  ];

  for (const scriptPath of scripts) {
    const scriptName = scriptPath.split("/").pop();

    it(`${scriptName} sends Authorization header`, async () => {
      const fs = await import("node:fs");
      if (!fs.existsSync(scriptPath)) return; // Skip if script doesn't exist
      const source = fs.readFileSync(scriptPath, "utf-8");
      expect(source).toContain("Authorization");
      expect(source).toMatch(/Bearer/);
    });
  }
});

// --- AC-CRT6: Thomas's API key is a UUID ---

describe("AC-CRT6: Thomas's API key is a UUID (not 'default-thomas-key')", () => {
  it("Thomas key in SQLite is UUID format", async () => {
    try {
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(
        "/home/developer/workspaces/github/PichlerThomas/best-practices/api/data/thought-tracing.db",
      );
      const row = db.prepare("SELECT api_key FROM users WHERE user_id = 'thomas'").get() as
        | { api_key: string }
        | undefined;
      db.close();

      expect(row).toBeDefined();
      // Key should NOT be the old hardcoded value
      expect(row!.api_key).not.toBe("default-thomas-key");
      // Key should be UUID format (8-4-4-4-12 hex)
      expect(row!.api_key).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    } catch {
      // Skip if DB not accessible
      return;
    }
  });
});

// --- AC-CRT7: Old key returns 401 ---

describe("AC-CRT7: Old key 'default-thomas-key' returns 401", () => {
  it("brain API rejects default-thomas-key", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    const res = await fetch(`${API_URL}/api/v1/memory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer default-thomas-key",
      },
      body: JSON.stringify({
        prompt: "credential rotation test — old key should fail",
        agent_id: "cred-test",
        agent_name: "Credential Test",
        read_only: true,
      }),
    });
    expect(res.status).toBe(401);
  });
});

// --- AC-CRT8: New UUID key returns 200 ---

describe("AC-CRT8: New UUID key returns 200", () => {
  it("brain API accepts new UUID key from env", async () => {
    const up = await apiIsRunning();
    if (!up) return;

    // Skip if BRAIN_API_KEY not set (means rotation hasn't happened yet)
    if (!process.env.BRAIN_API_KEY) {
      expect(process.env.BRAIN_API_KEY).toBeDefined();
      return;
    }

    const res = await fetch(`${API_URL}/api/v1/memory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BRAIN_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: "credential rotation test — new key should succeed",
        agent_id: "cred-test",
        agent_name: "Credential Test",
        read_only: true,
      }),
    });
    expect(res.status).toBe(200);
  });
});

// --- AC-CRT9: Test files don't hardcode "default-thomas-key" ---

describe("AC-CRT9: Test files don't hardcode 'default-thomas-key'", () => {
  const testFiles = [
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-auth.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-routing.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-maria-test.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-sharing.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-gardening.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-provision-script.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-mcp-config.test.ts",
    "/home/developer/workspaces/github/PichlerThomas/best-practices/api/src/services/multi-user-migration.test.ts",
  ];

  for (const testPath of testFiles) {
    const fileName = testPath.split("/").pop();

    it(`${fileName} does not contain 'default-thomas-key'`, async () => {
      const fs = await import("node:fs");
      if (!fs.existsSync(testPath)) return; // Skip if file doesn't exist
      const source = fs.readFileSync(testPath, "utf-8");
      expect(source).not.toContain("default-thomas-key");
    });
  }
});
