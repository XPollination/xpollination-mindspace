/**
 * BUG_REPORTED broadcast service.
 * Pushes events to connected agents via SSE when bugs are reported.
 */

// SSE clients registry (populated by SSE infra)
const clients: Set<any> = new Set();

export function registerClient(client: any) {
  clients.add(client);
}

export function removeClient(client: any) {
  clients.delete(client);
}

/**
 * Broadcast BUG_REPORTED event to all connected agents.
 * Called when a new bug report is submitted.
 */
export function broadcastBugReported(
  bugId: string,
  project_slug: string,
  title: string,
  severity: string
) {
  const event = {
    type: 'BUG_REPORTED',
    bug_id: bugId,
    project_slug,
    title,
    severity,
    timestamp: new Date().toISOString(),
  };

  for (const client of clients) {
    try {
      if (client.write) {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch {
      clients.delete(client);
    }
  }
}
