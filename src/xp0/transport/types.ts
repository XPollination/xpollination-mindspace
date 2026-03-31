import type { Twin } from '../twin/types.js';

export interface TransportMessage {
  type: string;
  cid: string;
  kind: string;
}

export interface TransportAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  subscribe(topic: string, callback: (msg: TransportMessage) => void): Promise<void>;
  publish(topic: string, msg: TransportMessage): Promise<void>;
  requestTwin(cid: string): Promise<Twin | null>;
  getConnectedPeers(): string[];
  enqueue(topic: string, msg: TransportMessage): void;
  queueSize(): number;
}
