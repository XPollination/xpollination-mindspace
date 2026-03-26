#!/usr/bin/env node
/**
 * A2A CLI — send A2A messages from command line (replaces interface-cli.js for A2A operations)
 * Usage:
 *   node src/a2a/a2a-cli.js transition <slug> <to_status> [payload_json]
 *   node src/a2a/a2a-cli.js create <object_type> <payload_json>
 *   node src/a2a/a2a-cli.js update <object_type> <object_id> <payload_json>
 *   node src/a2a/a2a-cli.js query <object_type> [filters_json]
 *   node src/a2a/a2a-cli.js brain-query <prompt>
 *   node src/a2a/a2a-cli.js brain-contribute <prompt> [context]
 *   node src/a2a/a2a-cli.js spawn <role>
 *   node src/a2a/a2a-cli.js health
 */

const API_URL = process.env.MINDSPACE_API_URL || 'http://localhost:3100';
const API_KEY = process.env.BRAIN_API_KEY || '';
const AGENT_ID = process.env.AGENT_ID || 'cli-agent';

async function send(type, body = {}) {
  const res = await fetch(`${API_URL}/a2a/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({ type, agent_id: AGENT_ID, ...body }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error(JSON.stringify(data, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function apiCall(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_URL}${path}`, opts);
  const data = await res.json();
  if (!res.ok) { console.error(JSON.stringify(data, null, 2)); process.exit(1); }
  console.log(JSON.stringify(data, null, 2));
  return data;
}

const [,, command, ...rest] = process.argv;

(async () => {
  try {
    switch (command) {
      case 'transition': {
        const [slug, toStatus, payloadJson] = rest;
        if (!slug || !toStatus) { console.error('Usage: transition <slug> <to_status> [payload_json]'); process.exit(1); }
        await send('TRANSITION', { task_slug: slug, to_status: toStatus, payload: payloadJson ? JSON.parse(payloadJson) : undefined });
        break;
      }
      case 'create': {
        const [objectType, payloadJson] = rest;
        if (!objectType || !payloadJson) { console.error('Usage: create <object_type> <payload_json>'); process.exit(1); }
        await send('OBJECT_CREATE', { object_type: objectType, payload: JSON.parse(payloadJson) });
        break;
      }
      case 'update': {
        const [objectType, objectId, payloadJson] = rest;
        if (!objectType || !objectId || !payloadJson) { console.error('Usage: update <object_type> <id> <payload_json>'); process.exit(1); }
        await send('OBJECT_UPDATE', { object_type: objectType, object_id: objectId, payload: JSON.parse(payloadJson) });
        break;
      }
      case 'query': {
        const [objectType, filtersJson] = rest;
        if (!objectType) { console.error('Usage: query <object_type> [filters_json]'); process.exit(1); }
        await send('OBJECT_QUERY', { object_type: objectType, filters: filtersJson ? JSON.parse(filtersJson) : {} });
        break;
      }
      case 'brain-query': {
        const prompt = rest.join(' ');
        if (!prompt) { console.error('Usage: brain-query <prompt>'); process.exit(1); }
        await send('BRAIN_QUERY', { prompt, read_only: true });
        break;
      }
      case 'brain-contribute': {
        const [prompt, ...ctxParts] = rest;
        if (!prompt) { console.error('Usage: brain-contribute <prompt> [context]'); process.exit(1); }
        await send('BRAIN_CONTRIBUTE', { prompt, context: ctxParts.join(' ') || undefined });
        break;
      }
      case 'spawn': {
        const [role] = rest;
        if (!role) { console.error('Usage: spawn <role>'); process.exit(1); }
        await apiCall('POST', '/api/agents/spawn', { role });
        break;
      }
      case 'health':
        await apiCall('GET', '/health');
        break;
      default:
        console.error('Commands: transition, create, update, query, brain-query, brain-contribute, spawn, health');
        process.exit(1);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
