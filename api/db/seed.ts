import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './connection.js';

/**
 * Seed initial data: admin user (Thomas), projects, project access, API keys.
 * Idempotent via INSERT OR IGNORE — safe to run multiple times.
 */
export function seed(): void {
  const db = getDb();

  // --- Admin user (Thomas only — test users removed) ---
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
  const password_hash = bcrypt.hashSync(ADMIN_PASSWORD, 12);

  const users = [
    { id: randomUUID(), name: 'Thomas Pichler', email: 'thomas.pichler@xpollination.earth' },
  ];

  for (const user of users) {
    db.prepare(
      'INSERT OR IGNORE INTO users (id, email, name, is_system_admin, password_hash, invite_quota) VALUES (?, ?, ?, 1, ?, 999)'
    ).run(user.id, user.email, user.name, password_hash);
  }

  // Update existing Thomas user if password_hash or invite_quota is missing
  db.prepare(
    'UPDATE users SET password_hash = COALESCE(NULLIF(password_hash, \'\'), ?), invite_quota = 999, is_system_admin = 1 WHERE email = ?'
  ).run(password_hash, 'thomas.pichler@xpollination.earth');

  // Remove test users (cleanup from previous seeds)
  db.prepare('DELETE FROM users WHERE email IN (?, ?, ?)').run(
    'robin@xpollination.dev', 'maria@xpollination.dev', 'test@xpollination.dev'
  );

  // Fetch actual user IDs (may already exist)
  const seedUsers = users.map(u => {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(u.email) as any;
    return { ...u, id: row.id };
  });

  // --- Projects ---
  const projects = [
    { slug: 'xpollination-mindspace', name: 'XPollination Mindspace', description: 'Collaborative intelligence platform' },
    { slug: 'pichler-mindspace', name: 'Pichler Mindspace', description: 'Personal mindspace project' },
  ];

  for (const project of projects) {
    db.prepare(
      'INSERT OR IGNORE INTO projects (id, slug, name, description, created_by) VALUES (?, ?, ?, ?, ?)'
    ).run(randomUUID(), project.slug, project.name, project.description, seedUsers[0].id);
  }

  // --- Project Access (admin role for all seed users on all projects) ---
  for (const user of seedUsers) {
    for (const project of projects) {
      db.prepare(
        'INSERT OR IGNORE INTO project_access (id, user_id, project_slug, role) VALUES (?, ?, ?, ?)'
      ).run(randomUUID(), user.id, project.slug, 'admin');
    }
  }

  // --- API Keys (user keys) ---
  for (const user of seedUsers) {
    const rawKey = `xpo-${randomUUID()}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const result = db.prepare(
      'INSERT OR IGNORE INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), user.id, keyHash, `${user.name} seed key`);

    if (result.changes > 0) {
      console.log(`API key for ${user.name}: ${rawKey}`);
    }
  }

  // --- Agent API Keys (pdsa, dev, qa, liaison) ---
  const agentRoles = ['pdsa', 'dev', 'qa', 'liaison'];
  const thomas = seedUsers[0];
  for (const role of agentRoles) {
    const rawKey = `xpo-agent-${role}-${randomUUID()}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyName = `agent-${role}`;
    const result = db.prepare(
      'INSERT OR IGNORE INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)'
    ).run(randomUUID(), thomas.id, keyHash, keyName);

    if (result.changes > 0) {
      console.log(`Agent API key for ${role}: ${rawKey}`);
    }
  }
}
