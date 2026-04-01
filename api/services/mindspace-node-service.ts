/**
 * MindspaceNode Singleton Service
 *
 * Manages a single MindspaceNode instance running in the API process.
 * Provides addRunner/getRunners/terminateRunner for the team API.
 *
 * Phase A: local node, no peers.
 * Phase B: connects to other nodes via libp2p bootstrap peers.
 *
 * Disable with env DISABLE_NODE=1 (for test environments that don't need P2P).
 */

import { resolve } from 'path';
import { mkdirSync } from 'fs';
import { nodeRegistry } from '../lib/node-registry.js';
import { logger } from '../lib/logger.js';

// Dynamic imports to avoid circular deps and allow the service to be optional
let node: any = null;

export async function startNodeService(): Promise<void> {
  if (process.env.DISABLE_NODE === '1') {
    logger.info('MindspaceNode disabled (DISABLE_NODE=1)');
    return;
  }

  try {
    const { MindspaceNode } = await import('../../src/xp0/node/mindspace-node.js');
    const { generateKeyPair, deriveDID } = await import('../../src/xp0/auth/identity.js');

    const storeDir = resolve(process.cwd(), 'data/xp0-store');
    mkdirSync(storeDir, { recursive: true });

    const keys = await generateKeyPair();
    const did = deriveDID(keys.publicKey);

    const claudeBinary = process.env.CLAUDE_BINARY || resolve(process.cwd(), 'dist/src/xp0/test/mock-claude.js');

    node = new MindspaceNode({
      storeDir,
      owner: did,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      listenPort: 0,
      bootstrapPeers: [],
      mockClaudeBinary: claudeBinary,
    });

    await node.start();
    nodeRegistry.registerLocal(process.env.NODE_LABEL || 'Local');
    logger.info({ did, storeDir }, 'MindspaceNode started');
  } catch (err) {
    logger.warn({ err }, 'MindspaceNode failed to start — runners unavailable');
    node = null;
  }
}

export async function stopNodeService(): Promise<void> {
  if (node) {
    try {
      await node.stop();
      logger.info('MindspaceNode stopped');
    } catch (err) {
      logger.warn({ err }, 'MindspaceNode stop error');
    }
    node = null;
  }
}

export function getNode(): any {
  return node;
}
