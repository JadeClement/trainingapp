import { Router } from 'express';
import { listZones, upsertZone, deleteZone } from '../controllers/heartRateZonesController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listZones));
router.post('/', asyncHandler(upsertZone));
router.delete('/:sport', asyncHandler(deleteZone));

export default router;
