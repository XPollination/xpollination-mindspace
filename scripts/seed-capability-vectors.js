#!/usr/bin/env node
/**
 * Seed capability vectors into Brain for semantic discovery.
 * Each of the 9 PLATFORM-001 capabilities gets a rich natural language
 * thought with thought_category=design_decision and topic=capability-seed.
 *
 * Usage: node scripts/seed-capability-vectors.js
 * Requires: BRAIN_API_KEY env var, Brain API running
 */

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'https://hive.xpollination.earth';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY;

if (!BRAIN_API_KEY) {
  console.error('BRAIN_API_KEY env var required');
  process.exit(1);
}

const SESSION_ID = `seed-capability-vectors-${Date.now()}`;

const CAPABILITIES = [
  {
    id: 'cap-auth',
    prompt: 'CAP-AUTH (Authentication): User login, registration, invite management, JWT session handling, role-based access control. Handles who can access the system and what they can do. Keywords: login, JWT, authentication, authorization, session, invite, registration, password, credentials.',
  },
  {
    id: 'cap-task-engine',
    prompt: 'CAP-TASK-ENGINE (Workflow Engine): Task state machine with validated transitions, gates, DNA (task metadata). Manages the lifecycle of work items from creation through review to completion. Keywords: workflow, transition, state machine, task, gate, DNA, status, pipeline.',
  },
  {
    id: 'cap-agent-protocol',
    prompt: 'CAP-AGENT-PROTOCOL (A2A Communication): Agent monitor skill, recovery protocol, working memory, session continuity. Enables agents to wake up, recover state, find work, and collaborate without direct communication. Keywords: agent, recovery, protocol, monitor, A2A, session, continuity, handoff.',
  },
  {
    id: 'cap-foundation',
    prompt: 'CAP-FOUNDATION (Infrastructure): SQLite database with WAL mode, Express API server, systemd deployment, git-based versioning. Core infrastructure that everything else builds on. Keywords: database, deployment, infrastructure, server, SQLite, Express, systemd, git.',
  },
  {
    id: 'cap-quality',
    prompt: 'CAP-QUALITY (QA and Governance): TDD test gates, PDSA review cycles, liaison approval, version bumps. Ensures every change meets quality standards before completion. Keywords: test, review, quality, TDD, PDSA, approval, governance, gate, vitest.',
  },
  {
    id: 'cap-graph',
    prompt: 'CAP-GRAPH (Traversable Context): Hierarchy navigation from mission to capability to requirement to task. Every artifact is a traversable node in a connected graph. Keywords: hierarchy, navigation, graph, traversable, drill-down, context, node, mission, capability, requirement.',
  },
  {
    id: 'cap-viz',
    prompt: 'CAP-VIZ (Dashboard Visualization): Real-time dashboard showing task status, agent activity, hierarchy drill-down views. Visual interface for monitoring and navigating the system. Keywords: dashboard, drill-down, visualization, real-time, status, monitoring, UI, viz.',
  },
  {
    id: 'cap-provenance',
    prompt: 'CAP-PROVENANCE (Authorship Tracking): Contribution records, decision provenance, audit trail. Tracks who did what, when, and why — both human and agent contributions. Keywords: tracking, attribution, provenance, audit, contribution, authorship, history, credit.',
  },
  {
    id: 'cap-token',
    prompt: 'CAP-TOKEN (Token Economics): Fair value distribution based on measured contributions. Incentive alignment through token-based rewards for collaborative outcomes. Keywords: token, value, economics, incentive, distribution, fair, reward, contribution.',
  },
];

async function seedCapability(cap) {
  const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BRAIN_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: cap.prompt,
      agent_id: 'agent-dev',
      agent_name: 'DEV',
      session_id: SESSION_ID,
      context: `capability: ${cap.id}`,
      thought_category: 'design_decision',
      topic: 'capability-seed',
    }),
  });
  const data = await res.json();
  const contributed = data.trace?.thoughts_contributed > 0;
  console.log(`  ${cap.id}: ${contributed ? 'SEEDED' : 'EXISTS (similar thought found)'}`);
  return data;
}

async function verifyQuery(description, expectedKeyword) {
  const res = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BRAIN_API_KEY}`,
    },
    body: JSON.stringify({
      prompt: description,
      agent_id: 'agent-dev',
      agent_name: 'DEV',
      session_id: SESSION_ID,
      read_only: true,
    }),
  });
  const data = await res.json();
  const sources = data.result?.sources || [];
  const found = sources.some(s =>
    s.content_preview?.toLowerCase().includes(expectedKeyword.toLowerCase()) ||
    s.topic === 'capability-seed'
  );
  console.log(`  Query "${description}" → ${found ? 'FOUND' : 'NOT FOUND'} (${expectedKeyword})`);
  return found;
}

async function main() {
  console.log('Seeding 9 capability vectors into Brain...');
  for (const cap of CAPABILITIES) {
    await seedCapability(cap);
  }

  console.log('\nVerifying semantic search...');
  await verifyQuery('I need authentication and login for users', 'cap-auth');
  await verifyQuery('I need task workflow state machine with transitions', 'workflow');

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
