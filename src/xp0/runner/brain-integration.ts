import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

interface BrainClientOpts {
  apiUrl: string;
  apiKey: string;
  agentId: string;
  agentName: string;
  sessionId: string;
  pendingFile: string;
}

interface PendingEntry {
  prompt: string;
  agent_id: string;
  agent_name: string;
  session_id: string;
  timestamp: string;
}

export class BrainClient {
  private opts: BrainClientOpts;

  constructor(opts: BrainClientOpts) {
    this.opts = {
      ...opts,
      apiKey: process.env.BRAIN_API_KEY || opts.apiKey,
    };
  }

  async queryRecovery(prompt: string): Promise<string | null> {
    try {
      const resp = await fetch(`${this.opts.apiUrl}/api/v1/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          agent_id: this.opts.agentId,
          agent_name: this.opts.agentName,
          session_id: this.opts.sessionId,
          read_only: true,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) return null;
      const data = (await resp.json()) as { result?: { response?: string } };
      return data.result?.response ?? null;
    } catch {
      return null;
    }
  }

  async contribute(prompt: string): Promise<{ success: boolean; savedLocally?: boolean }> {
    try {
      const resp = await fetch(`${this.opts.apiUrl}/api/v1/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.opts.apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          agent_id: this.opts.agentId,
          agent_name: this.opts.agentName,
          session_id: this.opts.sessionId,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) throw new Error(`Brain API error: ${resp.status}`);
      return { success: true };
    } catch {
      // Save locally as fallback
      await this.saveLocally(prompt);
      return { success: false, savedLocally: true };
    }
  }

  async syncPending(): Promise<boolean> {
    const pending = await this.loadPending();
    if (pending.length === 0) return true;

    const remaining: PendingEntry[] = [];
    for (const entry of pending) {
      try {
        const resp = await fetch(`${this.opts.apiUrl}/api/v1/memory`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.opts.apiKey}`,
          },
          body: JSON.stringify({
            prompt: entry.prompt,
            agent_id: entry.agent_id,
            agent_name: entry.agent_name,
            session_id: entry.session_id,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) remaining.push(entry);
      } catch {
        remaining.push(entry);
      }
    }

    await writeFile(this.opts.pendingFile, JSON.stringify(remaining), 'utf-8');
    return remaining.length === 0;
  }

  private async saveLocally(prompt: string): Promise<void> {
    const pending = await this.loadPending();
    pending.push({
      prompt,
      agent_id: this.opts.agentId,
      agent_name: this.opts.agentName,
      session_id: this.opts.sessionId,
      timestamp: new Date().toISOString(),
    });
    await writeFile(this.opts.pendingFile, JSON.stringify(pending), 'utf-8');
  }

  private async loadPending(): Promise<PendingEntry[]> {
    if (!existsSync(this.opts.pendingFile)) return [];
    try {
      const content = await readFile(this.opts.pendingFile, 'utf-8');
      return JSON.parse(content) as PendingEntry[];
    } catch {
      return [];
    }
  }
}
