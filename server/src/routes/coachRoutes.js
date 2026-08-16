import { Router } from 'express';
import {
  createCoachProfile,
  setActiveMode,
  sendAthleteRequest,
  listRelationships,
  acceptAthleteRequest,
  removeRelationship,
} from '../controllers/coachController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.post('/profile', asyncHandler(createCoachProfile));
router.post('/mode', asyncHandler(setActiveMode));

router.get('/relationships', asyncHandler(listRelationships));
router.post('/athletes', asyncHandler(sendAthleteRequest));
router.post('/relationships/:coachId/accept', asyncHandler(acceptAthleteRequest));
router.delete('/relationships/:otherUserId', asyncHandler(removeRelationship));

export default router;
