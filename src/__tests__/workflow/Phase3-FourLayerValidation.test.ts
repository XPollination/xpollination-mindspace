/**
 * Phase 3: 4-Layer DNA Validation - Test Cases TC-8 to TC-11
 *
 * Tests for the 4-layer validation pipeline:
 * 1. Layer 1 - Syntax: Is the JSON valid?
 * 2. Layer 2 - Schema: Does it match DNA structure?
 * 3. Layer 3 - Semantic: Do values make sense?
 * 4. Layer 4 - Graph: Is the DAG structure valid?
 *
 * PDSA ref: 2026-02-03-UTC-0835.requirements-to-code-traceability-architecture.pdsa.md
 *
 * TC-8: Layer 1 - JSON Syntax Validation (8 tests)
 * TC-9: Layer 2 - Schema Validation (10 tests)
 * TC-10: Layer 3 - Semantic Validation (10 tests)
 * TC-11: Layer 4 - Graph Integrity (10 tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Layer 1 & 2
import {
  validateJsonSyntax,
  validateDnaSchema,
  validateDna,
  type TaskDna,
  type DecisionDna,
  type TestDna,
  type RequirementDna
} from '../../workflow/mindspace/DnaValidator.js';

// Layer 3
import {
  validateSemantics,
  validateTransitionSemantics,
  type SemanticValidationContext
} from '../../workflow/mindspace/DnaSemanticValidator.js';

// Layer 4
import {
  validateNodeInGraph,
  validateGraphStructure,
  wouldCreateCycle,
  getTopologicalOrder,
  type GraphNode,
  type GraphContext
} from '../../workflow/mindspace/DnaGraphValidator.js';

// Unified validation
import {
  validateAll,
  validateQuick,
  validateLayer,
  type FullValidationContext
} from '../../workflow/mindspace/validateAll.js';

import type { NodeType, NodeStatus, Actor } from '../../workflow/StateMachineValidator.js';

// =============================================================================
// TC-8: Layer 1 - JSON Syntax Validation
// =============================================================================

describe('TC-8: Layer 1 - JSON Syntax Validation', () => {
  it('TC-8.1: Valid JSON object - PASS', () => {
    const result = validateJsonSyntax('{"key":"value"}');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('TC-8.2: Valid JSON with nesting - PASS', () => {
    const result = validateJsonSyntax('{"a":{"b":{"c":1}}}');
    expect(result.valid).toBe(true);
  });

  it('TC-8.3: Empty object - PASS (syntax ok)', () => {
    const result = validateJsonSyntax('{}');
    expect(result.valid).toBe(true);
  });

  it('TC-8.4: Missing closing brace - FAIL', () => {
    const result = validateJsonSyntax('{"key":"value"');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('TC-8.5: Unquoted key - FAIL', () => {
    const result = validateJsonSyntax('{key:"value"}');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('TC-8.6: Trailing comma - FAIL', () => {
    const result = validateJsonSyntax('{"a":1,}');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('TC-8.7: Single quotes - FAIL', () => {
    const result = validateJsonSyntax("{'key':'value'}");
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid JSON syntax');
  });

  it('TC-8.8: Null input - PASS (valid JSON literal)', () => {
    // Note: "null" is valid JSON, but our schema validation will fail it
    const result = validateJsonSyntax('null');
    expect(result.valid).toBe(true); // Syntax is valid
  });
});

// =============================================================================
// TC-9: Layer 2 - Schema Validation
// =============================================================================

describe('TC-9: Layer 2 - Schema Validation', () => {
  it('TC-9.1: All required fields present (minimal DNA) - PASS', () => {
    const dna = '{"title":"Test Task"}';
    const result = validateDna('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.2: Title is non-string (number) - FAIL', () => {
    const dna = { title: 123 };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('title'))).toBe(true);
  });

  it('TC-9.3: Description is non-string (number) - FAIL', () => {
    const dna = { title: 'Test', description: 123 };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('description'))).toBe(true);
  });

  it('TC-9.4: Valid node type "task" - PASS', () => {
    const dna = { title: 'Test Task', priority: 'high' };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.5: Invalid priority enum value - FAIL', () => {
    const dna = { title: 'Test', priority: 'super-urgent' };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('priority'))).toBe(true);
  });

  it('TC-9.6: Valid acceptance_criteria array - PASS', () => {
    const dna = { title: 'Test', acceptance_criteria: ['AC1', 'AC2'] };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.7: Valid dependencies array - PASS', () => {
    const dna = { title: 'Test', dependencies: ['dep-1', 'dep-2'] };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.8: Valid test type enum - PASS', () => {
    const dna: TestDna = { title: 'Test', test_type: 'integration' };
    const result = validateDnaSchema('test', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.9: Extra fields allowed (custom data) - PASS', () => {
    const dna = { title: 'Test', custom_field: true, another: 'value' };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(true);
  });

  it('TC-9.10: Deeply nested custom data - PASS', () => {
    const dna = {
      title: 'Test',
      custom: { level1: { level2: { level3: { level4: { level5: 'deep' } } } } }
    };
    const result = validateDnaSchema('task', dna);
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// TC-10: Layer 3 - Semantic Validation
// =============================================================================

describe('TC-10: Layer 3 - Semantic Validation', () => {
  // Note: 'pending' status only allows 'system', 'thomas', 'orchestrator' to work
  // 'active' status allows 'dev', 'pdsa', 'thomas'
  const baseContext: SemanticValidationContext = {
    nodeType: 'task',
    currentStatus: 'active',  // Use 'active' so 'dev' actor is allowed
    actor: 'dev'
  };

  it('TC-10.1: Title uniqueness is handled at repo level (not semantic)', () => {
    // Semantic validation doesn't check uniqueness (that's repo/DB level)
    const dna = { title: 'Test Task' };
    const result = validateSemantics(dna, baseContext);
    expect(result.valid).toBe(true);
  });

  it('TC-10.2: Valid title length (>3 chars) - PASS', () => {
    const dna = { title: 'Valid Title Here' };
    const result = validateSemantics(dna, baseContext);
    expect(result.valid).toBe(true);
  });

  it('TC-10.3: Title too short (<3 chars) - FAIL', () => {
    const dna = { title: 'AB' };
    const result = validateSemantics(dna, baseContext);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('at least 3'))).toBe(true);
  });

  it('TC-10.4: Title too long (>200 chars) - FAIL', () => {
    const dna = { title: 'A'.repeat(201) };
    const result = validateSemantics(dna, baseContext);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('at most 200'))).toBe(true);
  });

  it('TC-10.5: Warning for long title (>100 chars)', () => {
    const dna = { title: 'A'.repeat(120) };
    const result = validateSemantics(dna, baseContext);
    expect(result.valid).toBe(true); // Still valid
    expect(result.warnings.some(w => w.includes('quite long'))).toBe(true);
  });

  it('TC-10.6: Invalid date format - FAIL', () => {
    const dna = { title: 'Decision', decided_at: 'not-a-date' };
    const context: SemanticValidationContext = { ...baseContext, nodeType: 'decision' };
    const result = validateSemantics(dna, context);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('not a valid date'))).toBe(true);
  });

  it('TC-10.7: Future date warning', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();
    const dna = { title: 'Decision', decided_at: futureDate };
    const context: SemanticValidationContext = { ...baseContext, nodeType: 'decision' };
    const result = validateSemantics(dna, context);
    expect(result.warnings.some(w => w.includes('future'))).toBe(true);
  });

  it('TC-10.8: Complete decision requires decision value - FAIL', () => {
    const dna = { title: 'Decision', options: ['A', 'B'] }; // No decision value
    const context: SemanticValidationContext = {
      nodeType: 'decision',
      currentStatus: 'complete',
      actor: 'thomas'
    };
    const result = validateSemantics(dna, context);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('decision'))).toBe(true);
  });

  it('TC-10.9: Complete test requires pass result - FAIL', () => {
    const dna: TestDna = { title: 'Test', steps: ['Step 1'], expected_result: 'Success' };
    const context: SemanticValidationContext = {
      nodeType: 'test',
      currentStatus: 'complete',
      actor: 'qa'
    };
    const result = validateSemantics(dna as unknown as Record<string, unknown>, context);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('pass'))).toBe(true);
  });

  it('TC-10.10: Self-reference is caught at graph level (not semantic)', () => {
    // Semantic validation doesn't check self-reference (that's graph level)
    const dna = { title: 'Task', dependencies: ['self-id'] };
    const result = validateSemantics(dna, baseContext);
    // Semantic validation passes; graph validation would catch self-ref
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// TC-11: Layer 4 - Graph Integrity
// =============================================================================

describe('TC-11: Layer 4 - Graph Integrity', () => {
  let nodes: Map<string, GraphNode>;
  let graphContext: GraphContext;

  beforeEach(() => {
    nodes = new Map();
    graphContext = {
      getAllNodes: async () => Array.from(nodes.values()),
      getNode: async (id) => nodes.get(id) || null,
      rootNodeIds: []
    };
  });

  it('TC-11.1: All nodes properly linked - PASS', async () => {
    nodes.set('root', {
      id: 'root',
      type: 'group',
      parentIds: [],
      dna: { title: 'Root Group', children: ['task-1'] }
    });
    nodes.set('task-1', {
      id: 'task-1',
      type: 'task',
      parentIds: ['root'],
      dna: { title: 'Task 1' }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.valid).toBe(true);
  });

  it('TC-11.2: Orphan node detected - WARNING', async () => {
    nodes.set('root', {
      id: 'root',
      type: 'group',
      parentIds: [],
      dna: { title: 'Root Group', children: [] }
    });
    nodes.set('orphan', {
      id: 'orphan',
      type: 'task',
      parentIds: ['nonexistent'],
      dna: { title: 'Orphan Task' }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.some(e => e.includes('non-existent parent'))).toBe(true);
  });

  it('TC-11.3: No circular dependencies - PASS', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: ['B'] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: ['C'] } });
    nodes.set('C', { id: 'C', type: 'task', parentIds: [], dna: { title: 'C', dependencies: [] } });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.filter(e => e.includes('Circular')).length).toBe(0);
  });

  it('TC-11.4: Circular dependency A→B→A - FAIL', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: ['B'] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: ['A'] } });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
  });

  it('TC-11.5: Deep circular dependency A→B→C→D→A - FAIL', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: ['B'] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: ['C'] } });
    nodes.set('C', { id: 'C', type: 'task', parentIds: [], dna: { title: 'C', dependencies: ['D'] } });
    nodes.set('D', { id: 'D', type: 'task', parentIds: [], dna: { title: 'D', dependencies: ['A'] } });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.some(e => e.includes('Circular'))).toBe(true);
  });

  it('TC-11.6: Group with no children - valid structure', async () => {
    nodes.set('empty-group', {
      id: 'empty-group',
      type: 'group',
      parentIds: [],
      dna: { title: 'Empty Group', children: [] }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.valid).toBe(true);
  });

  it('TC-11.7: Test node with valid type hierarchy', async () => {
    nodes.set('req', {
      id: 'req',
      type: 'requirement',
      parentIds: [],
      dna: { title: 'Requirement' }
    });
    nodes.set('test', {
      id: 'test',
      type: 'test',
      parentIds: ['req'],
      dna: { title: 'Test', requirement_ref: 'req' }
    });

    const node = nodes.get('test')!;
    const result = await validateNodeInGraph(node, graphContext);
    expect(result.valid).toBe(true);
  });

  it('TC-11.8: Consistent bidirectional links (group→child, child→parent)', async () => {
    nodes.set('group', {
      id: 'group',
      type: 'group',
      parentIds: [],
      dna: { title: 'Group', children: ['task'] }
    });
    nodes.set('task', {
      id: 'task',
      type: 'task',
      parentIds: ['group'],
      dna: { title: 'Task' }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.valid).toBe(true);
  });

  it('TC-11.9: Missing child reference - FAIL', async () => {
    nodes.set('group', {
      id: 'group',
      type: 'group',
      parentIds: [],
      dna: { title: 'Group', children: ['nonexistent'] }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.some(e => e.includes('non-existent child'))).toBe(true);
  });

  it('TC-11.10: All dependencies resolve - PASS', async () => {
    nodes.set('task-a', {
      id: 'task-a',
      type: 'task',
      parentIds: [],
      dna: { title: 'Task A' }
    });
    nodes.set('task-b', {
      id: 'task-b',
      type: 'task',
      parentIds: [],
      dna: { title: 'Task B', dependencies: ['task-a'] }
    });

    const result = await validateGraphStructure(graphContext);
    expect(result.errors.filter(e => e.includes('dependency')).length).toBe(0);
  });
});

// =============================================================================
// Extended: Unified 4-Layer Validation
// =============================================================================

describe('Unified validateAll function', () => {
  // Use 'active' status with 'dev' actor (dev can work on active tasks)
  const baseContext: FullValidationContext = {
    nodeId: 'test-node',
    nodeType: 'task',
    currentStatus: 'active',
    actor: 'dev',
    parentIds: []
  };

  it('Valid DNA passes all layers', async () => {
    const dna = JSON.stringify({
      title: 'Valid Task',
      description: 'A valid task for testing',
      priority: 'high'
    });

    const result = await validateAll(dna, baseContext);
    expect(result.valid).toBe(true);
    expect(result.layers.length).toBe(3); // No graph context, so 3 layers
    expect(result.allErrors).toHaveLength(0);
  });

  it('Invalid JSON fails at layer 1', async () => {
    const result = await validateAll('{invalid json', baseContext, {
      stopOnFirstFailure: true
    });

    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('syntax');
    expect(result.layers.length).toBe(1);
  });

  it('Invalid schema fails at layer 2', async () => {
    const dna = JSON.stringify({ title: '' }); // Empty title

    const result = await validateAll(dna, baseContext, {
      stopOnFirstFailure: true
    });

    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('schema');
  });

  it('Invalid semantics fails at layer 3', async () => {
    const dna = JSON.stringify({ title: 'AB' }); // Too short (< 3 chars)

    const result = await validateAll(dna, baseContext);

    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('semantic');
  });

  it('Can skip specific layers', async () => {
    const dna = JSON.stringify({ title: 'AB' }); // Would fail semantic

    const result = await validateAll(dna, baseContext, {
      skipLayers: ['semantic']
    });

    expect(result.valid).toBe(true);
    expect(result.layers.filter(l => l.layer === 'semantic')).toHaveLength(0);
  });

  it('Graph validation runs with context', async () => {
    const nodes = new Map<string, GraphNode>();
    nodes.set('test-node', {
      id: 'test-node',
      type: 'task',
      parentIds: [],
      dna: { title: 'Test', dependencies: ['missing-dep'] }
    });

    const graphContext: GraphContext = {
      getAllNodes: async () => Array.from(nodes.values()),
      getNode: async (id) => nodes.get(id) || null
    };

    const dna = JSON.stringify({ title: 'Test', dependencies: ['missing-dep'] });

    const result = await validateAll(dna, baseContext, { graphContext });

    expect(result.layers.length).toBe(4);
    expect(result.layers.find(l => l.layer === 'graph')).toBeDefined();
    // Should have error about missing dependency
    expect(result.allErrors.some(e => e.includes('not found'))).toBe(true);
  });
});

// =============================================================================
// Extended: Quick Validation (Layers 1-3)
// =============================================================================

describe('validateQuick (synchronous layers 1-3)', () => {
  it('Valid DNA passes quick validation', () => {
    const dna = JSON.stringify({ title: 'Quick Test Task' });
    // Use 'active' status with 'dev' actor
    const result = validateQuick(dna, 'task', 'active', 'dev');
    expect(result.valid).toBe(true);
    expect(result.layers.length).toBe(3);
  });

  it('Invalid JSON fails at syntax', () => {
    const result = validateQuick('{bad', 'task', 'active', 'dev');
    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('syntax');
  });

  it('Complete decision without decision value fails', () => {
    const dna = JSON.stringify({ title: 'Decision' });
    const result = validateQuick(dna, 'decision', 'complete', 'thomas');
    expect(result.valid).toBe(false);
    expect(result.failedAt).toBe('semantic');
  });
});

// =============================================================================
// Extended: Single Layer Validation
// =============================================================================

describe('validateLayer (single layer)', () => {
  // Use 'active' status with 'dev' actor
  const context: FullValidationContext = {
    nodeId: 'test',
    nodeType: 'task',
    currentStatus: 'active',
    actor: 'dev',
    parentIds: []
  };

  it('Validate syntax layer only', async () => {
    const result = await validateLayer('syntax', '{"valid":true}', context);
    expect(result.layer).toBe('syntax');
    expect(result.valid).toBe(true);
  });

  it('Validate schema layer only', async () => {
    const result = await validateLayer('schema', '{"title":"Test"}', context);
    expect(result.layer).toBe('schema');
    expect(result.valid).toBe(true);
  });

  it('Validate semantic layer only', async () => {
    const result = await validateLayer('semantic', '{"title":"Valid Title"}', context);
    expect(result.layer).toBe('semantic');
    expect(result.valid).toBe(true);
  });

  it('Graph layer requires context', async () => {
    const result = await validateLayer('graph', '{"title":"Test"}', context);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Graph context required');
  });
});

// =============================================================================
// Extended: Would Create Cycle Check
// =============================================================================

describe('wouldCreateCycle', () => {
  let nodes: Map<string, GraphNode>;
  let graphContext: GraphContext;

  beforeEach(() => {
    nodes = new Map();
    graphContext = {
      getAllNodes: async () => Array.from(nodes.values()),
      getNode: async (id) => nodes.get(id) || null
    };
  });

  it('Adding safe dependency does not create cycle', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: [] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: [] } });

    const wouldCycle = await wouldCreateCycle('A', 'B', graphContext);
    expect(wouldCycle).toBe(false);
  });

  it('Adding dependency that creates cycle is detected', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: ['B'] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: [] } });

    // B depending on A would create A→B→A cycle
    const wouldCycle = await wouldCreateCycle('B', 'A', graphContext);
    expect(wouldCycle).toBe(true);
  });
});

// =============================================================================
// Extended: Topological Ordering
// =============================================================================

describe('getTopologicalOrder', () => {
  let nodes: Map<string, GraphNode>;
  let graphContext: GraphContext;

  beforeEach(() => {
    nodes = new Map();
    graphContext = {
      getAllNodes: async () => Array.from(nodes.values()),
      getNode: async (id) => nodes.get(id) || null
    };
  });

  it('Linear dependency chain: correct order', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: [] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: ['A'] } });
    nodes.set('C', { id: 'C', type: 'task', parentIds: [], dna: { title: 'C', dependencies: ['B'] } });

    const result = await getTopologicalOrder(graphContext);
    expect(result.hasCycle).toBe(false);
    expect(result.order.indexOf('A')).toBeLessThan(result.order.indexOf('B'));
    expect(result.order.indexOf('B')).toBeLessThan(result.order.indexOf('C'));
  });

  it('Cycle detection via topological sort', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: ['B'] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: ['A'] } });

    const result = await getTopologicalOrder(graphContext);
    expect(result.hasCycle).toBe(true);
    expect(result.order.length).toBeLessThan(2); // Not all nodes in order
  });

  it('Independent nodes have valid order', async () => {
    nodes.set('A', { id: 'A', type: 'task', parentIds: [], dna: { title: 'A', dependencies: [] } });
    nodes.set('B', { id: 'B', type: 'task', parentIds: [], dna: { title: 'B', dependencies: [] } });
    nodes.set('C', { id: 'C', type: 'task', parentIds: [], dna: { title: 'C', dependencies: [] } });

    const result = await getTopologicalOrder(graphContext);
    expect(result.hasCycle).toBe(false);
    expect(result.order.length).toBe(3);
  });
});

// =============================================================================
// Extended: Transition Semantic Validation
// =============================================================================

describe('validateTransitionSemantics', () => {
  it('Valid transition: pending → ready', () => {
    const dna = { title: 'Task' };
    const result = validateTransitionSemantics(dna, 'task', 'pending', 'ready', 'system');
    expect(result.valid).toBe(true);
  });

  it('Invalid transition: pending → complete (skips states)', () => {
    const dna = { title: 'Task' };
    const result = validateTransitionSemantics(dna, 'task', 'pending', 'complete', 'dev');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid transition');
  });

  it('Transition to complete requires decision value for decision nodes', () => {
    const dna = { title: 'Decision', options: ['A', 'B'] }; // No decision
    const result = validateTransitionSemantics(dna, 'decision', 'active', 'complete', 'thomas');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Cannot complete decision'))).toBe(true);
  });

  it('Transition to complete requires pass result for test nodes', () => {
    const dna = { title: 'Test' }; // No pass field
    const result = validateTransitionSemantics(dna, 'test', 'review', 'complete', 'qa');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Cannot complete test'))).toBe(true);
  });
});
