#!/usr/bin/env node

/**
 * Admin Password Reset CLI
 * Usage: node api/scripts/reset-password.js <email> <new-password>
 *
 * Server-side only — no API endpoint. For manual recovery when email is not set up.
 */

import bcrypt from 'bcryptjs';
import { getDb } from '../db/connection.js';

const BCRYPT_COST = 12;

const [,, email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error('Usage: node api/scripts/reset-password.js <email> <new-password>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const db = getDb();

const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email);
if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

const hash = bcrypt.hashSync(newPassword, BCRYPT_COST);
db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);

console.log(`Password reset for ${email} (user: ${user.name})`);
