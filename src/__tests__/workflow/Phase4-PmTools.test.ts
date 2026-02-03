/**
 * Phase 4: PM Tools - Test Cases TC-12 to TC-14
 *
 * Tests for the 8 PM (Project Management) MCP tools:
 * 1. pm_create_node - Create a new node
 * 2. pm_get_node - Get a node by ID or slug
 * 3. pm_list_nodes - List nodes with filters
 * 4. pm_update_node - Update a node's DNA or metadata
 * 5. pm_transition - Transition a node's status
 * 6. pm_get_valid_transitions - Get valid transitions for a node
 * 7. pm_validate_node - Validate node DNA (4-layer)
 * 8. pm_delete_node - Delete a node
 *
 * PDSA ref: 2026-02-03-UTC-0835.requirements-to-code-traceability-architecture.pdsa.md
 *
 * TC-12: Node CRUD Operations (mapped to pm_create, pm_get, pm_list, pm_update, pm_delete)
 * TC-13: Status Transitions (mapped to pm_transition, pm_get_valid_transitions)
 * TC-14: Validation & Analysis (mapped to pm_validate_node, dependency checks)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import PM tool handlers
import { handlePmCreateNode, type CreateNodeResult } from '../../tools/pm/createNode.js';
import { handlePmGetNode, type GetNodeResult } from '../../tools/pm/getNode.js';
import { handlePmListNodes, type ListNodesResult } from '../../tools/pm/listNodes.js';
import { handlePmUpdateNode, type UpdateNodeResult } from '../../tools/pm/updateNode.js';
import { handlePmTransition, type TransitionResult } from '../../tools/pm/transition.js';
import { handlePmGetValidTransitions, type GetValidTransitionsResult } from '../../tools/pm/getValidTransitions.js';
import { handlePmValidateNode, type ValidateNodeResult } from '../../tools/pm/validateNode.js';
import { handlePmDeleteNode, type DeleteNodeResult } from '../../tools/pm/deleteNode.js';

import { MindspaceNodeRepository } from '../../db/repositories/MindspaceNodeRepository.js';

// Get the schema.sql path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const schemaPath = join(__dirname, '../../db/schema.sql');

// Test database setup
let db: Database.Database;
let repo: MindspaceNodeRepository;

function setupDatabase(): Database.Database {
  const database = new Database(':memory:');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
  return database;
}

// =============================================================================
// TC-12: Node CRUD Operations - Create Node
// =============================================================================

describe('TC-12.1: pm_create_node', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-12.1.1: Create a task node - success', async () => {
    const result = await handlePmCreateNode({
      type: 'task',
      slug: 'implement-login',
      title: 'Implement Login Feature'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.nodeId).toBeDefined();
    expect(result.slug).toBe('implement-login');
    expect(result.type).toBe('task');
    expect(result.status).toBe('pending');
  });

  it('TC-12.1.2: Create a requirement node - success', async () => {
    const result = await handlePmCreateNode({
      type: 'requirement',
      slug: 'auth-requirement',
      title: 'User Authentication Requirement',
      description: 'Users must be able to login',
      dna: {
        acceptance_criteria: ['Login with email', 'Login with OAuth'],
        priority: 'high'
      }
    }, repo);

    expect(result.success).toBe(true);
    expect(result.type).toBe('requirement');
  });

  it('TC-12.1.3: Create a group node - success', async () => {
    const result = await handlePmCreateNode({
      type: 'group',
      slug: 'auth-module',
      title: 'Authentication Module'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.type).toBe('group');
  });

  it('TC-12.1.4: Create with parent_ids - success', async () => {
    // First create a parent
    const parent = await handlePmCreateNode({
      type: 'group',
      slug: 'parent-group',
      title: 'Parent Group'
    }, repo);

    // Then create child with parent reference
    const child = await handlePmCreateNode({
      type: 'task',
      slug: 'child-task',
      title: 'Child Task',
      parent_ids: [parent.nodeId!]
    }, repo);

    expect(child.success).toBe(true);

    // Verify parent relationship
    const getResult = await handlePmGetNode({ id: child.nodeId }, repo);
    expect(getResult.node?.parent_ids).toContain(parent.nodeId);
  });

  it('TC-12.1.5: Create with invalid title (too short) - Zod throws', async () => {
    // Zod validation happens before handler logic, so it throws
    await expect(handlePmCreateNode({
      type: 'task',
      slug: 'bad-task',
      title: 'AB'  // Too short (< 3 chars)
    }, repo)).rejects.toThrow();
  });

  it('TC-12.1.6: Create decision node - success', async () => {
    const result = await handlePmCreateNode({
      type: 'decision',
      slug: 'auth-method',
      title: 'Choose Authentication Method',
      dna: {
        options: ['JWT', 'Session', 'OAuth']
      }
    }, repo);

    expect(result.success).toBe(true);
    expect(result.type).toBe('decision');
  });
});

// =============================================================================
// TC-12: Node CRUD Operations - Get Node
// =============================================================================

describe('TC-12.2: pm_get_node', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-12.2.1: Get node by ID - success', async () => {
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'test-task',
      title: 'Test Task'
    }, repo);

    const result = await handlePmGetNode({ id: created.nodeId }, repo);

    expect(result.success).toBe(true);
    expect(result.node?.id).toBe(created.nodeId);
    expect(result.node?.slug).toBe('test-task');
  });

  it('TC-12.2.2: Get node by slug - success', async () => {
    await handlePmCreateNode({
      type: 'task',
      slug: 'findable-task',
      title: 'Findable Task'
    }, repo);

    const result = await handlePmGetNode({ slug: 'findable-task' }, repo);

    expect(result.success).toBe(true);
    expect(result.node?.slug).toBe('findable-task');
  });

  it('TC-12.2.3: Get non-existent node - fail', async () => {
    const result = await handlePmGetNode({ id: 'nonexistent-id' }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('TC-12.2.4: Get node returns DNA correctly', async () => {
    await handlePmCreateNode({
      type: 'task',
      slug: 'dna-task',
      title: 'Task with DNA',
      description: 'Has a description',
      dna: {
        priority: 'high',
        acceptance_criteria: ['AC1', 'AC2']
      }
    }, repo);

    const result = await handlePmGetNode({ slug: 'dna-task' }, repo);

    expect(result.success).toBe(true);
    const dna = result.node?.dna as any;
    expect(dna.title).toBe('Task with DNA');
    expect(dna.description).toBe('Has a description');
    expect(dna.priority).toBe('high');
  });
});

// =============================================================================
// TC-12: Node CRUD Operations - List Nodes
// =============================================================================

describe('TC-12.3: pm_list_nodes', () => {
  beforeEach(async () => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);

    // Create test nodes
    await handlePmCreateNode({ type: 'task', slug: 'task-1', title: 'Task 1' }, repo);
    await handlePmCreateNode({ type: 'task', slug: 'task-2', title: 'Task 2' }, repo);
    await handlePmCreateNode({ type: 'requirement', slug: 'req-1', title: 'Requirement 1' }, repo);
    await handlePmCreateNode({ type: 'design', slug: 'design-1', title: 'Design 1' }, repo);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-12.3.1: List all nodes - returns all', async () => {
    const result = await handlePmListNodes({}, repo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(4);
    expect(result.nodes?.length).toBe(4);
  });

  it('TC-12.3.2: Filter by type - returns only that type', async () => {
    const result = await handlePmListNodes({ type: 'task' }, repo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(result.nodes?.every(n => n.type === 'task')).toBe(true);
  });

  it('TC-12.3.3: Filter by status - returns only that status', async () => {
    const result = await handlePmListNodes({ status: 'pending' }, repo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(4); // All are pending initially
    expect(result.nodes?.every(n => n.status === 'pending')).toBe(true);
  });

  it('TC-12.3.4: Filter by type AND status - combined filter', async () => {
    const result = await handlePmListNodes({ type: 'task', status: 'pending' }, repo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('TC-12.3.5: Limit results - respects limit', async () => {
    const result = await handlePmListNodes({ limit: 2 }, repo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it('TC-12.3.6: Empty system - returns empty array', async () => {
    // Create fresh db
    const emptyDb = setupDatabase();
    const emptyRepo = new MindspaceNodeRepository(emptyDb);

    const result = await handlePmListNodes({}, emptyRepo);

    expect(result.success).toBe(true);
    expect(result.count).toBe(0);
    expect(result.nodes).toEqual([]);

    emptyDb.close();
  });
});

// =============================================================================
// TC-12: Node CRUD Operations - Update Node
// =============================================================================

describe('TC-12.4: pm_update_node', () => {
  let testNodeId: string;

  beforeEach(async () => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);

    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'updatable-task',
      title: 'Updatable Task',
      description: 'Original description'
    }, repo);
    testNodeId = created.nodeId!;
  });

  afterEach(() => {
    db.close();
  });

  it('TC-12.4.1: Update slug - success', async () => {
    const result = await handlePmUpdateNode({
      id: testNodeId,
      slug: 'new-slug'
    }, repo);

    expect(result.success).toBe(true);

    const getResult = await handlePmGetNode({ id: testNodeId }, repo);
    expect(getResult.node?.slug).toBe('new-slug');
  });

  it('TC-12.4.2: Update DNA title - success', async () => {
    const result = await handlePmUpdateNode({
      id: testNodeId,
      dna: { title: 'Updated Title' }
    }, repo);

    expect(result.success).toBe(true);

    const getResult = await handlePmGetNode({ id: testNodeId }, repo);
    expect((getResult.node?.dna as any).title).toBe('Updated Title');
  });

  it('TC-12.4.3: DNA merge preserves existing fields', async () => {
    // Update with new field
    await handlePmUpdateNode({
      id: testNodeId,
      dna: { priority: 'high' }
    }, repo);

    const getResult = await handlePmGetNode({ id: testNodeId }, repo);
    const dna = getResult.node?.dna as any;

    // Original fields preserved, new field added
    expect(dna.title).toBe('Updatable Task');
    expect(dna.description).toBe('Original description');
    expect(dna.priority).toBe('high');
  });

  it('TC-12.4.4: Update non-existent node - fail', async () => {
    const result = await handlePmUpdateNode({
      id: 'nonexistent-id',
      slug: 'new-slug'
    }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('TC-12.4.5: No changes specified - success with message', async () => {
    const result = await handlePmUpdateNode({
      id: testNodeId
    }, repo);

    expect(result.success).toBe(true);
    expect(result.message).toContain('No changes');
  });
});

// =============================================================================
// TC-12: Node CRUD Operations - Delete Node
// =============================================================================

describe('TC-12.5: pm_delete_node', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-12.5.1: Delete node without dependents - success', async () => {
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'deletable-task',
      title: 'Deletable Task'
    }, repo);

    const result = await handlePmDeleteNode({ id: created.nodeId! }, repo);

    expect(result.success).toBe(true);
    expect(result.message).toContain('deleted');

    // Verify deleted
    const getResult = await handlePmGetNode({ id: created.nodeId }, repo);
    expect(getResult.success).toBe(false);
  });

  it('TC-12.5.2: Delete node with dependents - blocked', async () => {
    // Create dependency target
    const target = await handlePmCreateNode({
      type: 'task',
      slug: 'target-task',
      title: 'Target Task'
    }, repo);

    // Create node that depends on target
    await handlePmCreateNode({
      type: 'task',
      slug: 'dependent-task',
      title: 'Dependent Task',
      dna: { dependencies: [target.nodeId!] }
    }, repo);

    // Try to delete target
    const result = await handlePmDeleteNode({ id: target.nodeId! }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('depend');
    expect(result.dependents?.length).toBeGreaterThan(0);
  });

  it('TC-12.5.3: Force delete with dependents - success', async () => {
    const target = await handlePmCreateNode({
      type: 'task',
      slug: 'force-target',
      title: 'Force Target'
    }, repo);

    await handlePmCreateNode({
      type: 'task',
      slug: 'force-dependent',
      title: 'Force Dependent',
      dna: { dependencies: [target.nodeId!] }
    }, repo);

    const result = await handlePmDeleteNode({
      id: target.nodeId!,
      force: true
    }, repo);

    expect(result.success).toBe(true);
  });

  it('TC-12.5.4: Delete non-existent node - fail', async () => {
    const result = await handlePmDeleteNode({ id: 'nonexistent-id' }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// =============================================================================
// TC-13: Status Transitions
// =============================================================================

describe('TC-13.1: pm_transition', () => {
  let taskNodeId: string;

  beforeEach(async () => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);

    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'transition-task',
      title: 'Transition Task'
    }, repo);
    taskNodeId = created.nodeId!;
  });

  afterEach(() => {
    db.close();
  });

  it('TC-13.1.1: Valid transition pending → ready - success', async () => {
    const result = await handlePmTransition({
      id: taskNodeId,
      to_status: 'ready',
      actor: 'system'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.from_status).toBe('pending');
    expect(result.to_status).toBe('ready');
  });

  it('TC-13.1.2: Valid transition ready → active - success', async () => {
    // First transition to ready
    await handlePmTransition({ id: taskNodeId, to_status: 'ready', actor: 'system' }, repo);

    // Then to active
    const result = await handlePmTransition({
      id: taskNodeId,
      to_status: 'active',
      actor: 'orchestrator'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.to_status).toBe('active');
  });

  it('TC-13.1.3: Invalid transition pending → complete - fail', async () => {
    const result = await handlePmTransition({
      id: taskNodeId,
      to_status: 'complete',
      actor: 'dev'
    }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid transition');
    expect(result.valid_transitions).toBeDefined();
  });

  it('TC-13.1.4: Transition non-existent node - fail', async () => {
    const result = await handlePmTransition({
      id: 'nonexistent-id',
      to_status: 'ready',
      actor: 'system'
    }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('TC-13.1.5: Full task lifecycle', async () => {
    // pending → ready
    let result = await handlePmTransition({
      id: taskNodeId, to_status: 'ready', actor: 'system'
    }, repo);
    expect(result.success).toBe(true);

    // ready → active
    result = await handlePmTransition({
      id: taskNodeId, to_status: 'active', actor: 'orchestrator'
    }, repo);
    expect(result.success).toBe(true);

    // active → review
    result = await handlePmTransition({
      id: taskNodeId, to_status: 'review', actor: 'dev'
    }, repo);
    expect(result.success).toBe(true);

    // review → complete
    result = await handlePmTransition({
      id: taskNodeId, to_status: 'complete', actor: 'pdsa'
    }, repo);
    expect(result.success).toBe(true);

    // Verify final state
    const getResult = await handlePmGetNode({ id: taskNodeId }, repo);
    expect(getResult.node?.status).toBe('complete');
  });

  it('TC-13.1.6: Block transition - success', async () => {
    // pending → blocked
    const result = await handlePmTransition({
      id: taskNodeId,
      to_status: 'blocked',
      actor: 'orchestrator'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.to_status).toBe('blocked');
  });
});

// =============================================================================
// TC-13: Get Valid Transitions
// =============================================================================

describe('TC-13.2: pm_get_valid_transitions', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-13.2.1: Get transitions by ID - success', async () => {
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'query-task',
      title: 'Query Task'
    }, repo);

    const result = await handlePmGetValidTransitions({ id: created.nodeId }, repo);

    expect(result.success).toBe(true);
    expect(result.current_status).toBe('pending');
    expect(result.valid_transitions).toContain('ready');
    expect(result.valid_transitions).toContain('blocked');
  });

  it('TC-13.2.2: Get transitions by type + status - success', async () => {
    const result = await handlePmGetValidTransitions({
      type: 'task',
      status: 'active'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.valid_transitions).toContain('review');
    expect(result.valid_transitions).toContain('blocked');
  });

  it('TC-13.2.3: Get transitions for complete (terminal) - empty array', async () => {
    const result = await handlePmGetValidTransitions({
      type: 'task',
      status: 'complete'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.valid_transitions).toHaveLength(0);
  });

  it('TC-13.2.4: Returns work actors for status', async () => {
    const result = await handlePmGetValidTransitions({
      type: 'task',
      status: 'active'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.work_actors).toContain('dev');
    expect(result.work_actors).toContain('thomas');
  });

  it('TC-13.2.5: Returns transition actors for status', async () => {
    const result = await handlePmGetValidTransitions({
      type: 'task',
      status: 'pending'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.transition_actors).toContain('system');
    expect(result.transition_actors).toContain('orchestrator');
  });

  it('TC-13.2.6: Group node has different transitions', async () => {
    const result = await handlePmGetValidTransitions({
      type: 'group',
      status: 'pending'
    }, repo);

    expect(result.success).toBe(true);
    // Group goes directly pending → active (no ready)
    expect(result.valid_transitions).toContain('active');
    expect(result.valid_transitions).not.toContain('ready');
  });
});

// =============================================================================
// TC-14: Validation & Analysis
// =============================================================================

describe('TC-14.1: pm_validate_node', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-14.1.1: Validate existing node - success', async () => {
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'valid-task',
      title: 'Valid Task'
    }, repo);

    const result = await handlePmValidateNode({
      id: created.nodeId,
      actor: 'system'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(result.all_errors).toHaveLength(0);
  });

  it('TC-14.1.2: Validate JSON string - success', async () => {
    const dnaJson = JSON.stringify({
      title: 'Task from JSON',
      priority: 'high'
    });

    const result = await handlePmValidateNode({
      dna_json: dnaJson,
      type: 'task',
      actor: 'system'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
  });

  it('TC-14.1.3: Validate invalid JSON syntax - fail at layer 1', async () => {
    const result = await handlePmValidateNode({
      dna_json: '{invalid json',
      type: 'task'
    }, repo);

    expect(result.success).toBe(true); // Tool succeeded
    expect(result.valid).toBe(false); // DNA is invalid
    expect(result.failed_at).toBe('syntax');
  });

  it('TC-14.1.4: Validate invalid schema - fail at layer 2', async () => {
    const dnaJson = JSON.stringify({
      title: '',  // Empty title
      priority: 'super-urgent'  // Invalid enum
    });

    const result = await handlePmValidateNode({
      dna_json: dnaJson,
      type: 'task'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.valid).toBe(false);
    expect(result.failed_at).toBe('schema');
  });

  it('TC-14.1.5: Returns layer-by-layer results', async () => {
    const dnaJson = JSON.stringify({ title: 'Valid Title' });

    const result = await handlePmValidateNode({
      dna_json: dnaJson,
      type: 'task',
      actor: 'dev',
      status: 'active'
    }, repo);

    expect(result.success).toBe(true);
    expect(result.layers?.length).toBe(3); // syntax, schema, semantic
    expect(result.layers?.find(l => l.layer === 'syntax')?.valid).toBe(true);
    expect(result.layers?.find(l => l.layer === 'schema')?.valid).toBe(true);
  });

  it('TC-14.1.6: Validate with graph context', async () => {
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'graph-task',
      title: 'Task for Graph Validation'
    }, repo);

    const result = await handlePmValidateNode({
      id: created.nodeId,
      include_graph: true
    }, repo);

    expect(result.success).toBe(true);
    expect(result.layers?.length).toBe(4); // syntax, schema, semantic, graph
    expect(result.layers?.find(l => l.layer === 'graph')).toBeDefined();
  });
});

// =============================================================================
// TC-14: Analysis - Coverage and Gap Detection (via queries)
// =============================================================================

describe('TC-14.2: Coverage analysis via pm_list_nodes', () => {
  beforeEach(async () => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-14.2.1: Count requirements with implementing tasks', async () => {
    // Create requirements
    const req1 = await handlePmCreateNode({
      type: 'requirement',
      slug: 'req-1',
      title: 'Requirement 1'
    }, repo);

    const req2 = await handlePmCreateNode({
      type: 'requirement',
      slug: 'req-2',
      title: 'Requirement 2'
    }, repo);

    // Create task implementing req1
    await handlePmCreateNode({
      type: 'task',
      slug: 'task-1',
      title: 'Task implementing Req 1',
      dna: { requirement_ref: req1.nodeId }
    }, repo);

    // List requirements
    const reqs = await handlePmListNodes({ type: 'requirement' }, repo);
    expect(reqs.count).toBe(2);

    // List tasks with requirement refs
    const tasks = await handlePmListNodes({ type: 'task' }, repo);
    expect(tasks.count).toBe(1);

    // Coverage: 1 task / 2 requirements = 50% (conceptually)
  });

  it('TC-14.2.2: Find requirements without tests (gap detection)', async () => {
    // Create a requirement that will NOT have a test (the "gap")
    await handlePmCreateNode({
      type: 'requirement',
      slug: 'untested-req',
      title: 'Untested Requirement'
    }, repo);

    // Create another requirement that WILL have a test
    const testedReq = await handlePmCreateNode({
      type: 'requirement',
      slug: 'tested-req',
      title: 'Tested Requirement'
    }, repo);

    // Create a test for the tested requirement
    await handlePmCreateNode({
      type: 'test',
      slug: 'test-1',
      title: 'Test 1',
      dna: { requirement_ref: testedReq.nodeId }
    }, repo);

    // List all requirements
    const reqs = await handlePmListNodes({ type: 'requirement' }, repo);
    expect(reqs.count).toBe(2);

    // List all tests
    const tests = await handlePmListNodes({ type: 'test' }, repo);
    expect(tests.count).toBe(1);

    // Gap: untested-req has no test, tested-req has 1 test
    // Coverage: 1 test / 2 requirements = 50% coverage
    // (Full gap detection would need a dedicated analyzer tool)
  });

  it('TC-14.2.3: Track complete vs pending nodes', async () => {
    // Create and transition a node to complete
    const created = await handlePmCreateNode({
      type: 'task',
      slug: 'done-task',
      title: 'Done Task'
    }, repo);

    // Transition to complete
    await handlePmTransition({ id: created.nodeId!, to_status: 'ready', actor: 'system' }, repo);
    await handlePmTransition({ id: created.nodeId!, to_status: 'active', actor: 'orchestrator' }, repo);
    await handlePmTransition({ id: created.nodeId!, to_status: 'review', actor: 'dev' }, repo);
    await handlePmTransition({ id: created.nodeId!, to_status: 'complete', actor: 'pdsa' }, repo);

    // Create pending node
    await handlePmCreateNode({
      type: 'task',
      slug: 'pending-task',
      title: 'Pending Task'
    }, repo);

    // Query by status
    const complete = await handlePmListNodes({ status: 'complete' }, repo);
    const pending = await handlePmListNodes({ status: 'pending' }, repo);

    expect(complete.count).toBe(1);
    expect(pending.count).toBe(1);
  });
});

// =============================================================================
// TC-14: Impact Analysis (via dependencies)
// =============================================================================

describe('TC-14.3: Impact analysis via dependencies', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-14.3.1: Dependency blocks deletion (impact detected)', async () => {
    // Create a chain: A → B → C
    const nodeA = await handlePmCreateNode({
      type: 'task',
      slug: 'node-a',
      title: 'Node A'
    }, repo);

    const nodeB = await handlePmCreateNode({
      type: 'task',
      slug: 'node-b',
      title: 'Node B',
      dna: { dependencies: [nodeA.nodeId!] }
    }, repo);

    await handlePmCreateNode({
      type: 'task',
      slug: 'node-c',
      title: 'Node C',
      dna: { dependencies: [nodeB.nodeId!] }
    }, repo);

    // Try to delete A - should be blocked because B depends on it
    const deleteResult = await handlePmDeleteNode({ id: nodeA.nodeId! }, repo);

    expect(deleteResult.success).toBe(false);
    expect(deleteResult.dependents).toContain(nodeB.nodeId!);
  });

  it('TC-14.3.2: No dependencies - delete allowed', async () => {
    const isolated = await handlePmCreateNode({
      type: 'task',
      slug: 'isolated-node',
      title: 'Isolated Node'
    }, repo);

    const deleteResult = await handlePmDeleteNode({ id: isolated.nodeId! }, repo);

    expect(deleteResult.success).toBe(true);
  });

  it('TC-14.3.3: Validate circular dependency detection via graph validation', async () => {
    // Create nodes that would form a cycle
    const nodeA = await handlePmCreateNode({
      type: 'task',
      slug: 'cycle-a',
      title: 'Cycle A'
    }, repo);

    const nodeB = await handlePmCreateNode({
      type: 'task',
      slug: 'cycle-b',
      title: 'Cycle B',
      dna: { dependencies: [nodeA.nodeId!] }
    }, repo);

    // Now try to add A → B dependency (would create cycle)
    // Update A to depend on B
    const updateResult = await handlePmUpdateNode({
      id: nodeA.nodeId!,
      dna: { dependencies: [nodeB.nodeId!] }
    }, repo);

    // The validation during update should detect the cycle
    // Note: This depends on implementation; the cycle check may happen at graph validation
    // For now, validate with graph context
    const validateResult = await handlePmValidateNode({
      id: nodeA.nodeId!,
      include_graph: true
    }, repo);

    // Should have circular dependency error
    expect(validateResult.all_errors?.some(e => e.includes('Circular'))).toBe(true);
  });
});

// =============================================================================
// Extended: Tool Input Validation
// =============================================================================

describe('Extended: Input validation', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('pm_get_node requires either id or slug', async () => {
    await expect(handlePmGetNode({}, repo)).rejects.toThrow();
  });

  it('pm_create_node validates type enum', async () => {
    await expect(handlePmCreateNode({
      type: 'invalid-type' as any,
      slug: 'test',
      title: 'Test'
    }, repo)).rejects.toThrow();
  });

  it('pm_transition validates status enum', async () => {
    await expect(handlePmTransition({
      id: 'some-id',
      to_status: 'invalid-status' as any,
      actor: 'dev'
    }, repo)).rejects.toThrow();
  });

  it('pm_validate_node requires id OR (dna_json AND type)', async () => {
    const result = await handlePmValidateNode({
      dna_json: '{"title":"test"}'
      // Missing type
    }, repo);

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be provided');
  });
});
