/**
 * Terminal Manager — tmux session lifecycle for Agent Experience
 * Agents run in persistent tmux sessions. Browser connects via WebSocket.
 * Sessions survive browser disconnects — tmux keeps running server-side.
 */

import { execFileSync, execFile } from 'node:child_process';

export interface TerminalSession {
  name: string;
  created: string;
  attached: boolean;
  width: number;
  height: number;
}

export function createSession(sessionName: string, command?: string): { name: string } {
  const args = ['new-session', '-d', '-s', sessionName, '-x', '120', '-y', '40'];
  if (command) args.push(command);
  try {
    execFileSync('tmux', args, { stdio: 'pipe' });
  } catch (err: any) {
    // Session may already exist
    if (err.stderr?.toString().includes('duplicate session')) {
      return { name: sessionName };
    }
    throw err;
  }
  return { name: sessionName };
}

export function listSessions(): TerminalSession[] {
  try {
    const out = execFileSync('tmux', ['list-sessions', '-F', '#{session_name}\t#{session_created}\t#{session_attached}\t#{session_width}\t#{session_height}'], { stdio: 'pipe' }).toString().trim();
    if (!out) return [];
    return out.split('\n').map(line => {
      const [name, created, attached, width, height] = line.split('\t');
      return { name, created, attached: attached === '1', width: parseInt(width) || 120, height: parseInt(height) || 40 };
    });
  } catch {
    return [];
  }
}

export function sessionExists(sessionName: string): boolean {
  try {
    execFileSync('tmux', ['has-session', '-t', sessionName], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function killSession(sessionName: string): boolean {
  try {
    execFileSync('tmux', ['kill-session', '-t', sessionName], { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function sendKeys(sessionName: string, keys: string): void {
  execFileSync('tmux', ['send-keys', '-t', sessionName, keys, 'Enter'], { stdio: 'pipe' });
}

export function resizeSession(sessionName: string, cols: number, rows: number): void {
  try {
    execFileSync('tmux', ['resize-window', '-t', sessionName, '-x', String(cols), '-y', String(rows)], { stdio: 'pipe' });
  } catch { /* ignore resize errors */ }
}
