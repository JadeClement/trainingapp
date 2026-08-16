import pool from '../db/pool.js';

const AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_BASE = 'https://www.strava.com/api/v3';

export function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: process.env.STRAVA_REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function requestToken(body) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      ...body,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava token request failed (${res.status}): ${text}`);
  }

  return res.json();
}

export function exchangeCodeForToken(code) {
  return requestToken({ code, grant_type: 'authorization_code' });
}

function refreshToken(refresh_token) {
  return requestToken({ refresh_token, grant_type: 'refresh_token' });
}

// Returns a valid access token for the user, refreshing and persisting it
// first if the stored one has expired (Strava access tokens last 6 hours).
export async function getValidAccessToken(user) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresAt = user.strava_token_expires_at
    ? Math.floor(new Date(user.strava_token_expires_at).getTime() / 1000)
    : 0;

  if (user.strava_access_token && expiresAt > nowSeconds + 60) {
    return user.strava_access_token;
  }

  const tokens = await refreshToken(user.strava_refresh_token);

  await pool.query(
    `UPDATE users SET
       strava_access_token = $1, strava_refresh_token = $2, strava_token_expires_at = to_timestamp($3)
     WHERE id = $4`,
    [tokens.access_token, tokens.refresh_token, tokens.expires_at, user.id]
  );

  return tokens.access_token;
}

// Fetches activities after the given Date, following pagination.
export async function fetchActivities(accessToken, after) {
  const activities = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (after) params.set('after', String(Math.floor(after.getTime() / 1000)));

    const res = await fetch(`${API_BASE}/athlete/activities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Strava activities request failed (${res.status}): ${text}`);
    }

    const batch = await res.json();
    activities.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return activities;
}

const STREAM_KEYS = [
  'time',
  'distance',
  'altitude',
  'heartrate',
  'cadence',
  'watts',
  'velocity_smooth',
  'moving',
  'grade_smooth',
];

// Fetches raw time-series data for one activity. 'medium' resolution keeps
// point counts reasonable for a phone-sized chart without pulling every
// recorded sample — Strava supports low/medium/high/all. Not every key is
// present for every activity (e.g. an indoor trainer ride has no altitude);
// the response simply omits missing ones, which callers must handle.
export async function fetchStreams(accessToken, activityId, resolution = 'medium') {
  const params = new URLSearchParams({
    keys: STREAM_KEYS.join(','),
    key_by_type: 'true',
    resolution,
  });

  const res = await fetch(`${API_BASE}/activities/${activityId}/streams?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return {};

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava streams request failed (${res.status}): ${text}`);
  }

  return res.json();
}

// Fetches an activity's laps (splits the athlete marked, e.g. by pressing lap
// on their watch, or Strava's auto-splits) — a separate endpoint from streams.
export async function fetchLaps(accessToken, activityId) {
  const res = await fetch(`${API_BASE}/activities/${activityId}/laps`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return [];

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Strava laps request failed (${res.status}): ${text}`);
  }

  return res.json();
}
