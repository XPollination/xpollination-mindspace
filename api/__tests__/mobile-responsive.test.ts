import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, '../../viz/server.js');

/**
 * TDD Tests: Mobile-Responsive CSS for Viz
 * Ref: REQ-VKF-005, mobile-responsive-design
 */

function getServerContent(): string {
  return existsSync(SERVER_PATH) ? readFileSync(SERVER_PATH, 'utf-8') : '';
}

describe('AC1: Mission cards responsive grid', () => {

  it('CSS includes 768px breakpoint', () => {
    const content = getServerContent();
    expect(content).toMatch(/768px/);
  });

  it('CSS includes 480px breakpoint', () => {
    const content = getServerContent();
    expect(content).toMatch(/480px/);
  });

  it('grid switches to 2-col at tablet', () => {
    const content = getServerContent();
    expect(content).toMatch(/repeat\(2|grid-template-columns.*2/);
  });
});

describe('AC2: Tables horizontally scrollable', () => {

  it('table has overflow-x auto', () => {
    const content = getServerContent();
    expect(content).toMatch(/overflow-x.*auto|overflow.*scroll/i);
  });
});

describe('AC3: Touch targets minimum 44px', () => {

  it('44px touch target sizing', () => {
    const content = getServerContent();
    expect(content).toMatch(/44px|min-height.*44|min-width.*44/);
  });
});

describe('Hamburger menu', () => {

  it('hamburger menu element exists', () => {
    const content = getServerContent();
    expect(content).toMatch(/hamburger|menu.*toggle|checkbox.*hack/i);
  });
});
