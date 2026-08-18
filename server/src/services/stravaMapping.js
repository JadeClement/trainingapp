// Maps Strava's `sport_type` values to our sport_type enum bucket plus a
// human label, mirroring the categories in client/src/activityTypes.js so
// synced and manually-entered workouts look consistent on the calendar.
const SPORT_TYPE_MAP = {
  Run: { sport: 'run', activityType: 'Run' },
  TrailRun: { sport: 'run', activityType: 'Trail Run' },
  VirtualRun: { sport: 'run', activityType: 'Treadmill Run' },
  Ride: { sport: 'bike', activityType: 'Bike' },
  MountainBikeRide: { sport: 'bike', activityType: 'Mountain Biking' },
  GravelRide: { sport: 'bike', activityType: 'Gravel Cycling' },
  EBikeRide: { sport: 'bike', activityType: 'Bike' },
  EMountainBikeRide: { sport: 'bike', activityType: 'Mountain Biking' },
  VirtualRide: { sport: 'bike', activityType: 'Indoor Cycling' },
  Velomobile: { sport: 'bike', activityType: 'Bike' },
  Swim: { sport: 'swim', activityType: 'Pool Swim' },
  WeightTraining: { sport: 'strength', activityType: 'Strength Training' },
  Yoga: { sport: 'strength', activityType: 'Yoga' },
  Pilates: { sport: 'strength', activityType: 'Pilates' },
  HighIntensityIntervalTraining: { sport: 'strength', activityType: 'HIIT' },
  Crossfit: { sport: 'strength', activityType: 'HIIT' },
  Elliptical: { sport: 'strength', activityType: 'Elliptical' },
  StairStepper: { sport: 'strength', activityType: 'Stair Stepper' },
  Rowing: { sport: 'strength', activityType: 'Indoor Rowing' },
  VirtualRow: { sport: 'strength', activityType: 'Indoor Rowing' },
  Workout: { sport: 'strength', activityType: 'Cardio' },
  Training: { sport: 'strength', activityType: 'Cardio' },
  Walk: { sport: 'other', activityType: 'Walking' },
  Hike: { sport: 'other', activityType: 'Hiking' },
  Kayaking: { sport: 'other', activityType: 'Kayaking' },
  StandUpPaddling: { sport: 'other', activityType: 'Stand Up Paddleboarding' },
  Surfing: { sport: 'other', activityType: 'Surfing' },
  Canoeing: { sport: 'other', activityType: 'Kayaking' },
  NordicSki: { sport: 'other', activityType: 'Cross Country Skiing' },
  AlpineSki: { sport: 'other', activityType: 'Alpine Skiing' },
  BackcountrySki: { sport: 'other', activityType: 'Alpine Skiing' },
  Snowboard: { sport: 'other', activityType: 'Snowboarding' },
  Snowshoe: { sport: 'other', activityType: 'Snowshoeing' },
  Soccer: { sport: 'other', activityType: 'Soccer' },
  Tennis: { sport: 'other', activityType: 'Tennis' },
  Pickleball: { sport: 'other', activityType: 'Pickleball' },
  Badminton: { sport: 'other', activityType: 'Badminton' },
};

function humanize(sportType) {
  return sportType.replace(/([a-z])([A-Z])/g, '$1 $2');
}

export function mapStravaSportType(sportType) {
  return SPORT_TYPE_MAP[sportType] || { sport: 'other', activityType: humanize(sportType) };
}

// Keep the athlete's planned distance when a Strava activity is merged onto
// a calendar entry, so week totals can still show done/planned (5 / 20 km).
export function detailsWithPreservedPlan(existing = {}, incoming = {}) {
  const plannedDistance = existing.plannedDistance || existing.distance;
  return {
    ...existing,
    ...incoming,
    ...(plannedDistance && !incoming.plannedDistance ? { plannedDistance } : {}),
  };
}
