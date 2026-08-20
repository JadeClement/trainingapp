import { Router } from 'express';
import {
  listWorkouts,
  getWorkout,
  createWorkout,
  updateWorkout,
  completeWorkout,
  deleteWorkout,
  getWorkoutStreams,
  getWorkoutLaps,
  listLinkCandidates,
  linkStravaActivity,
  unmatchStravaActivity,
} from '../controllers/workoutsController.js';
import { listComments, addComment, deleteComment } from '../controllers/workoutCommentsController.js';
import { requireAuth } from '../middleware/auth.js';
import { resolveTargetUser } from '../middleware/resolveTargetUser.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(resolveTargetUser), asyncHandler(listWorkouts));
router.post('/', asyncHandler(resolveTargetUser), asyncHandler(createWorkout));
router.get('/:id', asyncHandler(getWorkout));
router.get('/:id/streams', asyncHandler(getWorkoutStreams));
router.get('/:id/laps', asyncHandler(getWorkoutLaps));
router.get('/:id/link-candidates', asyncHandler(listLinkCandidates));
router.post('/:id/link-strava', asyncHandler(linkStravaActivity));
router.post('/:id/unmatch', asyncHandler(unmatchStravaActivity));
router.put('/:id', asyncHandler(updateWorkout));
router.patch('/:id/complete', asyncHandler(completeWorkout));
router.delete('/:id', asyncHandler(deleteWorkout));

router.get('/:id/comments', asyncHandler(listComments));
router.post('/:id/comments', asyncHandler(addComment));
router.delete('/:id/comments/:commentId', asyncHandler(deleteComment));

export default router;
