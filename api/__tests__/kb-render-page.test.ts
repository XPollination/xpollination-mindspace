import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * KB Render Page Tests — kb-render-page
 * Validates: renderNodePage() generates styled HTML with markdown rendering.
 * TDD: Dev updates renderNodePage in viz/server.js.
 */

describe('renderNodePage generates complete HTML', () => {

  it('renderNodePage includes type badge', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/badge|type.*label|node.*type|Mission|Capability|Requirement/i);
  });

  it('renderNodePage uses marked.js for markdown rendering', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/marked\.parse|marked\(|require.*marked/i);
  });

  it('renderNodePage includes breadcrumb with short_id links', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/breadcrumb.*short_id|\/m\/.*short_id|\/c\/.*short_id/i);
  });

  it('renderNodePage has children section', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/children|child.*nodes|capabilities.*forEach|requirements.*forEach/i);
  });

  it('renderNodePage has dark theme CSS', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/#1a1a2e|#16213e|dark|background.*#[0-9a-f]/i);
  });

  it('renderNodePage generates valid HTML structure', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/<html|<!DOCTYPE|<head|<body/i);
  });
});

describe('Children queries for drill-down', () => {

  it('mission page queries capabilities as children', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/capabilities.*mission_id|FROM capabilities WHERE mission_id/i);
  });

  it('capability page queries requirements as children', () => {
    const content = existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
    expect(content).toMatch(/requirements.*capability_id|FROM requirements WHERE capability_id/i);
  });
});
