import { isAcceptedCoach } from '../controllers/coachController.js';

// For list/create style routes where there's no existing resource to check
// ownership against yet. When a coach passes ?athleteId=/{athleteId} in the
// body and has an accepted relationship with that athlete, requests operate
// on the athlete's data instead of the coach's own.
export async function resolveTargetUser(req, res, next) {
  const athleteId = req.query.athleteId || req.body?.athleteId;

  if (!athleteId || athleteId === req.userId) {
    req.targetUserId = req.userId;
    req.actingAsCoach = false;
    return next();
  }

  const allowed = await isAcceptedCoach(req.userId, athleteId);
  if (!allowed) {
    return res.status(403).json({ error: 'You are not an accepted coach for that athlete' });
  }

  req.targetUserId = athleteId;
  req.actingAsCoach = true;
  next();
}
