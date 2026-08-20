import { Router } from 'express';
import { listTrainingLoad } from '../controllers/trainingLoadController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTargetUser } from '../middleware/resolveTargetUser.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(resolveTargetUser), asyncHandler(listTrainingLoad));

export default router;
