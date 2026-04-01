/**
 * Node Registry — tracks available MindspaceNode instances for runner placement.
 *
 * Phase A: single local node.
 * Phase B: remote nodes register via A2A, appear in Runner Target dropdown.
 * Phase C: auto-placement by capacity.
 */

export interface NodeInfo {
  nodeId: string;
  label: string;
  location: 'local' | 'remote';
  endpoint?: string;
  lastSeen: Date;
  capacity: { current: number; max: number };
}

export class NodeRegistry {
  private nodes = new Map<string, NodeInfo>();

  registerLocal(label: string): void {
    this.nodes.set('local', {
      nodeId: 'local',
      label,
      location: 'local',
      lastSeen: new Date(),
      capacity: { current: 0, max: 4 },
    });
  }

  // Phase B: remote nodes announce themselves
  registerRemote(nodeId: string, label: string, endpoint: string, max = 4): void {
    this.nodes.set(nodeId, {
      nodeId,
      label,
      location: 'remote',
      endpoint,
      lastSeen: new Date(),
      capacity: { current: 0, max },
    });
  }

  getNodes(): NodeInfo[] {
    return [...this.nodes.values()];
  }

  getNode(id: string): NodeInfo | undefined {
    return this.nodes.get(id);
  }

  updateCapacity(id: string, current: number): void {
    const node = this.nodes.get(id);
    if (node) {
      node.capacity.current = current;
      node.lastSeen = new Date();
    }
  }

  unregister(id: string): void {
    this.nodes.delete(id);
  }
}

export const nodeRegistry = new NodeRegistry();
