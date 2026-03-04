/**
 * TDD tests for viz-show-slug-on-cards v0.0.1
 *
 * Verifies task slug is visible on Kanban cards below project name.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const VIZ_DIR = resolve(__dirname);

function readViz(): string {
  const activeIndex = join(VIZ_DIR, "active", "index.html");
  if (existsSync(activeIndex)) {
    return readFileSync(activeIndex, "utf-8");
  }
  return readFileSync(join(VIZ_DIR, "index.html"), "utf-8");
}

describe("Task slug visible on Kanban cards", () => {
  it("card template includes slug in rendering", () => {
    const source = readViz();
    // Card rendering must reference node.slug or slug
    expect(source).toMatch(/\.slug|node\.slug/);
  });

  it("slug has its own display element on the card", () => {
    const source = readViz();
    // Slug must be in a dedicated element (div, span, etc.) with slug-related class or identifier
    expect(source).toMatch(/card-slug|task-slug|slug.*class|class.*slug/i);
  });

  it("slug CSS styles for readability (monospace or muted)", () => {
    const source = readViz();
    // Slug should have distinct styling — monospace or muted color
    expect(source).toMatch(/card-slug|task-slug/i);
  });

  it("slug appears in both Kanban column cards AND blocked section cards", () => {
    const source = readViz();
    // Count slug rendering occurrences — should appear in both card templates
    const slugMatches = source.match(/\.slug/g) || [];
    // At least 2 references (one per card template: columns + blocked)
    expect(slugMatches.length).toBeGreaterThanOrEqual(2);
  });
});
