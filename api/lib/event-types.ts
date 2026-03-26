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
  DECISION_NEEDED: 'decision_needed',
  DECISION_RESOLVED: 'decision_resolved',
  WORKSPACE_DOCKED: 'workspace_docked',
  WORKSPACE_UNDOCKED: 'workspace_undocked',
  HUMAN_INPUT: 'human_input',
  BRAIN_GATE: 'brain_gate',
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

export function buildDecisionNeeded(decision: any) {
  return {
    decision_id: decision.id,
    task_ref: decision.task_ref,
    mission_ref: decision.mission_ref,
    frame: decision.frame,
    options: decision.options,
    chain_parent_cid: decision.chain_parent_cid,
    requesting_agent: decision.requesting_agent,
    project_slug: decision.project_slug,
    timestamp: new Date().toISOString(),
  };
}

export function buildDecisionResolved(decision: any) {
  return {
    decision_id: decision.id,
    task_ref: decision.task_ref,
    choice: decision.choice,
    reasoning: decision.reasoning,
    resolved_by: decision.resolved_by,
    cid: decision.cid,
    timestamp: new Date().toISOString(),
  };
}

export function buildWorkspaceDocked(workspace: any) {
  return {
    workspace_id: workspace.id,
    user_id: workspace.user_id,
    git_urls: workspace.git_urls,
    agent_sessions: workspace.agent_sessions,
    timestamp: new Date().toISOString(),
  };
}

export function buildBrainGate(taskSlug: string, pendingTransition: any) {
  return {
    task_slug: taskSlug,
    pending_transition: pendingTransition,
    instruction: 'Send BRAIN_CONTRIBUTE with your findings, receive thought_id, then retry TRANSITION with brain_contribution_id in payload',
    timestamp: new Date().toISOString(),
  };
}
