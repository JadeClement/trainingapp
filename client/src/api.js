const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  listWorkouts: (start, end, athleteId) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    if (athleteId) params.set('athleteId', athleteId);
    const qs = params.toString();
    return request(`/workouts${qs ? `?${qs}` : ''}`);
  },
  getWorkout: (id) => request(`/workouts/${id}`),
  createWorkout: (body, athleteId) =>
    request('/workouts', { method: 'POST', body: JSON.stringify(athleteId ? { ...body, athleteId } : body) }),
  updateWorkout: (id, body) => request(`/workouts/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  completeWorkout: (id, body) =>
    request(`/workouts/${id}/complete`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteWorkout: (id) => request(`/workouts/${id}`, { method: 'DELETE' }),
  getWorkoutStreams: (id) => request(`/workouts/${id}/streams`),
  getWorkoutLaps: (id) => request(`/workouts/${id}/laps`),
  listLinkCandidates: (id) => request(`/workouts/${id}/link-candidates`),
  linkStravaActivity: (id, syncedWorkoutId) =>
    request(`/workouts/${id}/link-strava`, { method: 'POST', body: JSON.stringify({ syncedWorkoutId }) }),

  listComments: (workoutId) => request(`/workouts/${workoutId}/comments`),
  addComment: (workoutId, body) =>
    request(`/workouts/${workoutId}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
  deleteComment: (workoutId, commentId) =>
    request(`/workouts/${workoutId}/comments/${commentId}`, { method: 'DELETE' }),

  stravaStatus: () => request('/strava/status'),
  stravaSync: () => request('/strava/sync', { method: 'POST' }),
  stravaDisconnect: () => request('/strava/disconnect', { method: 'DELETE' }),

  listTrainingLoad: (start, end) => {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.toString();
    return request(`/training-load${qs ? `?${qs}` : ''}`);
  },

  listFriends: () => request('/friends'),
  sendFriendRequest: (email) =>
    request('/friends/request', { method: 'POST', body: JSON.stringify({ email }) }),
  acceptFriendRequest: (userId) => request(`/friends/${userId}/accept`, { method: 'POST' }),
  removeFriend: (userId) => request(`/friends/${userId}`, { method: 'DELETE' }),

  listFeed: () => request('/friends/feed'),
  listOverlaps: () => request('/friends/overlaps'),
  updateOverlap: (id, action) => request(`/friends/overlaps/${id}/${action}`, { method: 'POST' }),

  listHrZones: () => request('/heart-rate-zones'),
  upsertHrZone: (sport, maxHr) =>
    request('/heart-rate-zones', { method: 'POST', body: JSON.stringify({ sport, maxHr }) }),
  deleteHrZone: (sport) => request(`/heart-rate-zones/${sport}`, { method: 'DELETE' }),

  createCoachProfile: () => request('/coach/profile', { method: 'POST' }),
  setAccountMode: (mode) => request('/coach/mode', { method: 'POST', body: JSON.stringify({ mode }) }),

  listCoachRelationships: () => request('/coach/relationships'),
  sendAthleteRequest: (email) =>
    request('/coach/athletes', { method: 'POST', body: JSON.stringify({ email }) }),
  acceptCoachRequest: (coachId) =>
    request(`/coach/relationships/${coachId}/accept`, { method: 'POST' }),
  removeCoachRelationship: (otherUserId) =>
    request(`/coach/relationships/${otherUserId}`, { method: 'DELETE' }),
};
