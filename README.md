# Training Log & Coordination App

A training log for endurance athletes (swim/bike/run) that lets you plan and
log workouts — past and future — for free, and (in later phases) lets
close friends coordinate around planned workouts with per-workout privacy
control.

## Status

Phase 1 (MVP): manual workout logging, calendar view, auth. No external
integrations yet.

## Stack

- Frontend: React (Vite)
- Backend: Node.js + Express
- Database: PostgreSQL
- Hosting: Railway
- Auth: email/password + JWT

## Structure

```
server/   Express API
client/   React frontend
```

## Local development

See `server/README.md` for API setup. For the client, `cd client && npm install && npm run dev` — it proxies `/api` to `http://localhost:4000` in dev (see `client/vite.config.js`).

The server also serves the built client as static files in production (see
`server/src/app.js`), so the whole app deploys as a single Railway service —
no cross-origin cookie issues to worry about.

## Deploying to Railway

1. `railway init` (or link an existing project with `railway link`) from the repo root.
2. Add a Postgres database: `railway add` (or via the dashboard) — this sets `DATABASE_URL` automatically on the linked service.
3. Set the remaining env vars on the service (dashboard or `railway variables set`):
   - `JWT_SECRET` — a long random string
   - `NODE_ENV=production`
4. Railway should auto-detect the root `package.json`. Confirm the service's build command is `npm run build` and start command is `npm start`.
5. Deploy: `railway up`.
6. Run migrations against the deployed database once: `railway run npm run migrate`.
7. Confirm `/api/health` responds and the app loads at the Railway-provided domain before starting Phase 2.
