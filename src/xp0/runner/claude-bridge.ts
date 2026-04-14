import { execFile, spawn } from 'node:child_process';

interface ClaudeBridgeOpts {
  binary: string;
  env?: Record<string, string>;
  timeout?: number;
}

export class ClaudeBridge {
  private binary: string;
  private env: Record<string, string>;
  private timeout: number;
  private isNodeScript: boolean;

  constructor(opts: ClaudeBridgeOpts) {
    this.binary = opts.binary;
    this.env = opts.env || {};
    this.timeout = opts.timeout || 300000;
    // Real Claude binary is standalone; mock-claude is a .js/.ts file needing node
    this.isNodeScript = opts.binary.endsWith('.js') || opts.binary.endsWith('.ts');
  }

  private getCommand(): [string, string[]] {
    if (this.isNodeScript) {
      return ['node', [this.binary]];
    }
    return [this.binary, []];
  }

  execute(prompt: string): Promise<string> {
    const [cmd, baseArgs] = this.getCommand();
    const args = [...baseArgs, '--print', '-p', prompt];
    return new Promise((resolve, reject) => {
      execFile(
        cmd,
        args,
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

  executeStreaming(prompt: string, onChunk: (chunk: string) => void): Promise<string> {
    const [cmd, baseArgs] = this.getCommand();
    const args = [...baseArgs, '--print', '-p', prompt];
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        env: { ...process.env, ...this.env },
      });
      let output = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Claude bridge timed out after ${this.timeout}ms`));
      }, this.timeout);

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        onChunk(text);
      });
      child.stderr.on('data', () => {}); // drain stderr
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error(`Claude exited with code ${code}`));
        else resolve(output.trim());
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
