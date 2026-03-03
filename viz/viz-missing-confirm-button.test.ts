/**
 * TDD tests for viz-missing-confirm-button — Approve/Rework buttons in viz
 * for MANUAL approval mode, rework API endpoint, pulsing border, engine enforcement.
 *
 * From PDSA viz-missing-confirm-button v0.0.1 (2026-03-03):
 *
 * Sub-problem 1: APPROVE + REWORK BUTTONS
 *   AC-BTN1: Approve button visible in detail panel for tasks at approval status when MANUAL mode active
 *   AC-BTN2: Rework button visible alongside Approve for same condition
 *   AC-BTN3: Buttons visible for tasks at review+liaison status when MANUAL mode active
 *   AC-BTN4: Approve button sets human_confirmed=true AND human_confirmed_via='viz' in DNA
 *   AC-BTN5: Buttons clearly visible — not hidden behind scroll or conditional rendering bugs
 *
 * Sub-problem 2: REWORK API ENDPOINT
 *   AC-RWK1: PUT /api/node/:slug/rework endpoint exists in server.js
 *   AC-RWK2: Rework endpoint sets rework reason in DNA
 *
 * Sub-problem 3: PULSING AMBER BORDER
 *   AC-PULSE1: CSS animation for pulsing amber border on packages needing MANUAL action
 *   AC-PULSE2: Pulsing applied to approval and review+liaison tasks when MANUAL mode active
 *
 * Sub-problem 4: ENGINE ENFORCEMENT
 *   AC-ENG1: Confirm endpoint sets human_confirmed_via='viz' (not just human_confirmed=true)
 *   AC-ENG2: interface-cli.js checks human_confirmed_via field in manual mode
 *
 * Sub-problem 5: VERSION SYMLINK
 *   AC-VER1: Versioned server.js has rework endpoint
 *   AC-VER2: Versioned index.html has Approve+Rework buttons
 *
 * Tests are source code checks on viz index.html, server.js, and interface-cli.js.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);
const VIZ_PATH = join(VIZ_DIR, "index.html");
const SERVER_PATH = join(VIZ_DIR, "server.js");
const CLI_PATH = resolve(
  __dirname,
  "..",
  "src",
  "db",
  "interface-cli.js"
);

function readViz(): string {
  return readFileSync(VIZ_PATH, "utf-8");
}

function readServer(): string {
  return readFileSync(SERVER_PATH, "utf-8");
}

function readCli(): string {
  return readFileSync(CLI_PATH, "utf-8");
}

// ============================================================
// Sub-problem 1: APPROVE + REWORK BUTTONS
// ============================================================

describe("AC-BTN1: Approve button visible for tasks at approval status in MANUAL mode", () => {
  it("showDetail renders an Approve button for approval-status tasks", () => {
    const source = readViz();
    // Must have a button labeled Approve (not just "Confirm")
    expect(source).toMatch(/Approve/);
    // The button should be rendered in the detail panel area
    const showDetailStart = source.indexOf("function showDetail");
    expect(showDetailStart).toBeGreaterThan(-1);
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    expect(showDetailBlock).toMatch(/Approve/);
  });

  it("Approve button is conditional on MANUAL mode and approval/review+liaison status", () => {
    const source = readViz();
    const showDetailStart = source.indexOf("function showDetail");
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    // Must check for manual mode
    expect(showDetailBlock).toMatch(/manual/i);
    // Must check for approval or review+liaison status
    expect(showDetailBlock).toMatch(/approval/);
  });
});

describe("AC-BTN2: Rework button visible alongside Approve", () => {
  it("showDetail renders a Rework button in the detail panel", () => {
    const source = readViz();
    const showDetailStart = source.indexOf("function showDetail");
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    // Must have both Approve and Rework buttons
    expect(showDetailBlock).toMatch(/Rework/);
  });

  it("Rework button is styled distinctly from Approve (red/orange vs green)", () => {
    const source = readViz();
    const showDetailStart = source.indexOf("function showDetail");
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    // Rework button should have a different color (red, orange, or amber)
    // Approve should be green
    const hasApproveGreen = showDetailBlock.match(
      /Approve[\s\S]{0,200}(#22c55e|#4ade80|green)/i
    ) || showDetailBlock.match(
      /(#22c55e|#4ade80|green)[\s\S]{0,200}Approve/i
    );
    const hasReworkRed = showDetailBlock.match(
      /Rework[\s\S]{0,200}(#ef4444|#f59e0b|#fb923c|red|orange|amber)/i
    ) || showDetailBlock.match(
      /(#ef4444|#f59e0b|#fb923c|red|orange|amber)[\s\S]{0,200}Rework/i
    );
    expect(hasApproveGreen).toBeTruthy();
    expect(hasReworkRed).toBeTruthy();
  });
});

describe("AC-BTN3: Buttons visible for review+liaison status tasks", () => {
  it("condition includes review status with liaison role", () => {
    const source = readViz();
    const showDetailStart = source.indexOf("function showDetail");
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    // Must render buttons for review+liaison (not just approval)
    expect(showDetailBlock).toMatch(/review/);
    expect(showDetailBlock).toMatch(/liaison/);
  });
});

describe("AC-BTN4: Approve button sets human_confirmed AND human_confirmed_via", () => {
  it("Approve click handler sends human_confirmed_via='viz' in the request", () => {
    const source = readViz();
    // The approve/confirm handler must include human_confirmed_via
    expect(source).toMatch(/human_confirmed_via/);
    // It should set the value to 'viz'
    expect(source).toMatch(/human_confirmed_via.*viz|viz.*human_confirmed_via/);
  });
});

describe("AC-BTN5: Buttons clearly visible — not hidden", () => {
  it("button section is NOT inside a scrollable container that hides overflow", () => {
    const source = readViz();
    // The confirm/approve section should have margin-top and border-top for visibility
    const showDetailStart = source.indexOf("function showDetail");
    const showDetailBlock = source.substring(showDetailStart, showDetailStart + 5000);
    // Must have visual separation (border-top or padding) making buttons visible
    const hasVisualSeparation = showDetailBlock.match(
      /(Approve|Rework)[\s\S]{0,500}(border-top|margin-top|padding-top)/i
    ) || showDetailBlock.match(
      /(border-top|margin-top|padding-top)[\s\S]{0,500}(Approve|Rework)/i
    );
    expect(hasVisualSeparation).toBeTruthy();
  });
});

// ============================================================
// Sub-problem 2: REWORK API ENDPOINT
// ============================================================

describe("AC-RWK1: PUT /api/node/:slug/rework endpoint exists", () => {
  it("server.js has a route handler for /api/node/:slug/rework", () => {
    const source = readServer();
    expect(source).toMatch(/\/api\/node\/.*\/rework/);
  });

  it("rework endpoint uses PUT method", () => {
    const source = readServer();
    const reworkMatch = source.indexOf("/rework");
    expect(reworkMatch).toBeGreaterThan(-1);
    // Within the handler block, it should check for PUT
    const reworkBlock = source.substring(
      Math.max(0, reworkMatch - 200),
      reworkMatch + 500
    );
    expect(reworkBlock).toMatch(/PUT/);
  });
});

describe("AC-RWK2: Rework endpoint sets rework reason in DNA", () => {
  it("rework handler reads reason from request body and writes to DNA", () => {
    const source = readServer();
    const reworkMatch = source.indexOf("/rework");
    expect(reworkMatch).toBeGreaterThan(-1);
    const reworkBlock = source.substring(reworkMatch, reworkMatch + 1000);
    // Must read reason from body
    expect(reworkBlock).toMatch(/reason|rework_reason/i);
    // Must update DNA
    expect(reworkBlock).toMatch(/dna_json|dna/);
  });
});

// ============================================================
// Sub-problem 3: PULSING AMBER BORDER
// ============================================================

describe("AC-PULSE1: CSS animation for pulsing amber border", () => {
  it("viz has a CSS @keyframes animation for pulsing effect", () => {
    const source = readViz();
    expect(source).toMatch(/@keyframes.*pulse|pulse.*@keyframes/i);
  });

  it("pulsing animation uses amber/orange color", () => {
    const source = readViz();
    // The pulse animation should reference amber (#f59e0b), orange (#fb923c), or similar
    const pulseStart = source.indexOf("@keyframes");
    expect(pulseStart).toBeGreaterThan(-1);
    // Find the pulse keyframes block
    const keyframesBlock = source.substring(pulseStart, pulseStart + 500);
    expect(keyframesBlock).toMatch(
      /#f59e0b|#fb923c|#fbbf24|amber|orange|rgb\(245|rgb\(251/i
    );
  });
});

describe("AC-PULSE2: Pulsing applied to approval/review+liaison tasks in MANUAL mode", () => {
  it("packages in approval or review+liaison status get pulsing class when MANUAL mode", () => {
    const source = readViz();
    // The rendering code must apply a pulsing class/style based on status + mode
    expect(source).toMatch(/pulse|pulsing|needs-action|manual-action/i);
    // Must be conditional on manual mode
    expect(source).toMatch(/manual.*pulse|pulse.*manual/i);
  });
});

// ============================================================
// Sub-problem 4: ENGINE ENFORCEMENT
// ============================================================

describe("AC-ENG1: Confirm endpoint sets human_confirmed_via='viz'", () => {
  it("server.js confirm endpoint writes human_confirmed_via to DNA", () => {
    const source = readServer();
    const confirmMatch = source.indexOf("/confirm");
    expect(confirmMatch).toBeGreaterThan(-1);
    const confirmBlock = source.substring(confirmMatch, confirmMatch + 1000);
    expect(confirmBlock).toMatch(/human_confirmed_via/);
    expect(confirmBlock).toMatch(/viz/);
  });
});

describe("AC-ENG2: interface-cli.js checks human_confirmed_via in manual mode", () => {
  it("CLI manual mode gate checks human_confirmed_via field", () => {
    const source = readCli();
    expect(source).toMatch(/human_confirmed_via/);
  });

  it("CLI rejects transition when human_confirmed_via is not 'viz' in manual mode", () => {
    const source = readCli();
    // Must check that human_confirmed_via === 'viz'
    const manualGateMatch = source.match(
      /manual[\s\S]{0,500}human_confirmed_via/
    );
    expect(manualGateMatch).toBeTruthy();
    // Must reference 'viz' as the expected value
    if (manualGateMatch) {
      const block = manualGateMatch[0];
      expect(block).toMatch(/viz/);
    }
  });
});

// ============================================================
// Sub-problem 5: VERSION SYMLINK UPDATES
// ============================================================

describe("AC-VER1: Versioned server.js has rework endpoint", () => {
  it("versioned server.js contains /rework route", () => {
    const versionedServer = join(VIZ_DIR, "versions", "v0.0.1", "server.js");
    if (!existsSync(versionedServer)) {
      expect(existsSync(versionedServer)).toBe(true);
      return;
    }
    const source = readFileSync(versionedServer, "utf-8");
    expect(source).toMatch(/\/api\/node\/.*\/rework/);
  });
});

describe("AC-VER2: Versioned index.html has Approve+Rework buttons", () => {
  it("versioned index.html contains Approve and Rework buttons", () => {
    const versionedIndex = join(VIZ_DIR, "versions", "v0.0.1", "index.html");
    if (!existsSync(versionedIndex)) {
      expect(existsSync(versionedIndex)).toBe(true);
      return;
    }
    const source = readFileSync(versionedIndex, "utf-8");
    expect(source).toMatch(/Approve/);
    expect(source).toMatch(/Rework/);
  });
});
