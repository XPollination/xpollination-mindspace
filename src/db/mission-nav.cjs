#!/usr/bin/env node
/**
 * mission-nav.js — Mission Navigation Tool
 *
 * Transforms missions into navigable structure (section markers + map)
 * and extracts sections by ID for focused reading.
 *
 * Commands:
 *   transform <short_id>   Add section markers + section map to a mission
 *   extract <short_id> <section_id>   Extract one section by marker ID
 *   list <short_id>        List all sections with status and deps
 *   verify <short_id>      Check all cross-mission deep links resolve
 *
 * Examples:
 *   node src/db/mission-nav.js list 643e138a
 *   node src/db/mission-nav.js extract 643e138a workers
 *   node src/db/mission-nav.js transform d0b218fd
 *   node src/db/mission-nav.js verify ab44df98
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.MINDSPACE_DB || '/mnt/HC_Volume_105173237/mindspace/data-prod/mindspace.db';

function slugify(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function openDb() {
  return new Database(DB_PATH);
}

function getMission(db, shortId) {
  const m = db.prepare('SELECT * FROM missions WHERE short_id = ?').get(shortId);
  if (!m) {
    // Try by id or slug
    return db.prepare('SELECT * FROM missions WHERE id = ? OR slug = ?').get(shortId, shortId);
  }
  return m;
}

/**
 * Parse existing section markers from content_md
 */
function parseSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let currentSection = null;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const markerMatch = lines[i].match(/<!--\s*@section:\s*(\S+)\s*\|\s*v:(\d+)\s*\|\s*deps:\[([^\]]*)\]\s*\|\s*status:(\S+)\s*-->/);
    if (markerMatch) {
      // Save previous section
      if (currentSection) {
        currentSection.content = currentLines.join('\n');
        sections.push(currentSection);
      }
      currentSection = {
        id: markerMatch[1],
        version: parseInt(markerMatch[2]),
        deps: markerMatch[3] ? markerMatch[3].split(',').map(d => d.trim()).filter(Boolean) : [],
        status: markerMatch[4],
        startLine: i,
        content: '',
      };
      currentLines = [lines[i]];
    } else if (currentSection) {
      currentLines.push(lines[i]);
    }
  }
  // Save last section
  if (currentSection) {
    currentSection.content = currentLines.join('\n');
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Parse headings from markdown content (for missions without markers)
 */
function parseHeadings(content) {
  const lines = content.split('\n');
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{2,3})\s+(.+)/);
    if (m) {
      headings.push({
        level: m[1].length,
        text: m[2].trim(),
        slug: slugify(m[2].trim()),
        line: i,
      });
    }
  }
  return headings;
}

/**
 * cmd: list — List all sections with status and deps
 */
function cmdList(shortId) {
  const db = openDb();
  const m = getMission(db, shortId);
  if (!m) { console.error('Mission not found:', shortId); process.exit(1); }

  const sections = parseSections(m.content_md || '');
  if (sections.length === 0) {
    // No markers — show headings instead
    const headings = parseHeadings(m.content_md || '');
    console.log(`Mission: ${m.title} (${m.short_id}) — NO SECTION MARKERS`);
    console.log(`Headings (${headings.length}):\n`);
    headings.forEach(h => {
      const indent = h.level === 3 ? '  ' : '';
      console.log(`${indent}${h.slug}  ←  ${h.text}`);
    });
    console.log(`\nRun: node src/db/mission-nav.js transform ${shortId}`);
  } else {
    console.log(`Mission: ${m.title} (${m.short_id})`);
    console.log(`Sections (${sections.length}):\n`);
    const maxId = Math.max(...sections.map(s => s.id.length));
    sections.forEach(s => {
      const deps = s.deps.length ? s.deps.join(',') : '—';
      console.log(`  ${s.id.padEnd(maxId + 2)} v:${s.version}  ${s.status.padEnd(12)}  deps:[${deps}]`);
    });
  }
  db.close();
}

/**
 * cmd: extract — Extract one section by marker ID
 */
function cmdExtract(shortId, sectionId) {
  const db = openDb();
  const m = getMission(db, shortId);
  if (!m) { console.error('Mission not found:', shortId); process.exit(1); }

  const sections = parseSections(m.content_md || '');
  const section = sections.find(s => s.id === sectionId);
  if (!section) {
    console.error(`Section "${sectionId}" not found in mission ${shortId}`);
    console.error('Available sections:', sections.map(s => s.id).join(', '));
    process.exit(1);
  }

  console.log(section.content);
  db.close();
}

/**
 * cmd: transform — Add section markers to a mission
 */
