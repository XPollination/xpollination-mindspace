# PDSA: Marketplace → Brain Thought Auto-Publish

**Task:** ms-a14-4-marketplace-brain
**Status:** Design
**Version:** v0.0.1

## Plan

Auto-contribute brain thoughts when marketplace announcements or requests are created. Makes marketplace items discoverable via brain queries.

### Dependencies
- ms-a14-1-marketplace-announcements

### Investigation

**Design decisions:**
1. Hook into marketplace POST endpoints (announcements + requests)
2. After successful creation, contribute brain thought with marketplace metadata
3. Target: public brain (not org-private)
4. Best-effort (creation succeeds even if brain fails)
5. Thought content: `Marketplace [announcement/request]: [title]. Tags: [tags]. Project: [project]`

## Do

### File Changes

#### 1. `api/services/marketplace-brain.ts` (CREATE)
```typescript
export async function contributeMarketplaceItem(type: 'announcement' | 'request', item: any, projectSlug: string): Promise<void> {
  try {
    const prompt = `Marketplace ${type}: "${item.title}". Tags: ${item.tags || 'none'}. Project: ${projectSlug}. Description: ${item.description || 'none'}`;
    await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.BRAIN_API_KEY}` },
      body: JSON.stringify({
        prompt,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        context: `marketplace: ${type}`,
        thought_category: 'marketplace',
        topic: projectSlug
      })
    });
  } catch {
    console.warn(`[brain] Failed to contribute marketplace ${type} ${item.id}`);
  }
}
```

#### 2. Marketplace route files (UPDATE)
After POST creation: `contributeMarketplaceItem('announcement', created, slug).catch(() => {});`

## Study

### Test Cases (6)
1. Announcement creation triggers brain contribution
2. Request creation triggers brain contribution
3. Brain failure doesn't block marketplace creation
4. Thought includes title, tags, project
5. thought_category is 'marketplace'
6. Brain query for tags returns marketplace items

## Act
- 1 new service, 2 route updates
