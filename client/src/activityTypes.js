// Specific activity types grouped by category, similar to Garmin Connect's
// activity type picker. Each type maps to one of the broad `sport` enum
// buckets the backend stores (swim/bike/run/strength/other) so no schema
// change is needed — the specific label is kept in workouts.details.activityType.

export const ACTIVITY_CATEGORIES = [
  {
    name: 'Running',
    sport: 'run',
    types: ['Run', 'Trail Run', 'Track Run', 'Treadmill Run', 'Ultra Run'],
  },
  {
    name: 'Cycling',
    sport: 'bike',
    types: ['Bike', 'Indoor Cycling', 'Mountain Biking', 'Gravel Cycling', 'Track Cycling'],
  },
  {
    name: 'Swimming',
    sport: 'swim',
    types: ['Pool Swim', 'Open Water Swim'],
  },
  {
    name: 'Multisport',
    sport: 'other',
    types: ['Triathlon', 'Duathlon', 'Aquathlon', 'Brick Workout'],
  },
  {
    name: 'Fitness Equipment',
    sport: 'strength',
    types: [
      'Strength Training',
      'Yoga',
      'Pilates',
      'HIIT',
      'Cardio',
      'Elliptical',
      'Indoor Rowing',
      'Stair Stepper',
    ],
  },
  {
    name: 'Water Sports',
    sport: 'other',
    types: ['Rowing', 'Kayaking', 'Stand Up Paddleboarding', 'Surfing'],
  },
  {
    name: 'Winter Sports',
    sport: 'other',
    types: ['Cross Country Skiing', 'Alpine Skiing', 'Snowboarding', 'Snowshoeing'],
  },
  {
    name: 'Team & Racket Sports',
    sport: 'other',
    types: ['Soccer', 'Basketball', 'Tennis', 'Pickleball', 'Badminton'],
  },
  {
    name: 'Outdoor',
    sport: 'other',
    types: ['Walking', 'Hiking'],
  },
];
