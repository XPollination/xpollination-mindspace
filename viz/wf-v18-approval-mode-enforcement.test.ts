/**
 * TDD tests for wf-v18-approval-mode-enforcement — WORKFLOW v0.0.18 approval
 * mode enforcement matrix.
 *
 * From PDSA wf-v18-approval-mode-enforcement v0.0.1 (2026-03-12):
 *
 * AC-MATRIX1: workflow-engine.js has requiresHumanConfirm on review→rework:liaison
 * AC-MATRIX2: workflow-engine.js does NOT have requiresHumanConfirm on complete→rework
 * AC-MATRIX3: interface-cli.js gate: auto mode — all transitions pass freely
 * AC-MATRIX4: interface-cli.js gate: auto-approval — completion transitions gated, others free
 * AC-MATRIX5: interface-cli.js gate: semi mode — all transitions pass freely (protocol only)
 * AC-MATRIX6: interface-cli.js gate: manual mode — all requiresHumanConfirm transitions gated
 * AC-MATRIX7: complete→rework accepts --rework-target-role CLI parameter
 * AC-MATRIX8: viz API accepts "auto-approval" as valid mode
 * AC-MATRIX9: viz Complete button exists on review+liaison and approval+liaison cards
 * AC-MATRIX10: viz buttons show conditionally based on mode
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const SRC_DIR = resolve(__dirname, "..", "src", "db");
const VIZ_DIR = resolve(__dirname);
const CLI_PATH = join(SRC_DIR, "interface-cli.js");
const ENGINE_PATH = join(SRC_DIR, "workflow-engine.js");
const VIZ_HTML_PATH = join(VIZ_DIR, "index.html");
const SERVER_PATH = join(VIZ_DIR, "server.js");

const VIZ_URL = "http://localhost:8080";

async function vizServerIsRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${VIZ_URL}/api/projects`);
    return res.ok;
  } catch {
    return false;
  }
}

let vizUp: boolean;

beforeAll(async () => {
  vizUp = await vizServerIsRunning();
});

// ============================================================
// AC-MATRIX1: review→rework:liaison has requiresHumanConfirm
// ============================================================

describe("AC-MATRIX1: review→rework:liaison has requiresHumanConfirm", () => {
  it("workflow-engine.js task transitions include requiresHumanConfirm on review->rework:liaison", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    const taskTransitions = transitions["task"];
    expect(taskTransitions["review->rework:liaison"]).toBeDefined();
    expect(taskTransitions["review->rework:liaison"].requiresHumanConfirm).toBe(true);
  });
});

// ============================================================
// AC-MATRIX2: complete→rework does NOT have requiresHumanConfirm
// (protocol only — no engine gate in any mode)
// ============================================================

describe("AC-MATRIX2: complete→rework is protocol-only (no requiresHumanConfirm)", () => {
  it("workflow-engine.js complete->rework does NOT have requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    const taskTransitions = transitions["task"];
    expect(taskTransitions["complete->rework"]).toBeDefined();
    // Per v0.0.18: complete→rework is protocol-only — no engine gate
    expect(taskTransitions["complete->rework"].requiresHumanConfirm).toBeFalsy();
  });
});

// ============================================================
// AC-MATRIX3: Auto mode — all transitions pass freely
// ============================================================

describe("AC-MATRIX3: Auto mode has no enforcement (all transitions free)", () => {
  it("interface-cli.js gate does not block any transition in auto mode", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    // Extract the gate block (generous size to capture the full logic)
    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // Auto mode should have no enforcement — the requiresVizConfirm logic
    // should NOT trigger when mode is 'auto'
    // Check that auto mode is explicitly free (no error() calls for auto)
    const hasAutoError = gateBlock.match(/modeValue\s*===\s*['"]auto['"]\s*[^-]/) &&
                         gateBlock.match(/auto['"]\)[\s\S]*?error\(/);
    // This is a source-level check: auto mode should not appear in any
    // condition that leads to an error() call
    expect(hasAutoError).toBeFalsy();
  });
});

// ============================================================
// AC-MATRIX4: Auto-approval mode — completion transitions gated,
//             approval-direction and rework-direction free
// ============================================================

describe("AC-MATRIX4: Auto-approval gates completion transitions only", () => {
  it("interface-cli.js gate uses auto-approval mode with isCompletionTransition check", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // Must reference auto-approval mode
    expect(gateBlock).toContain("auto-approval");

    // Must have a completion transition check (newStatus === 'complete')
    expect(gateBlock).toMatch(/isCompletionTransition|newStatus\s*===\s*['"]complete['"]/);

    // auto-approval should be combined with isCompletionTransition
    // Pattern: (modeValue === 'auto-approval' && isCompletionTransition)
    expect(gateBlock).toMatch(/auto-approval.*completion|completion.*auto-approval/i);
  });

  it("auto-approval mode requires human_confirmed for completion transitions", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // Must check human_confirmed when requiresVizConfirm is true
    expect(gateBlock).toContain("human_confirmed");
    expect(gateBlock).toContain("human_confirmed_via");

    // Must check via=viz (not just human_confirmed alone)
    expect(gateBlock).toMatch(/human_confirmed_via.*viz|viz.*human_confirmed_via/);
  });
});

// ============================================================
// AC-MATRIX5: Semi mode — all transitions pass freely (protocol only)
// ============================================================

describe("AC-MATRIX5: Semi mode has no engine enforcement", () => {
  it("interface-cli.js gate does not block any transition in semi mode", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // Semi mode should not trigger error() — it's protocol-only
    // The requiresVizConfirm condition should exclude semi
    const requiresVizMatch = gateBlock.match(/requiresVizConfirm\s*=[\s\S]*?;/);
    if (requiresVizMatch) {
      // requiresVizConfirm should NOT include 'semi'
      expect(requiresVizMatch[0]).not.toContain("'semi'");
    }
  });
});

// ============================================================
// AC-MATRIX6: Manual mode — all requiresHumanConfirm transitions gated
// ============================================================

describe("AC-MATRIX6: Manual mode gates all requiresHumanConfirm transitions", () => {
  it("interface-cli.js gate requires human_confirmed+via=viz for manual mode", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // Manual mode must be in the requiresVizConfirm condition
    expect(gateBlock).toContain("'manual'");

    // Must have error messages for missing human_confirmed and wrong via
    expect(gateBlock).toMatch(/error.*human.*confirm|human.*confirm.*error/i);
  });

  it("manual mode gates ALL transitions with requiresHumanConfirm (not just completions)", () => {
    const source = readFileSync(CLI_PATH, "utf-8");
    const gateStart = source.indexOf("LIAISON approval mode enforcement gate");
    expect(gateStart).toBeGreaterThan(-1);

    const gateBlock = source.slice(gateStart, gateStart + 2000);

    // The requiresVizConfirm condition for manual should NOT be limited to
    // isCompletionTransition — it applies to ALL requiresHumanConfirm transitions
    const requiresVizMatch = gateBlock.match(/requiresVizConfirm\s*=[\s\S]*?;/);
    expect(requiresVizMatch).not.toBeNull();

    if (requiresVizMatch) {
      const condition = requiresVizMatch[0];
      // Manual mode should be an OR condition separate from auto-approval+completion
      // Pattern: (modeValue === 'manual') || (modeValue === 'auto-approval' && isCompletionTransition)
      expect(condition).toContain("'manual'");
      // Manual should NOT be combined with isCompletionTransition
      const manualPart = condition.split("||").find((p: string) => p.includes("'manual'"));
      if (manualPart) {
        expect(manualPart).not.toMatch(/isCompletionTransition|newStatus.*complete/);
      }
    }
  });
});

// ============================================================
// AC-MATRIX7: complete→rework accepts --rework-target-role CLI parameter
// ============================================================

describe("AC-MATRIX7: complete→rework --rework-target-role parameter", () => {
  it("interface-cli.js cmdTransition handles --rework-target-role for complete→rework", () => {
    const source = readFileSync(CLI_PATH, "utf-8");

    // Must have logic for parsing --rework-target-role from CLI args
    expect(source).toContain("--rework-target-role");

    // Must only apply to complete→rework
    expect(source).toMatch(/complete.*rework.*rework.target.role|rework.target.role.*complete.*rework/s);
  });

  it("--rework-target-role writes to DNA before transition validation", () => {
    const source = readFileSync(CLI_PATH, "utf-8");

    // The --rework-target-role parsing must appear before the transition
    // validation logic (requiresDna check)
    const reworkArgIndex = source.indexOf("--rework-target-role");
    expect(reworkArgIndex).toBeGreaterThan(-1);

    // It should set dna.rework_target_role
    const relevantBlock = source.slice(reworkArgIndex, reworkArgIndex + 500);
    expect(relevantBlock).toMatch(/dna\.rework_target_role|rework_target_role/);
  });
});

// ============================================================
// AC-MATRIX8: Viz API accepts "auto-approval" as valid mode
// ============================================================

describe("AC-MATRIX8: Viz accepts auto-approval mode", () => {
  it("server.js validation includes auto-approval as valid mode", () => {
    const source = readFileSync(SERVER_PATH, "utf-8");

    // The mode validation array must include 'auto-approval'
    expect(source).toContain("auto-approval");

    // Find the validation line and check it includes auto-approval
    const validationMatch = source.match(/\[.*'manual'.*'semi'.*'auto'/);
    expect(validationMatch).not.toBeNull();
    if (validationMatch) {
      expect(validationMatch[0]).toContain("auto-approval");
    }
  });

  it("PUT /api/settings/liaison-approval-mode accepts auto-approval", async () => {
    if (!vizUp) return;
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto-approval" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { mode: string };
    expect(data.mode).toBe("auto-approval");

    // Reset to manual after test
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
  });

  it("GET /api/settings/liaison-approval-mode returns auto-approval after setting", async () => {
    if (!vizUp) return;
    // Set to auto-approval
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "auto-approval" }),
    });
    const res = await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`);
    const data = (await res.json()) as { mode: string };
    expect(data.mode).toBe("auto-approval");

    // Reset
    await fetch(`${VIZ_URL}/api/settings/liaison-approval-mode`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "manual" }),
    });
  });
});

// ============================================================
// AC-MATRIX9: Viz Complete button exists on review+liaison and
//             approval+liaison cards
// ============================================================

describe("AC-MATRIX9: Viz Complete button in HTML", () => {
  it("index.html contains a Complete button element", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    // Must have a button for completing tasks (distinct from approve)
    expect(source).toMatch(/complete.*btn|Complete.*button|id=["']complete/i);
  });

  it("Complete button uses the confirm endpoint to set human_confirmed", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    // The complete button click handler should call the confirm endpoint
    // (same as approve — sets human_confirmed=true, human_confirmed_via=viz)
    // Look for complete button handler that calls /api/node/:slug/confirm
    expect(source).toMatch(/complete.*confirm|confirm.*complete/is);
  });
});

// ============================================================
// AC-MATRIX10: Viz buttons show conditionally based on mode
// ============================================================

describe("AC-MATRIX10: Button display conditions per mode", () => {
  it("index.html has auto-approval option in mode dropdown", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");
    expect(source).toContain('value="auto-approval"');
  });

  it("Complete button shown in manual AND auto-approval modes", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");

    // Button display logic should show Complete for both manual and auto-approval
    // Pattern: (mode === 'manual' || mode === 'auto-approval')
    expect(source).toMatch(/auto-approval.*complete|complete.*auto-approval/is);
  });

  it("Approve/Rework buttons shown only in manual mode (not auto-approval)", () => {
    const source = readFileSync(VIZ_HTML_PATH, "utf-8");

    // The approve/rework buttons should only show in manual mode
    // They should NOT trigger in auto-approval (because those transitions are free)
    // Look for button display condition that checks for 'manual' only
    const showApproveMatch = source.match(/showApprove\w*\s*=[\s\S]*?;/);
    if (showApproveMatch) {
      expect(showApproveMatch[0]).toContain("'manual'");
      expect(showApproveMatch[0]).not.toContain("'auto-approval'");
    }
  });
});

// ============================================================
// Regression: existing requiresHumanConfirm flags unchanged
// ============================================================

describe("Regression: other requiresHumanConfirm flags still present", () => {
  it("approval->approved still has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    expect(transitions["task"]["approval->approved"].requiresHumanConfirm).toBe(true);
  });

  it("approval->complete still has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    expect(transitions["task"]["approval->complete"].requiresHumanConfirm).toBe(true);
  });

  it("approval->rework still has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    expect(transitions["task"]["approval->rework"].requiresHumanConfirm).toBe(true);
  });

  it("review->complete still has requiresHumanConfirm: true", async () => {
    const engine = await import("../src/db/workflow-engine.js") as Record<string, unknown>;
    const transitions = engine.ALLOWED_TRANSITIONS as Record<string, Record<string, { requiresHumanConfirm?: boolean }>>;
    expect(transitions["task"]["review->complete"].requiresHumanConfirm).toBe(true);
  });
});
