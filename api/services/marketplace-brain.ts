/**
 * Marketplace → brain auto-publish service.
 * Contributes marketplace items (announcements/requests) to the public brain.
 * Best-effort: never throws, logs warnings on failure.
 */

const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';
const BRAIN_API_KEY = process.env.BRAIN_API_KEY || '';

/**
 * Contribute a marketplace item to the brain.
 * Called after announcement or request creation.
 */
export async function contributeMarketplaceItem(
  type: string,
  item: { id: string; title: string; description?: string; category?: string },
  projectSlug: string
): Promise<void> {
  try {
    const prompt = `Marketplace ${type}: "${item.title}" in project ${projectSlug}. Category: ${item.category || 'general'}. ${item.description || ''}`;

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
        context: `marketplace: ${item.id}`,
        thought_category: 'marketplace',
        topic: type
      })
    });

    if (!response.ok) {
      console.warn(`[marketplace-brain] Failed to contribute: ${response.status}`);
    }
  } catch (err) {
    console.warn(`[marketplace-brain] Error contributing marketplace item: ${err}`);
  }
}
