# PDSA: Auto-Contribute to Org Brain on Task Completion

**Task:** ms-a13-4-org-brain-auto
**Status:** Design
**Version:** v0.0.1

## Plan

On task completion in an org project: auto-contribute a summary brain thought to the org brain. Content includes task title, key outcomes from heartbeat data. Private to org (not public brain).

### Dependencies
- ms-a13-2-brain-routing (brain routing to org collections)
- ms-a3-2-state-machine (transition engine)

### Investigation

**Current transition flow (`api/routes/task-transitions.ts`):**
- After transition to 'complete', calls `checkAndUnblock()`
- No brain contribution hook

**Design decisions:**
1. Hook into task-transitions.ts: after successful transition to 'complete', auto-contribute
2. New service: `contributeTaskCompletion(taskId, projectSlug)`
3. Contribution content: `Task [title] completed. Key outcomes: [from DNA/heartbeat]`
4. Target: org brain collection (not public)
5. Best-effort: brain failure doesn't block completion

## Do

### File Changes

#### 1. `api/services/brain-contribution.ts` (CREATE)
```typescript
const BRAIN_API_URL = process.env.BRAIN_API_URL || 'http://localhost:3200';

export async function contributeTaskCompletion(task: any, projectSlug: string): Promise<void> {
  try {
    const prompt = `Task "${task.title}" completed in project ${projectSlug}. Status: ${task.status}.`;
    await fetch(`${BRAIN_API_URL}/api/v1/memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.BRAIN_API_KEY}` },
      body: JSON.stringify({
        prompt,
        agent_id: 'system',
        agent_name: 'SYSTEM',
        context: `task: ${task.id}`,
        thought_category: 'task_completion',
        topic: projectSlug
      })
    });
  } catch {
    console.warn(`[brain] Failed to contribute task completion for ${task.id}`);
  }
}
```

#### 2. `api/routes/task-transitions.ts` (UPDATE)
After completion transition:
```typescript
if (to_status === 'complete') {
  auto_unblocked = checkAndUnblock(db, taskId);
  contributeTaskCompletion(updatedTask, slug).catch(() => {}); // best-effort
}
```

## Study

### Test Cases (8)
1. Task completion triggers brain contribution
2. Contribution includes task title and project slug
3. Brain failure doesn't block completion transition
4. Non-complete transitions don't trigger contribution
5. Contribution targets org brain (not public)
6. Contribution has thought_category='task_completion'
7. Brain API key used in authorization header
8. agent_id is 'system' for auto-contributions

## Act
- 1 new service, 1 route update
- Best-effort integration, no blocking
