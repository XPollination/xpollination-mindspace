#!/usr/bin/env node
/**
 * Bootstrap admin user — bypasses invite requirement.
 * Usage: node api/scripts/create-admin.js <email> <password> [name]
 */

import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [,, email, password, name = 'Admin'] = process.argv;

if (!email || !password) {
  console.error('Usage: node api/scripts/create-admin.js <email> <password> [name]');
  process.exit(1);
}

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'xpollination.db');
const db = new Database(dbPath);

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
if (existing) {
  console.error(`User with email ${email} already exists`);
  process.exit(1);
}

const id = randomUUID();
const password_hash = bcrypt.hashSync(password, 12);

db.prepare('INSERT INTO users (id, email, password_hash, name, is_system_admin, invite_quota) VALUES (?, ?, ?, ?, 1, 999)').run(id, email, password_hash, name);

console.log(`Admin user created: ${email} (id: ${id}, is_system_admin = 1, invite_quota = 999)`);
db.close();
