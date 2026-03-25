/**
 * Workspace Isolation — per-user workspace directories
 * Each user gets /workspace/{user_id}/. Theia session scoped to user workspace.
 */
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/home/theia/workspaces';

export function ensureUserWorkspace(userId: string): string {
  const userDir = resolve(WORKSPACE_ROOT, userId);
  if (!existsSync(userDir)) {
    mkdirSync(userDir, { recursive: true, mode: 0o700 });
  }
  return userDir;
}

export function getUserWorkspacePath(userId: string): string {
  return resolve(WORKSPACE_ROOT, userId);
}

export function isPathInUserWorkspace(userId: string, filePath: string): boolean {
  const userDir = resolve(WORKSPACE_ROOT, userId);
  const resolved = resolve(filePath);
  return resolved.startsWith(userDir);
}
