import { createLibp2p, type Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { tcp } from '@libp2p/tcp';
import { mdns } from '@libp2p/mdns';
import { identify } from '@libp2p/identify';
import { multiaddr } from '@multiformats/multiaddr';
import { Uint8ArrayList } from 'uint8arraylist';
import type { Twin } from '../twin/types.js';
import type { StorageAdapter } from '../storage/types.js';
import type { TransportAdapter, TransportMessage } from './types.js';

const TWIN_REQUEST_PROTO = '/xp0/twin-request/1.0.0';
const PUBSUB_PROTO = '/xp0/pubsub/1.0.0';

// Static peer registry for bootstrap discovery
const peerRegistry: string[] = [];

interface LibP2PTransportOpts {
  storage: StorageAdapter;
}

interface QueueEntry {
  topic: string;
  msg: TransportMessage;
}

interface PubSubEnvelope {
  topic: string;
  msg: TransportMessage;
}

function toBytes(chunk: any): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk;
  if (typeof chunk.subarray === 'function') return new Uint8Array(chunk.subarray());
  return new Uint8Array(chunk);
}

export class LibP2PTransport implements TransportAdapter {
  private storage: StorageAdapter;
  private node: Libp2p | null = null;
  private subscriptions = new Map<string, ((msg: TransportMessage) => void)[]>();
  private queue: QueueEntry[] = [];

  constructor(opts: LibP2PTransportOpts) {
    this.storage = opts.storage;
  }

  async start(): Promise<void> {
    const storage = this.storage;
    const subs = this.subscriptions;

    this.node = await createLibp2p({
      addresses: { listen: ['/ip4/127.0.0.1/tcp/0'] },
      transports: [tcp()],
      connectionEncrypters: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [mdns()],
      services: { identify: identify() },
    });

    // Handle twin request protocol
    await this.node.handle(TWIN_REQUEST_PROTO, async (stream: any) => {
      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(toBytes(chunk));
        }
        const cid = new TextDecoder().decode(Buffer.concat(chunks));
        const twin = await storage.resolve(cid);
        const response = new TextEncoder().encode(twin ? JSON.stringify(twin) : '');
        stream.sendData(new Uint8ArrayList(response));
        stream.sendCloseWrite();
      } catch {
        try { stream.abort(new Error('handler error')); } catch { /* ignore */ }
      }
    });

    // Handle pubsub protocol (simple flood)
    await this.node.handle(PUBSUB_PROTO, async (stream: any) => {
      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(toBytes(chunk));
        }
        const data = new TextDecoder().decode(Buffer.concat(chunks));
        const envelope = JSON.parse(data) as PubSubEnvelope;
        const callbacks = subs.get(envelope.topic);
        if (callbacks) {
          for (const cb of callbacks) cb(envelope.msg);
        }
      } catch { /* ignore */ }
    });

    await this.node.start();

    // Register our addresses for peer discovery
    const addrs = this.node.getMultiaddrs();
    for (const addr of addrs) {
      peerRegistry.push(addr.toString());
    }

    // Connect to known peers
    const myPeerId = this.node.peerId.toString();
    for (const addrStr of peerRegistry) {
      if (!addrStr.includes(myPeerId)) {
        try {
          await this.node.dial(multiaddr(addrStr));
        } catch { /* ignore */ }
      }
    }

    // Drain offline queue
    setTimeout(() => this.drainQueue().catch(() => {}), 300);
  }

  async stop(): Promise<void> {
    if (this.node) {
      const addrs = this.node.getMultiaddrs().map((a) => a.toString());
      for (const addr of addrs) {
        const idx = peerRegistry.indexOf(addr);
        if (idx !== -1) peerRegistry.splice(idx, 1);
      }
      await this.node.stop();
      this.node = null;
    }
  }

  async subscribe(topic: string, callback: (msg: TransportMessage) => void): Promise<void> {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, []);
    }
    this.subscriptions.get(topic)!.push(callback);
  }

  async publish(topic: string, msg: TransportMessage): Promise<void> {
    if (!this.node) {
      this.enqueue(topic, msg);
      return;
    }
    const envelope: PubSubEnvelope = { topic, msg };
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    const peers = this.node.getPeers();
    for (const peer of peers) {
      try {
        const stream = await this.node.dialProtocol(peer, PUBSUB_PROTO) as any;
        stream.sendData(new Uint8ArrayList(data));
        stream.sendCloseWrite();
      } catch { /* peer might not support protocol */ }
    }
  }

  async requestTwin(cid: string): Promise<Twin | null> {
    if (!this.node) return null;
    const peers = this.node.getPeers();
    for (const peer of peers) {
      try {
        const stream = await this.node.dialProtocol(peer, TWIN_REQUEST_PROTO) as any;
        const cidBytes = new TextEncoder().encode(cid);
        stream.sendData(new Uint8ArrayList(cidBytes));
        stream.sendCloseWrite();
        const chunks: Uint8Array[] = [];
        for await (const chunk of stream) {
          chunks.push(toBytes(chunk));
        }
        const response = new TextDecoder().decode(Buffer.concat(chunks));
        if (response) return JSON.parse(response) as Twin;
      } catch {
        continue;
      }
    }
    return null;
  }

  getConnectedPeers(): string[] {
    if (!this.node) return [];
    return this.node.getPeers().map((p) => p.toString());
  }

  getListenAddresses(): string[] {
    if (!this.node) return [];
    return this.node.getMultiaddrs().map((a) => a.toString());
  }

  enqueue(topic: string, msg: TransportMessage): void {
    this.queue.push({ topic, msg });
  }

  queueSize(): number {
    return this.queue.length;
  }

  private async drainQueue(): Promise<void> {
    const items = [...this.queue];
    this.queue = [];
    for (const item of items) {
      try {
        await this.publish(item.topic, item.msg);
      } catch {
        this.queue.push(item);
      }
    }
  }
}
