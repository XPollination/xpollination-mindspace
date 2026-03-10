/**
 * TDD tests for ms-a11-8-central-skill
 *
 * Verifies central skill script (/xpo.agent.connect/):
 * - Skill file exists at skills/xpo.agent.connect/SKILL.md
 * - Role extraction from suffix
 * - Agent Card discovery
 * - Connect flow: twin JSON, WELCOME response, reconnect, auth
 * - SSE stream + heartbeat loop
 * - Disconnect cleanup
 *
 * DEV IMPLEMENTATION NOTES:
 * - Create skills/xpo.agent.connect/SKILL.md:
 *   - Skill definition with role extraction from command suffix
 *   - Agent Card fetch from MINDSPACE_API_URL/api/agent-card
 *   - Digital twin construction (identity, role, project, state, metadata)
 *   - POST /a2a/connect with twin → WELCOME response
 *   - SSE stream at /a2a/events/:agentId
 *   - HEARTBEAT loop (30s interval)
 *   - DISCONNECT on session end
 *   - Env vars: MINDSPACE_API_URL, AGENT_API_KEY
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  "/home/developer/workspaces/github/PichlerThomas/xpollination-mcp-server-test"
);

// --- File structure ---
describe("ms-a11-8-central-skill: file structure", () => {
  it("skill file exists", () => {
    const paths = [
      resolve(PROJECT_ROOT, "skills/xpo.agent.connect/SKILL.md"),
      resolve(PROJECT_ROOT, ".claude/skills/xpo.agent.connect/SKILL.md"),
    ];
    expect(paths.some(p => existsSync(p))).toBe(true);
  });
});

// --- Skill content ---
describe("ms-a11-8-central-skill: SKILL.md", () => {
  let content: string;
  try {
    const paths = [
      resolve(PROJECT_ROOT, "skills/xpo.agent.connect/SKILL.md"),
      resolve(PROJECT_ROOT, ".claude/skills/xpo.agent.connect/SKILL.md"),
    ];
    content = "";
    for (const p of paths) { try { content += readFileSync(p, "utf-8"); } catch {} }
  } catch { content = ""; }

  it("defines role extraction from suffix", () => {
    expect(content).toMatch(/role/i);
    expect(content).toMatch(/suffix|argument|param/i);
  });

  it("references Agent Card discovery", () => {
    expect(content).toMatch(/agent.card|agent-card|agentCard/i);
  });

  it("constructs digital twin with identity", () => {
    expect(content).toMatch(/identity/i);
    expect(content).toMatch(/twin|digital/i);
  });

  it("sends POST to /a2a/connect", () => {
    expect(content).toMatch(/\/a2a\/connect/);
  });

  it("handles WELCOME response", () => {
    expect(content).toMatch(/WELCOME/);
  });

  it("opens SSE stream for events", () => {
    expect(content).toMatch(/SSE|events|EventSource/i);
  });

  it("implements HEARTBEAT loop", () => {
    expect(content).toMatch(/HEARTBEAT/);
    expect(content).toMatch(/30|interval|loop/i);
  });

  it("handles DISCONNECT on session end", () => {
    expect(content).toMatch(/DISCONNECT/);
  });

  it("uses MINDSPACE_API_URL env var", () => {
    expect(content).toMatch(/MINDSPACE_API_URL/);
  });

  it("uses AGENT_API_KEY env var for auth", () => {
    expect(content).toMatch(/AGENT_API_KEY|api_key|API_KEY/);
  });

  it("handles reconnect scenario", () => {
    expect(content).toMatch(/reconnect/i);
  });

  it("references project context", () => {
    expect(content).toMatch(/project/i);
  });
});
