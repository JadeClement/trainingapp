import { Router } from 'express';
import { getStats } from '../controllers/statsController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTargetUser } from '../middleware/resolveTargetUser.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(resolveTargetUser), asyncHandler(getStats));

export default router;
