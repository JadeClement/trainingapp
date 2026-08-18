import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { loadPublicUser } from '../services/userView.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

const ACCOUNT_TYPES = ['athlete', 'coach', 'both'];

function issueSession(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.cookie('token', token, COOKIE_OPTIONS);
}

export async function signup(req, res) {
  const { email, password, confirmPassword, firstName, lastName, accountType = 'athlete' } = req.body;

  const trimmedFirst = String(firstName ?? '').trim();
  const trimmedLast = String(lastName ?? '').trim();
  const displayName = `${trimmedFirst} ${trimmedLast}`.trim();

  if (!email || !password || !trimmedFirst || !trimmedLast) {
    return res.status(400).json({ error: 'email, password, first name, and last name are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }
  if (!ACCOUNT_TYPES.includes(accountType)) {
    return res.status(400).json({ error: "accountType must be 'athlete', 'coach', or 'both'" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Coach-only signups land straight in coach mode; athlete and both default
  // to the personal training log, since that's the app's primary surface.
  const initialMode = accountType === 'coach' ? 'coach' : 'personal';

  const client = await pool.connect();
  let userId;
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO users (email, password_hash, display_name, active_mode)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [normalizedEmail, passwordHash, displayName, initialMode]
    );
    userId = result.rows[0].id;

    if (accountType === 'coach' || accountType === 'both') {
      await client.query('INSERT INTO coach_profiles (user_id) VALUES ($1)', [userId]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  issueSession(res, userId);
  res.status(201).json({ user: await loadPublicUser(userId) });
}

export async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  issueSession(res, user.id);
  res.json({ user: await loadPublicUser(user.id) });
}

export async function logout(req, res) {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: undefined });
  res.status(204).end();
}

export async function me(req, res) {
  const user = await loadPublicUser(req.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
}
