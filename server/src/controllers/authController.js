import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/pool.js';
import { loadPublicUser } from '../services/userView.js';
import { sendMail } from '../services/mail.js';

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

const WEEK_STARTS = ['sunday', 'monday'];

// POST /api/auth/week-start — { weekStartsOn: 'sunday' | 'monday' }
export async function setWeekStart(req, res) {
  const { weekStartsOn } = req.body;
  if (!WEEK_STARTS.includes(weekStartsOn)) {
    return res.status(400).json({ error: "weekStartsOn must be 'sunday' or 'monday'" });
  }

  await pool.query('UPDATE users SET week_starts_on = $1 WHERE id = $2', [weekStartsOn, req.userId]);
  res.json({ user: await loadPublicUser(req.userId) });
}

const RESET_TTL_MS = 60 * 60 * 1000;
const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_MAX = 5;
const forgotAttempts = new Map();
const GENERIC_RESET_MESSAGE =
  "If that email is registered, we've sent a link to reset your password.";

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function appOrigin() {
  return (process.env.APP_ORIGIN || process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(
    /\/$/,
    ''
  );
}

function rateLimitedForgot(email) {
  const now = Date.now();
  const entry = forgotAttempts.get(email);
  if (!entry || entry.resetAt <= now) {
    forgotAttempts.set(email, { count: 1, resetAt: now + FORGOT_WINDOW_MS });
    return false;
  }
  if (entry.count >= FORGOT_MAX) return true;
  entry.count += 1;
  return false;
}

function isUsableResetRow(row) {
  return row && !row.used_at && new Date(row.expires_at).getTime() > Date.now();
}

async function findResetToken(rawToken) {
  const tokenHash = hashResetToken(rawToken);
  const result = await pool.query(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resetEmailCopy(displayName, resetUrl) {
  const firstName = displayName ? displayName.split(' ')[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const text = `${greeting}

We received a request to reset the password for your Training Log account.
This link expires in 1 hour:

${resetUrl}

If you didn't ask for this, you can ignore this email.`;

  const html = `<p>${escapeHtml(greeting)}</p>
<p>We received a request to reset the password for your Training Log account.
This link expires in 1 hour:</p>
<p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>
<p>If you didn't ask for this, you can ignore this email.</p>`;

  return { text, html };
}

// POST /api/auth/forgot-password — { email }
export async function forgotPassword(req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'email is required' });
  }

  if (rateLimitedForgot(email)) {
    return res.status(429).json({ error: 'Too many reset requests. Try again in a few minutes.' });
  }

  const result = await pool.query('SELECT id, email, display_name FROM users WHERE email = $1', [
    email,
  ]);
  const user = result.rows[0];
  if (!user) {
    return res.json({ message: GENERIC_RESET_MESSAGE });
  }

  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = COALESCE(used_at, now())
     WHERE user_id = $1 AND used_at IS NULL`,
    [user.id]
  );
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${appOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { text, html } = resetEmailCopy(user.display_name, resetUrl);

  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your Training Log password',
      text,
      html,
    });
  } catch (err) {
    console.error('Failed to send password reset email', err);
    return res.status(502).json({ error: "Couldn't send the reset email. Try again in a moment." });
  }

  const payload = { message: GENERIC_RESET_MESSAGE };
  if (process.env.NODE_ENV !== 'production') {
    payload.resetUrl = resetUrl;
  }
  res.json(payload);
}

// GET /api/auth/reset-password?token=
export async function validateResetToken(req, res) {
  const token = String(req.query.token || '');
  if (!token) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const row = await findResetToken(token);
  if (!isUsableResetRow(row)) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  res.json({ valid: true });
}

// POST /api/auth/reset-password — { token, password, confirmPassword }
export async function resetPassword(req, res) {
  const { token, password, confirmPassword } = req.body;
  const rawToken = String(token || '');
  if (!rawToken) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'password is required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  const row = await findResetToken(rawToken);
  if (!isUsableResetRow(row)) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const claimed = await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE id = $1 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [row.id]
    );
    if (claimed.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const userId = claimed.rows[0].user_id;
    await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = COALESCE(used_at, now())
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
    await client.query('COMMIT');

    issueSession(res, userId);
    res.json({ user: await loadPublicUser(userId) });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
