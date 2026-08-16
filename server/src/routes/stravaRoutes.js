import { Router } from 'express';
import { connect, callback, status, disconnect, sync } from '../controllers/stravaController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/connect', requireAuth, asyncHandler(connect));
router.get('/callback', asyncHandler(callback));
router.get('/status', requireAuth, asyncHandler(status));
router.post('/sync', requireAuth, asyncHandler(sync));
router.delete('/disconnect', requireAuth, asyncHandler(disconnect));

export default router;
