/**
 * Workflow SSE event types — self-contained work orders
 * Events carry full context so agents can act without additional queries.
 */

export const EVENT_TYPES = {
  TASK_ASSIGNED: 'task_assigned',
  APPROVAL_NEEDED: 'approval_needed',
  REVIEW_NEEDED: 'review_needed',
  REWORK_NEEDED: 'rework_needed',
  TASK_BLOCKED: 'task_blocked',
  LEASE_WARNING: 'lease_warning',
  LEASE_EXPIRED: 'lease_expired',
} as const;

export function buildTaskAssigned(task: any, dna: any, transitions: any[]) {
  return {
    task_slug: task.slug || task.id,
    task_id: task.id,
    title: task.title || dna?.title,
    role: task.current_role,
    project_slug: task.project_slug,
    dna,
    available_transitions: transitions,
    timestamp: new Date().toISOString(),
  };
}

export function buildApprovalNeeded(task: any, dna: any) {
  return {
    task_slug: task.slug || task.id,
    task_id: task.id,
    title: task.title || dna?.title,
    proposed_design: dna?.proposed_design,
    pdsa_review: dna?.pdsa_review,
    approval_mode: dna?.approval_mode,
    timestamp: new Date().toISOString(),
  };
}

export function buildReviewNeeded(task: any, dna: any, fromRole: string) {
  return {
    task_slug: task.slug || task.id,
    task_id: task.id,
    title: task.title || dna?.title,
    implementation: dna?.implementation,
    from_role: fromRole,
    timestamp: new Date().toISOString(),
  };
}

export function buildReworkNeeded(task: any, dna: any) {
  return {
    task_slug: task.slug || task.id,
    task_id: task.id,
    title: task.title || dna?.title,
    rework_reason: dna?.rework_reason || dna?.liaison_reasoning,
    rework_target_role: dna?.rework_target_role,
    timestamp: new Date().toISOString(),
  };
}

export function buildTaskBlocked(task: any, dna: any) {
  return {
    task_slug: task.slug || task.id,
    task_id: task.id,
    title: task.title || dna?.title,
    blocked_reason: dna?.blocked_reason,
    blocked_from_state: dna?.blocked_from_state,
    timestamp: new Date().toISOString(),
  };
}

export function buildLeaseWarning(taskSlug: string, expiresInSeconds: number) {
  return { task_slug: taskSlug, expires_in_seconds: expiresInSeconds, timestamp: new Date().toISOString() };
}

export function buildLeaseExpired(taskSlug: string, previousHolder: string) {
  return { task_slug: taskSlug, previous_holder: previousHolder, timestamp: new Date().toISOString() };
}
