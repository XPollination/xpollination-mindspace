import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/connection.js';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_COST = 12;
const MIN_PASSWORD_LENGTH = 8;

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: 'Missing required fields: email, name, password' });
    return;
  }

  if (!EMAIL_REGEX.test(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }

  const id = randomUUID();
  const password_hash = await bcrypt.hash(password, BCRYPT_COST);

  db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)').run(id, email, password_hash, name);

  res.status(201).json({ id, email, name });
});

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Missing required fields: email, password' });
    return;
  }

  if (!JWT_SECRET) {
    res.status(500).json({ error: 'JWT_SECRET not configured' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email) as any;

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  const { password_hash, ...userWithoutHash } = user;
  res.status(200).json({ token, user: userWithoutHash });
});
