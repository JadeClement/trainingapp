import { Router } from 'express';
import {
  sendRequest,
  listFriends,
  acceptRequest,
  removeFriend,
  listFeed,
  listOverlaps,
  updateOverlap,
} from '../controllers/friendsController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(listFriends));
router.post('/request', asyncHandler(sendRequest));
router.post('/:userId/accept', asyncHandler(acceptRequest));
router.delete('/:userId', asyncHandler(removeFriend));

router.get('/feed', asyncHandler(listFeed));
router.get('/overlaps', asyncHandler(listOverlaps));
router.post('/overlaps/:id/:action', asyncHandler(updateOverlap));

export default router;
