import { Router } from 'express';
import { listTrainingLoad } from '../controllers/trainingLoadController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listTrainingLoad));

export default router;
