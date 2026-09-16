import { Router } from 'express';
import { listRaces, createRace, updateRace, deleteRace } from '../controllers/racesController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveTargetUser } from '../middleware/resolveTargetUser.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(resolveTargetUser), asyncHandler(listRaces));
router.post('/', asyncHandler(resolveTargetUser), asyncHandler(createRace));
router.put('/:id', asyncHandler(resolveTargetUser), asyncHandler(updateRace));
router.delete('/:id', asyncHandler(resolveTargetUser), asyncHandler(deleteRace));

export default router;
