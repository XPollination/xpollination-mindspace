import { execFile } from 'node:child_process';

interface ClaudeBridgeOpts {
  binary: string;
  env?: Record<string, string>;
  timeout?: number;
}

export class ClaudeBridge {
  private binary: string;
  private env: Record<string, string>;
  private timeout: number;

  constructor(opts: ClaudeBridgeOpts) {
    this.binary = opts.binary;
    this.env = opts.env || {};
    this.timeout = opts.timeout || 300000;
  }

  execute(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(
        'node',
        [this.binary, '--print', '-p', prompt],
        {
          encoding: 'utf-8',
          timeout: this.timeout,
          env: { ...process.env, ...this.env },
        },
        (error, stdout) => {
          if (error) {
            reject(new Error(`Claude bridge failed: ${error.message}`));
            return;
          }
          resolve(stdout.trim());
        },
      );
    });
  }
}
