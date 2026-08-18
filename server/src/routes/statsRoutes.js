import { Router } from 'express';
import { getStats } from '../controllers/statsController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(getStats));

export default router;
