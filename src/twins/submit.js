// Submit protocol — format and send A2A messages

export async function submitCreate(twin, agentId) {
  const message = {
    type: 'OBJECT_CREATE',
    agent_id: agentId,
    payload: twin,
    timestamp: new Date().toISOString(),
  };
  return message;
}

export async function submitUpdate(twin, diff, agentId) {
  const message = {
    type: 'OBJECT_UPDATE',
    agent_id: agentId,
    payload: { twin, diff },
    timestamp: new Date().toISOString(),
  };
  return message;
}
