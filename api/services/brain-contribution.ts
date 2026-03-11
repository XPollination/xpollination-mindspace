/**
 * Brain contribution service.
 * Auto-contributes task completion summaries to the org brain.
 * Best-effort: never throws, logs warnings on failure.
 */

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

/**
 * Contribute a task completion thought to the org brain.
 * Called after a task transitions to 'complete'.
 */
export async function contributeTaskCompletion(
  task: { id: string; title: string; current_role?: string },
  projectSlug: string
): Promise<void> {
  try {
    const prompt = `Task "${task.title}" completed in project ${projectSlug}. Task ID: ${task.id}.`;

    const response = await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRAIN_API_KEY}`
      },
      body: JSON.stringify({
        prompt,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        context: `task: ${task.id}`,
        thought_category: 'task_completion',
        topic: projectSlug
      })
    });

    if (!response.ok) {
      console.warn(`[brain-contribution] Failed to contribute: ${response.status}`);
    }
  } catch (err) {
    console.warn(`[brain-contribution] Error contributing task completion: ${err}`);
  }
}