function cmdTransform(shortId, opts = {}) {
  const db = openDb();
  const m = getMission(db, shortId);
  if (!m) { console.error('Mission not found:', shortId); process.exit(1); }

  const content = m.content_md || '';
  const existingSections = parseSections(content);

  if (existingSections.length > 0 && !opts.force) {
    console.log(`Mission ${shortId} already has ${existingSections.length} section markers.`);
    console.log('Use --force to re-transform.');
    db.close();
    return;
  }

  const headings = parseHeadings(content);
  const lines = content.split('\n');
  const h2Headings = headings.filter(h => h.level === 2);

  // Build section map table
  const mapRows = h2Headings.map(h => {
    return `| ${h.slug} | ${h.text} | — | validated |`;
  });

  const mapTable = [
    '',
    '<!-- @section: map | v:1 | deps:[] | status:reference -->',
    '## Section Map',
    '',
    '| ID | Section | Deps | Status |',
    '|---|---|---|---|',
    ...mapRows,
    '',
    '---',
    '',
  ].join('\n');

  // Insert markers before each ## heading
  const newLines = [];
  let mapInserted = false;

  for (let i = 0; i < lines.length; i++) {
    // Insert map after the first --- (after header)
    if (!mapInserted && lines[i].trim() === '---' && i > 3) {
      newLines.push(lines[i]);
      newLines.push(mapTable);
      mapInserted = true;
      continue;
    }

    // Check if this line is a ## heading
    const headingMatch = lines[i].match(/^##\s+(.+)/);
    if (headingMatch && !lines[i].startsWith('###')) {
      const slug = slugify(headingMatch[1]);
      // Don't add marker if previous line is already a marker
      if (i > 0 && lines[i - 1].includes('@section:')) {
        newLines.push(lines[i]);
        continue;
      }
      newLines.push(`<!-- @section: ${slug} | v:1 | deps:[] | status:validated -->`);
    }
    newLines.push(lines[i]);
  }

  const newContent = newLines.join('\n');

  if (opts.dryRun) {
    // Count markers added
    const markerCount = (newContent.match(/@section:/g) || []).length;
    console.log(`Would add ${markerCount} section markers to mission ${shortId}`);
    console.log('Section IDs:');
    h2Headings.forEach(h => console.log(`  ${h.slug}`));
    console.log('\nRun without --dry-run to apply.');
  } else {
    db.prepare('UPDATE missions SET content_md = ?, content_version = content_version + 1, updated_at = datetime(?) WHERE short_id = ?')
      .run(newContent, new Date().toISOString(), shortId);
    const markerCount = (newContent.match(/@section:/g) || []).length;
    console.log(`Added ${markerCount} section markers to mission ${shortId}`);
    console.log(`Content version: ${(m.content_version || 0) + 1}`);
  }

  db.close();
}

/**
 * cmd: verify — Check all cross-mission deep links resolve
 */
function cmdVerify(shortId) {
  const db = openDb();
  const m = getMission(db, shortId);
  if (!m) { console.error('Mission not found:', shortId); process.exit(1); }

  const content = m.content_md || '';

  // Find all deep links: [text](/m/shortId#anchor)
  const linkPattern = /\[([^\]]+)\]\(\/m\/([^#)]+)#?([^)]*)\)/g;
  const links = [];
  let match;
  while ((match = linkPattern.exec(content)) !== null) {
    links.push({ text: match[1], targetMission: match[2], anchor: match[3] || null });
  }

  if (links.length === 0) {
    console.log(`No cross-mission links found in ${shortId}`);
    db.close();
    return;
  }

  console.log(`Verifying ${links.length} cross-mission links from ${shortId}:\n`);

  let ok = 0;
  let fail = 0;

  // Group by target mission
  const byMission = {};
  links.forEach(l => {
    if (!byMission[l.targetMission]) byMission[l.targetMission] = [];
    byMission[l.targetMission].push(l);
  });

  for (const [targetId, missionLinks] of Object.entries(byMission)) {
    const target = getMission(db, targetId);
    if (!target) {
      console.log(`FAIL  Mission ${targetId} not found`);
      missionLinks.forEach(l => { console.log(`  ✗ ${l.text}`); fail++; });
      continue;
    }

    // Get all heading slugs from target
    const headings = parseHeadings(target.content_md || '');
    const slugSet = new Set(headings.map(h => h.slug));

    missionLinks.forEach(l => {
      if (!l.anchor) {
        console.log(`  OK  ${l.text} → /m/${targetId} (no anchor)`);
        ok++;
      } else if (slugSet.has(l.anchor)) {
        const h = headings.find(h => h.slug === l.anchor);
        console.log(`  OK  ${l.text} → #${l.anchor} (${h.text})`);
        ok++;
      } else {
        console.log(`  FAIL  ${l.text} → #${l.anchor} NOT FOUND`);
        // Suggest closest
        const candidates = headings.filter(h => h.slug.includes(l.anchor.split('-')[0]));
        if (candidates.length) {
          console.log(`        closest: ${candidates[0].slug}`);
        }
        fail++;
      }
    });
  }

  console.log(`\n${ok} OK, ${fail} FAIL`);
  db.close();
}

// --- Main ---
const [,, command, ...args] = process.argv;

switch (command) {
  case 'list':
    cmdList(args[0]);
    break;
  case 'extract':
    cmdExtract(args[0], args[1]);
    break;
  case 'transform':
    cmdTransform(args[0], {
      force: args.includes('--force'),
      dryRun: args.includes('--dry-run'),
    });
    break;
  case 'verify':
    cmdVerify(args[0]);
    break;
  default:
    console.log(`Usage:
  mission-nav list <short_id>                  List sections with status/deps
  mission-nav extract <short_id> <section_id>  Extract one section by ID
  mission-nav transform <short_id> [--dry-run] [--force]  Add section markers
  mission-nav verify <short_id>                Verify all cross-mission links`);
}
