# Server

Express API for the training log app.

## Setup

```bash
cp .env.example .env
# edit .env — set DATABASE_URL to a local Postgres instance
npm install
npm run migrate
npm run dev
```

Server runs on `http://localhost:4000` by default. Health check: `GET /api/health`.

## API

### Auth (`/api/auth`)
- `POST /signup` — `{ email, password, displayName }`
- `POST /login` — `{ email, password }`
- `POST /logout`
- `GET /me` — current user (requires session cookie)

### Workouts (`/api/workouts`) — all require auth
- `GET /?start=YYYY-MM-DD&end=YYYY-MM-DD` — list, optionally filtered by date range
- `GET /:id`
- `POST /` — `{ sport, title, scheduledDate, notes?, visibility?, plannedDurationSeconds?, details? }`
- `PUT /:id` — full update
- `PATCH /:id/complete` — `{ actualDurationSeconds?, details? }` marks a workout done
- `DELETE /:id`

### Strava (`/api/strava`)
- `GET /connect` — requires auth; redirects to Strava's OAuth consent screen. Trigger with a full-page navigation (`<a href>` / `window.location`), not `fetch`.
- `GET /callback` — Strava redirects here after consent; exchanges the code for tokens and redirects back to `${CLIENT_ORIGIN}/settings?strava=connected|error`.
- `GET /status` — requires auth; `{ connected, athleteId }`
- `POST /sync` — requires auth; pulls activities since the last synced workout (or the last 90 days on first sync), upserts them into `workouts` with `source=strava_synced`, recomputes `training_load`. Returns `{ synced: <count> }`.
- `DELETE /disconnect` — requires auth; clears stored tokens. Previously synced workouts are left alone.

#### Registering a Strava API app

1. Go to https://www.strava.com/settings/api and create an app (you'll need a Strava account — this is a one-time setup step you do yourself, not something to automate).
2. Set **Authorization Callback Domain** to `localhost` for local dev (just the host, no protocol/port/path).
3. Copy the Client ID and Client Secret into `server/.env`:
   ```
   STRAVA_CLIENT_ID=...
   STRAVA_CLIENT_SECRET=...
   STRAVA_REDIRECT_URI=http://localhost:4000/api/strava/callback
   ```
4. For production on Railway, set the callback domain to your deployed host and update `STRAVA_REDIRECT_URI` accordingly.

Access tokens expire after 6 hours; `getValidAccessToken` in `src/services/stravaService.js` refreshes and persists a new one automatically when needed.

### Training load (`/api/training-load`) — requires auth
- `GET /?start=YYYY-MM-DD&end=YYYY-MM-DD` — daily `{ date, tss, ctl, atl, tsb }` rows, computed (not user-entered) — see `src/services/trainingLoad.js`.
