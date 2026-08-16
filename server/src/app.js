import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import workoutRoutes from './routes/workoutRoutes.js';
import stravaRoutes from './routes/stravaRoutes.js';
import trainingLoadRoutes from './routes/trainingLoadRoutes.js';
import friendsRoutes from './routes/friendsRoutes.js';
import heartRateZonesRoutes from './routes/heartRateZonesRoutes.js';
import coachRoutes from './routes/coachRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '../../client/dist');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/strava', stravaRoutes);
app.use('/api/training-load', trainingLoadRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/heart-rate-zones', heartRateZonesRoutes);
app.use('/api/coach', coachRoutes);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api', notFound);
app.use(errorHandler);

export default app;
