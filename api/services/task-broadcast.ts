/**
 * TASK_AVAILABLE broadcast service.
 * Pushes events to connected agents via SSE when tasks become available.
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
 * Broadcast TASK_AVAILABLE event to all connected agents.
 * Called when a task becomes available (unblocked, unclaimed, or re-entered pool).
 */
export function broadcastTaskAvailable(
  taskId: string,
  project_slug: string,
  role: string,
  title?: string
) {
  const event = {
    type: 'TASK_AVAILABLE',
    task_id: taskId,
    project_slug,
    role,
    title: title || null,
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
