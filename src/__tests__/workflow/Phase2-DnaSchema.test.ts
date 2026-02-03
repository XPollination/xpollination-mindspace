/**
 * Phase 2: DNA Schema - Test Cases TC-5 to TC-7
 *
 * Tests for DNA validation, storage, and link resolution.
 * PDSA ref: 2026-02-03-UTC-0835.requirements-to-code-traceability-architecture.pdsa.md
 *
 * TC-5: DNA Fields Stored in mindspace_nodes (6 tests)
 * TC-6: DNA JSON Validates Against Schema (10 tests)
 * TC-7: DNA Links (Traceability) Resolve Correctly (10 tests)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import modules under test
import {
  validateJsonSyntax,
  validateDna,
  validateDnaSchema,
  parseDna,
  type TaskDna,
  type GroupDna,
  type DecisionDna,
  type RequirementDna,
  type DesignDna,
  type TestDna
} from '../../workflow/mindspace/DnaValidator.js';

import {
  extractLinks,
  resolveLinks,
  checkCircularDependencies,
  getTransitiveDependencies,
  getDependents,
  type NodeLookupFn,
  type NodeReference
} from '../../workflow/mindspace/DnaLinkResolver.js';

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
// TC-5: DNA Fields Stored in mindspace_nodes
// =============================================================================

describe('TC-5: DNA Fields Stored in mindspace_nodes', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('TC-5.1: dna_json column exists in schema', () => {
    // Query SQLite schema for mindspace_nodes table
    const tableInfo = db.prepare("PRAGMA table_info(mindspace_nodes)").all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    const dnaColumn = tableInfo.find(col => col.name === 'dna_json');
    expect(dnaColumn).toBeDefined();
    expect(dnaColumn!.type).toBe('TEXT');
  });

  it('TC-5.2: Insert node with DNA - Node created, DNA stored', async () => {
    const dna: TaskDna = {
      title: 'Test Task',
      description: 'A test task for TC-5.2',
      acceptance_criteria: ['Criteria 1', 'Criteria 2'],
      priority: 'high'
    };

    const result = await repo.create({
      id: 'test-node-1',
      type: 'task',
      slug: 'test-task',
      dna
    });

    expect(result.success).toBe(true);
    expect(result.node).toBeDefined();
    expect(result.node!.dna_json).toBeDefined();

    const storedDna = JSON.parse(result.node!.dna_json);
    expect(storedDna.title).toBe('Test Task');
    expect(storedDna.description).toBe('A test task for TC-5.2');
  });

  it('TC-5.3: Retrieve DNA from node - Valid JSON returned', async () => {
    const dna: TaskDna = {
      title: 'Retrievable Task',
      acceptance_criteria: ['AC1']
    };

    await repo.create({
      id: 'retrieve-test',
      type: 'task',
      slug: 'retrieve-task',
      dna
    });

    const retrieved = await repo.findById('retrieve-test');
    expect(retrieved).toBeDefined();

    const parsedDna = repo.getDna<TaskDna>(retrieved!);
    expect(parsedDna.title).toBe('Retrievable Task');
    expect(parsedDna.acceptance_criteria).toEqual(['AC1']);
  });

  it('TC-5.4: Update DNA on existing node - DNA updated', async () => {
    const initialDna: TaskDna = { title: 'Initial Title' };

    await repo.create({
      id: 'update-test',
      type: 'task',
      slug: 'update-task',
      dna: initialDna
    });

    const updatedDna: TaskDna = {
      title: 'Updated Title',
      description: 'Now has a description'
    };

    const updateResult = await repo.update('update-test', { dna: updatedDna });
    expect(updateResult.success).toBe(true);

    const retrieved = await repo.findById('update-test');
    const parsedDna = repo.getDna<TaskDna>(retrieved!);
    expect(parsedDna.title).toBe('Updated Title');
    expect(parsedDna.description).toBe('Now has a description');
  });

  it('TC-5.5: DNA is required - Node creation requires valid DNA', async () => {
    // The schema has dna_json NOT NULL, so we test that validation rejects empty DNA
    const result = validateDna('task', '{}');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DNA requires a non-empty "title" field');
  });

  it('TC-5.6: DNA persists across DB reconnect simulation', async () => {
    const dna: TaskDna = {
      title: 'Persistent Task',
      priority: 'critical'
    };

    await repo.create({
      id: 'persist-test',
      type: 'task',
      slug: 'persist-task',
      dna
    });

    // Simulate reconnect by creating a new repository instance (same in-memory DB)
    const repo2 = new MindspaceNodeRepository(db);
    const retrieved = await repo2.findById('persist-test');

    expect(retrieved).toBeDefined();
    const parsedDna = repo2.getDna<TaskDna>(retrieved!);
    expect(parsedDna.title).toBe('Persistent Task');
    expect(parsedDna.priority).toBe('critical');
  });
});

// =============================================================================
// TC-6: DNA JSON Validates Against Schema
// =============================================================================

describe('TC-6: DNA JSON Validates Against Schema', () => {
  it('TC-6.1: Valid minimal DNA - VALID', () => {
    const dna = '{"title":"Minimal Task"}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('TC-6.2: Valid full TaskDna with all fields - VALID', () => {
    const dna: TaskDna = {
      title: 'Full Task',
      description: 'Complete task with all fields',
      acceptance_criteria: ['AC1', 'AC2', 'AC3'],
      requirement_ref: 'req-123',
      design_ref: 'design-456',
      dependencies: ['dep-1', 'dep-2'],
      assignee: 'developer',
      priority: 'high',
      estimate: '4h'
    };
    const result = validateDna('task', JSON.stringify(dna));
    expect(result.valid).toBe(true);
  });

  it('TC-6.3: Missing title - INVALID', () => {
    const dna = '{"description":"No title here"}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DNA requires a non-empty "title" field');
  });

  it('TC-6.4: Empty title - INVALID', () => {
    const dna = '{"title":""}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DNA requires a non-empty "title" field');
  });

  it('TC-6.5: Whitespace-only title - INVALID', () => {
    const dna = '{"title":"   "}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('DNA requires a non-empty "title" field');
  });

  it('TC-6.6: Invalid priority value - INVALID', () => {
    const dna = '{"title":"Test","priority":"super-urgent"}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('priority'))).toBe(true);
  });

  it('TC-6.7: Invalid JSON syntax - INVALID', () => {
    const dna = '{broken json';
    const result = validateJsonSyntax(dna);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('TC-6.8: Deep nested custom data in valid DNA - VALID', () => {
    // Test that extra fields don't cause validation to fail
    const dna = '{"title":"Test","custom":{"a":{"b":{"c":{"d":1}}}}}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-6.9: Array in acceptance_criteria - VALID', () => {
    const dna = '{"title":"Test","acceptance_criteria":["AC1","AC2","AC3"]}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-6.10: Wrong type for acceptance_criteria (string instead of array) - INVALID', () => {
    const dna = '{"title":"Test","acceptance_criteria":"not an array"}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('acceptance_criteria'))).toBe(true);
  });
});

// =============================================================================
// TC-6 Extended: Type-specific DNA validation
// =============================================================================

describe('TC-6 Extended: Type-specific DNA validation', () => {
  it('GroupDna: Valid children array', () => {
    const dna: GroupDna = {
      title: 'Test Group',
      children: ['child-1', 'child-2']
    };
    const result = validateDnaSchema('group', dna);
    expect(result.valid).toBe(true);
  });

  it('DecisionDna: Valid options and decision', () => {
    const dna: DecisionDna = {
      title: 'Architecture Decision',
      options: ['Option A', 'Option B'],
      decision: 'Option A',
      rationale: 'Better performance'
    };
    const result = validateDnaSchema('decision', dna);
    expect(result.valid).toBe(true);
  });

  it('RequirementDna: Valid with priority', () => {
    const dna: RequirementDna = {
      title: 'User Authentication',
      acceptance_criteria: ['Users can login', 'Users can logout'],
      priority: 'critical'
    };
    const result = validateDnaSchema('requirement', dna);
    expect(result.valid).toBe(true);
  });

  it('DesignDna: Valid with approach and alternatives', () => {
    const dna: DesignDna = {
      title: 'Auth Design',
      requirement_ref: 'req-auth',
      approach: 'JWT tokens',
      alternatives_considered: ['Sessions', 'OAuth']
    };
    const result = validateDnaSchema('design', dna);
    expect(result.valid).toBe(true);
  });

  it('TestDna: Valid test case', () => {
    const dna: TestDna = {
      title: 'Login Test',
      test_type: 'integration',
      steps: ['Open login page', 'Enter credentials', 'Click submit'],
      expected_result: 'User is logged in'
    };
    const result = validateDnaSchema('test', dna);
    expect(result.valid).toBe(true);
  });

  it('TestDna: Invalid test_type - INVALID', () => {
    const dna = {
      title: 'Bad Test',
      test_type: 'unknown-type'
    };
    const result = validateDnaSchema('test', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('test_type'))).toBe(true);
  });
});

// =============================================================================
// TC-7: DNA Links (Traceability) Resolve Correctly
// =============================================================================

describe('TC-7: DNA Links (Traceability) Resolve Correctly', () => {
  // Mock node lookup function
  const mockNodes: Map<string, NodeReference> = new Map();

  const mockLookup: NodeLookupFn = async (nodeId: string) => {
    return mockNodes.get(nodeId) || null;
  };

  beforeEach(() => {
    mockNodes.clear();
    // Setup test nodes
    mockNodes.set('req-42', {
      id: 'req-42',
      type: 'requirement',
      status: 'complete',
      slug: 'auth-requirement'
    });
    mockNodes.set('design-auth', {
      id: 'design-auth',
      type: 'design',
      status: 'complete',
      slug: 'auth-design'
    });
    mockNodes.set('task-impl', {
      id: 'task-impl',
      type: 'task',
      status: 'active',
      slug: 'impl-task'
    });
  });

  it('TC-7.1: Requirement link exists - FOUND', async () => {
    const dna = { title: 'Test', requirement_ref: 'req-42' };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(true);
    expect(result.resolvedLinks).toHaveLength(1);
    expect(result.resolvedLinks[0].targetId).toBe('req-42');
  });

  it('TC-7.2: Requirement link missing - NOT FOUND, ERROR', async () => {
    const dna = { title: 'Test', requirement_ref: 'req-999' };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('TC-7.3: Design link exists - FOUND', async () => {
    const dna = { title: 'Test', design_ref: 'design-auth' };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(true);
    expect(result.resolvedLinks[0].targetNode.type).toBe('design');
  });

  it('TC-7.4: Design link wrong type - ERROR', async () => {
    // Link design_ref to a requirement node (wrong type)
    const dna = { title: 'Test', design_ref: 'req-42' };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('expected one of: design');
  });

  it('TC-7.5: Dependency exists - FOUND', async () => {
    const dna = { title: 'Test', dependencies: ['task-impl'] };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(true);
    expect(result.resolvedLinks[0].field).toBe('dependencies');
  });

  it('TC-7.6: Dependency missing - NOT FOUND, ERROR', async () => {
    const dna = { title: 'Test', dependencies: ['nonexistent-task'] };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('TC-7.7: Multiple dependencies, all exist - FOUND', async () => {
    mockNodes.set('task-2', { id: 'task-2', type: 'task', status: 'pending', slug: 'task-2' });
    const dna = { title: 'Test', dependencies: ['task-impl', 'task-2'] };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(true);
    expect(result.resolvedLinks).toHaveLength(2);
  });

  it('TC-7.8: Multiple dependencies, one missing - PARTIAL ERROR', async () => {
    const dna = { title: 'Test', dependencies: ['task-impl', 'missing-task'] };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(false);
    expect(result.resolvedLinks).toHaveLength(1); // One was found
    expect(result.errors).toHaveLength(1); // One was not
  });

  it('TC-7.9: Null/undefined refs are ignored - VALID', async () => {
    const dna = { title: 'Test', requirement_ref: undefined, dependencies: [] };
    const result = await resolveLinks(dna, mockLookup);
    expect(result.valid).toBe(true);
    expect(result.resolvedLinks).toHaveLength(0);
  });

  it('TC-7.10: Extract links finds all reference fields', () => {
    const dna = {
      title: 'Test',
      requirement_ref: 'req-1',
      design_ref: 'design-1',
      dependencies: ['dep-1', 'dep-2'],
      children: ['child-1']
    };

    const links = extractLinks(dna);
    expect(links.get('requirement_ref')).toEqual(['req-1']);
    expect(links.get('design_ref')).toEqual(['design-1']);
    expect(links.get('dependencies')).toEqual(['dep-1', 'dep-2']);
    expect(links.get('children')).toEqual(['child-1']);
  });
});

// =============================================================================
// TC-7 Extended: Circular dependency detection
// =============================================================================

describe('TC-7 Extended: Circular dependency detection', () => {
  const nodesDna: Map<string, Record<string, unknown>> = new Map();

  const mockLookup: NodeLookupFn = async (nodeId: string) => {
    if (nodesDna.has(nodeId)) {
      return { id: nodeId, type: 'task', status: 'pending', slug: nodeId };
    }
    return null;
  };

  const getDna = async (nodeId: string) => nodesDna.get(nodeId) || null;

  beforeEach(() => {
    nodesDna.clear();
  });

  it('No cycle: A -> B -> C (linear)', async () => {
    nodesDna.set('A', { title: 'A', dependencies: ['B'] });
    nodesDna.set('B', { title: 'B', dependencies: ['C'] });
    nodesDna.set('C', { title: 'C', dependencies: [] });

    const result = await checkCircularDependencies('A', nodesDna.get('A')!, mockLookup, getDna);
    expect(result.hasCycle).toBe(false);
  });

  it('Cycle: A -> B -> A', async () => {
    nodesDna.set('A', { title: 'A', dependencies: ['B'] });
    nodesDna.set('B', { title: 'B', dependencies: ['A'] });

    const result = await checkCircularDependencies('A', nodesDna.get('A')!, mockLookup, getDna);
    expect(result.hasCycle).toBe(true);
    expect(result.path).toBeDefined();
  });

  it('Cycle: A -> B -> C -> A (3-node cycle)', async () => {
    nodesDna.set('A', { title: 'A', dependencies: ['B'] });
    nodesDna.set('B', { title: 'B', dependencies: ['C'] });
    nodesDna.set('C', { title: 'C', dependencies: ['A'] });

    const result = await checkCircularDependencies('A', nodesDna.get('A')!, mockLookup, getDna);
    expect(result.hasCycle).toBe(true);
  });

  it('No dependencies: isolated node', async () => {
    nodesDna.set('A', { title: 'A', dependencies: [] });

    const result = await checkCircularDependencies('A', nodesDna.get('A')!, mockLookup, getDna);
    expect(result.hasCycle).toBe(false);
  });
});

// =============================================================================
// TC-7 Extended: Transitive dependency resolution
// =============================================================================

describe('TC-7 Extended: Transitive dependency resolution', () => {
  const nodesDna: Map<string, Record<string, unknown>> = new Map();

  const mockLookup: NodeLookupFn = async (nodeId: string) => {
    if (nodesDna.has(nodeId)) {
      return { id: nodeId, type: 'task', status: 'pending', slug: nodeId };
    }
    return null;
  };

  const getDna = async (nodeId: string) => nodesDna.get(nodeId) || null;

  beforeEach(() => {
    nodesDna.clear();
  });

  it('Get all transitive dependencies: A -> B -> C, D', async () => {
    nodesDna.set('A', { title: 'A', dependencies: ['B'] });
    nodesDna.set('B', { title: 'B', dependencies: ['C', 'D'] });
    nodesDna.set('C', { title: 'C', dependencies: [] });
    nodesDna.set('D', { title: 'D', dependencies: [] });

    const deps = await getTransitiveDependencies('A', mockLookup, getDna);
    expect(deps.has('B')).toBe(true);
    expect(deps.has('C')).toBe(true);
    expect(deps.has('D')).toBe(true);
    expect(deps.size).toBe(3);
  });

  it('No dependencies returns empty set', async () => {
    nodesDna.set('A', { title: 'A', dependencies: [] });

    const deps = await getTransitiveDependencies('A', mockLookup, getDna);
    expect(deps.size).toBe(0);
  });
});

// =============================================================================
// TC-7 Extended: Reverse dependency lookup (dependents)
// =============================================================================

describe('TC-7 Extended: Reverse dependency lookup', () => {
  it('Get dependents of a node', async () => {
    const allNodes = [
      { id: 'A', dna_json: '{"title":"A","dependencies":["C"]}' },
      { id: 'B', dna_json: '{"title":"B","dependencies":["C"]}' },
      { id: 'C', dna_json: '{"title":"C","dependencies":[]}' }
    ];

    const getAllNodes = async () => allNodes;
    const dependents = await getDependents('C', getAllNodes);

    expect(dependents).toContain('A');
    expect(dependents).toContain('B');
    expect(dependents).toHaveLength(2);
  });

  it('Node with no dependents returns empty array', async () => {
    const allNodes = [
      { id: 'A', dna_json: '{"title":"A","dependencies":[]}' },
      { id: 'B', dna_json: '{"title":"B","dependencies":[]}' }
    ];

    const getAllNodes = async () => allNodes;
    const dependents = await getDependents('A', getAllNodes);

    expect(dependents).toHaveLength(0);
  });
});

// =============================================================================
// Integration: Repository with DNA validation
// =============================================================================

describe('Integration: Repository DNA validation', () => {
  beforeEach(() => {
    db = setupDatabase();
    repo = new MindspaceNodeRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('Repository rejects invalid DNA on create', async () => {
    const result = await repo.create({
      id: 'bad-node',
      type: 'task',
      slug: 'bad-task',
      dna: { title: '', description: 'Empty title' } as TaskDna // Invalid: empty title
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid DNA');
  });

  it('Repository rejects invalid DNA on update', async () => {
    await repo.create({
      id: 'good-node',
      type: 'task',
      slug: 'good-task',
      dna: { title: 'Valid Task' }
    });

    const result = await repo.update('good-node', {
      dna: { title: '', priority: 'invalid' } as unknown as TaskDna
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid DNA');
  });

  it('Repository validates links on create', async () => {
    // Try to create a node with a reference to a non-existent node
    const result = await repo.create({
      id: 'linked-node',
      type: 'task',
      slug: 'linked-task',
      dna: {
        title: 'Task with bad link',
        requirement_ref: 'nonexistent-req'
      } as TaskDna
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid links');
  });

  it('Repository allows valid links on create', async () => {
    // First create the requirement node
    await repo.create({
      id: 'req-node',
      type: 'requirement',
      slug: 'req',
      dna: { title: 'Requirement' } as RequirementDna
    });

    // Then create a task that references it
    const result = await repo.create({
      id: 'task-with-link',
      type: 'task',
      slug: 'task-link',
      dna: {
        title: 'Task with valid link',
        requirement_ref: 'req-node'
      } as TaskDna
    });

    expect(result.success).toBe(true);
  });
});
