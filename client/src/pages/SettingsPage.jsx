import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { SPORTS, sportMeta } from '../dateUtils.js';
import {
  ACTIVITY_CATEGORIES,
  DEFAULT_FEATURED_SPORTS,
  MAX_PINNED_ACTIVITY_TYPES,
} from '../activityTypes.js';
import { useAuth } from '../context/AuthContext.jsx';

const HISTORY_CHUNKS = [
  { days: 90, label: '90 days' },
  { days: 182, label: '6 months' },
  { days: 365, label: '1 year' },
];

function formatImportedFrom(iso) {
  if (!iso) return null;
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SettingsPage() {
  const { user, createCoachProfile, setWeekStart, setSportPrefs } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importingDays, setImportingDays] = useState(null);
  const [syncResult, setSyncResult] = useState(null);
  const [historyResult, setHistoryResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [creatingCoachProfile, setCreatingCoachProfile] = useState(false);

  const [zones, setZones] = useState([]);
  const [addingZone, setAddingZone] = useState(false);
  const [newSport, setNewSport] = useState('');
  const [newMaxHr, setNewMaxHr] = useState('');
  const [savingZone, setSavingZone] = useState(false);
  const [savingWeekStart, setSavingWeekStart] = useState(false);
  const [featuredSports, setFeaturedSports] = useState(
    () => user?.featuredSports ?? [...DEFAULT_FEATURED_SPORTS]
  );
  const [pinnedActivityTypes, setPinnedActivityTypes] = useState(
    () => user?.pinnedActivityTypes ?? []
  );
  const [savingSportPrefs, setSavingSportPrefs] = useState(false);

  const stravaParam = searchParams.get('strava');

  useEffect(() => {
    Promise.all([api.stravaStatus(), api.listHrZones()])
      .then(([statusData, zonesData]) => {
        setStatus(statusData);
        setZones(zonesData.zones);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!stravaParam) return;
    // Clear the query param once shown so a refresh doesn't repeat the banner.
    const next = new URLSearchParams(searchParams);
    next.delete('strava');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stravaParam]);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    setSyncResult(null);
    setHistoryResult(null);
    try {
      const data = await api.stravaSync();
      setSyncResult(data.synced);
      if (data.importedFrom) {
        setStatus((prev) => ({ ...prev, importedFrom: data.importedFrom }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleImportHistory(days) {
    setImportingDays(days);
    setError(null);
    setSyncResult(null);
    setHistoryResult(null);
    try {
      const data = await api.stravaSync(days);
      setHistoryResult(data);
      setStatus((prev) => ({ ...prev, importedFrom: data.importedFrom }));
    } catch (err) {
      setError(err.message);
    } finally {
      setImportingDays(null);
    }
  }

  async function handleDisconnect() {
    setConfirmingDisconnect(false);
    try {
      await api.stravaDisconnect();
      setStatus((prev) => ({ ...prev, connected: false, athleteId: null, importedFrom: null }));
      setSyncResult(null);
      setHistoryResult(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateCoachProfile() {
    setCreatingCoachProfile(true);
    setError(null);
    try {
      await createCoachProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingCoachProfile(false);
    }
  }

  async function handleWeekStart(weekStartsOn) {
    if ((weekStartsOn === 'sunday') === (user.weekStartsOn === 'sunday')) return;
    setSavingWeekStart(true);
    setError(null);
    try {
      await setWeekStart(weekStartsOn);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingWeekStart(false);
    }
  }

  useEffect(() => {
    setFeaturedSports(user?.featuredSports ?? [...DEFAULT_FEATURED_SPORTS]);
    setPinnedActivityTypes(user?.pinnedActivityTypes ?? []);
  }, [user?.featuredSports, user?.pinnedActivityTypes]);

  function toggleFeaturedSport(sport) {
    setFeaturedSports((prev) => {
      if (prev.includes(sport)) {
        if (prev.length === 1) return prev;
        return prev.filter((s) => s !== sport);
      }
      return SPORTS.map((s) => s.value).filter((value) => value === sport || prev.includes(value));
    });
  }

  function togglePinnedType(type) {
    setPinnedActivityTypes((prev) => {
      if (prev.includes(type)) return prev.filter((t) => t !== type);
      if (prev.length >= MAX_PINNED_ACTIVITY_TYPES) return prev;
      return [...prev, type];
    });
  }

  async function handleSaveSportPrefs() {
    setSavingSportPrefs(true);
    setError(null);
    try {
      await setSportPrefs(featuredSports, pinnedActivityTypes);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSportPrefs(false);
    }
  }

  const sportPrefsDirty =
    JSON.stringify(featuredSports) !==
      JSON.stringify(user?.featuredSports ?? DEFAULT_FEATURED_SPORTS) ||
    JSON.stringify([...pinnedActivityTypes].sort()) !==
      JSON.stringify([...(user?.pinnedActivityTypes ?? [])].sort());

  const unconfiguredSports = SPORTS.filter((s) => !zones.some((z) => z.sport === s.value));

  function openAddZone() {
    setNewSport(unconfiguredSports[0]?.value || '');
    setNewMaxHr('');
    setAddingZone(true);
  }

  async function handleAddZone(e) {
    e.preventDefault();
    setSavingZone(true);
    setError(null);
    try {
      await api.upsertHrZone(newSport, Number(newMaxHr));
      const data = await api.listHrZones();
      setZones(data.zones);
      setAddingZone(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingZone(false);
    }
  }

  async function handleDeleteZone(sport) {
    setError(null);
    try {
      await api.deleteHrZone(sport);
      setZones((prev) => prev.filter((z) => z.sport !== sport));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p className="page-loading">Loading…</p>;

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {stravaParam === 'connected' && (
        <p className="banner banner-success">Strava connected.</p>
      )}
      {stravaParam === 'error' && (
        <p className="banner banner-error">Couldn't connect Strava. Please try again.</p>
      )}
      {stravaParam === 'not_allowed' && (
        <p className="banner banner-error">Strava connection isn't available for your account right now.</p>
      )}
      {error && <p className="form-error">{error}</p>}

      <h2 className="settings-group-title">Preferences</h2>
      <section className="settings-card">
        <h3>Week starts on</h3>
        <p className="settings-status">Used by Plan and weekly stats.</p>
        <div className="view-toggle">
          <button
            type="button"
            className={user.weekStartsOn !== 'sunday' ? 'active' : ''}
            onClick={() => handleWeekStart('monday')}
            disabled={savingWeekStart}
          >
            Monday
          </button>
          <button
            type="button"
            className={user.weekStartsOn === 'sunday' ? 'active' : ''}
            onClick={() => handleWeekStart('sunday')}
            disabled={savingWeekStart}
          >
            Sunday
          </button>
        </div>
      </section>

      <section className="settings-card">
        <h3>Stats sports</h3>
        <p className="settings-status">
          Featured sports stay as their own rows on Stats. Everything else rolls into Other,
          unless you pin a specific activity type.
        </p>

        <p className="settings-subhead">Featured</p>
        <div className="sport-prefs-featured">
          {SPORTS.map((s) => (
            <label key={s.value} className="checkbox-label">
              <input
                type="checkbox"
                checked={featuredSports.includes(s.value)}
                onChange={() => toggleFeaturedSport(s.value)}
                disabled={savingSportPrefs}
              />
              <span className="sport-dot" style={{ backgroundColor: s.color }} />
              {s.label}
            </label>
          ))}
        </div>

        <p className="settings-subhead">
          Pin activity types
          <span className="settings-status">
            {' '}
            ({pinnedActivityTypes.length}/{MAX_PINNED_ACTIVITY_TYPES})
          </span>
        </p>
        <div className="sport-prefs-pins">
          {ACTIVITY_CATEGORIES.map((category) => (
            <div key={category.name} className="sport-prefs-pin-group">
              <p className="sport-prefs-pin-group-title">{category.name}</p>
              <div className="sport-prefs-pin-types">
                {category.types.map((type) => {
                  const checked = pinnedActivityTypes.includes(type);
                  const atCap = !checked && pinnedActivityTypes.length >= MAX_PINNED_ACTIVITY_TYPES;
                  return (
                    <label key={type} className={`checkbox-label${atCap ? ' is-disabled' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePinnedType(type)}
                        disabled={savingSportPrefs || atCap}
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="primary"
            onClick={handleSaveSportPrefs}
            disabled={savingSportPrefs || !sportPrefsDirty}
          >
            {savingSportPrefs ? 'Saving…' : 'Save sports'}
          </button>
        </div>
      </section>

      <h2 className="settings-group-title">Integrations</h2>
      <section className="settings-card">
        <h3>Strava</h3>

        {status?.connected ? (
          <>
            <p className="settings-status">
              Connected — athlete ID <code>{status.athleteId}</code>
            </p>
            {status.importedFrom && (
              <p className="settings-status">
                Imported from {formatImportedFrom(status.importedFrom)}.
              </p>
            )}
            <div className="settings-actions">
              <button type="button" className="primary" onClick={handleSync} disabled={syncing || importingDays}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button type="button" className="danger" onClick={() => setConfirmingDisconnect(true)}>
                Disconnect
              </button>
            </div>
            {syncResult !== null && (
              <p className="settings-status">
                Synced {syncResult} {syncResult === 1 ? 'activity' : 'activities'}.
              </p>
            )}

            <h4 className="settings-subhead">Older activities</h4>
            <p className="settings-status">
              Pull another stretch from before what you already have. Fitness on Progress is
              rebuilt afterward.
            </p>
            <div className="view-toggle">
              {HISTORY_CHUNKS.map((chunk) => (
                <button
                  type="button"
                  key={chunk.days}
                  onClick={() => handleImportHistory(chunk.days)}
                  disabled={syncing || importingDays !== null}
                >
                  {importingDays === chunk.days ? 'Importing…' : chunk.label}
                </button>
              ))}
            </div>
            {historyResult && (
              <p className="settings-status">
                {historyResult.synced === 0 ? (
                  <>
                    No activities in that stretch.
                    {historyResult.importedFrom
                      ? ` Looking from ${formatImportedFrom(historyResult.importedFrom)} now.`
                      : ''}
                  </>
                ) : (
                  <>
                    Imported {historyResult.synced}{' '}
                    {historyResult.synced === 1 ? 'activity' : 'activities'}. Fitness trend
                    updated — see <Link to="/progress">Progress</Link>.
                  </>
                )}
              </p>
            )}
          </>
        ) : status?.allowed ? (
          <>
            <p className="settings-status">
              Connect your Strava account to automatically pull in activities and see fitness trends.
            </p>
            <a className="primary-link" href="/api/strava/connect">
              Connect Strava
            </a>
          </>
        ) : (
          <p className="settings-status">Strava connection isn't available for your account right now.</p>
        )}

        <p className="strava-attribution">
          <a href="https://www.strava.com" target="_blank" rel="noreferrer">
            Powered by Strava
          </a>
        </p>
      </section>

      <h2 className="settings-group-title">Training</h2>
      <section className="settings-card">
        <h3>Heart rate zones</h3>
        <p className="settings-status">
          Set a max heart rate per sport to see zone-colored heart rate charts on synced workouts —
          your run and bike max HR usually aren't the same.
        </p>

        {zones.length === 0 && !addingZone && (
          <p className="empty-hint">No sports configured yet.</p>
        )}

        {zones.length > 0 && (
          <div className="hr-zone-list">
            {zones.map((z) => (
              <div key={z.sport} className="hr-zone-row">
                <span className="sport-dot" style={{ backgroundColor: sportMeta(z.sport).color }} />
                <span className="hr-zone-sport">{sportMeta(z.sport).label}</span>
                <span className="hr-zone-value">{z.maxHr} bpm</span>
                <button type="button" className="link-button" onClick={() => handleDeleteZone(z.sport)}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {addingZone ? (
          <form className="hr-zone-add-form" onSubmit={handleAddZone}>
            <select value={newSport} onChange={(e) => setNewSport(e.target.value)}>
              {unconfiguredSports.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="100"
              max="230"
              placeholder="e.g. 185"
              value={newMaxHr}
              onChange={(e) => setNewMaxHr(e.target.value)}
              required
            />
            <button type="submit" className="primary" disabled={savingZone}>
              {savingZone ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setAddingZone(false)}>
              Cancel
            </button>
          </form>
        ) : (
          unconfiguredSports.length > 0 && (
            <button type="button" className="link-button" onClick={openAddZone}>
              + Add sport
            </button>
          )
        )}
      </section>

      <h2 className="settings-group-title">Coaching</h2>
      <section className="settings-card">
        <h3>Coach profile</h3>

        {user.hasCoachProfile ? (
          <p className="settings-status">
            You have a coach profile. Use the Personal / Coach toggle in the header to switch between
            your personal and coach account views.
          </p>
        ) : (
          <>
            <p className="settings-status">
              Create a coach profile to unlock a separate coach account view you can toggle to from the
              header.
            </p>
            <div className="settings-actions">
              <button
                type="button"
                className="primary"
                onClick={handleCreateCoachProfile}
                disabled={creatingCoachProfile}
              >
                {creatingCoachProfile ? 'Creating…' : 'Create coach profile'}
              </button>
            </div>
          </>
        )}
      </section>

      {confirmingDisconnect && (
        <ConfirmDialog
          title="Disconnect Strava?"
          message="Future workouts won't sync automatically. Previously synced workouts will stay in your log."
          confirmLabel="Disconnect"
          onConfirm={handleDisconnect}
          onCancel={() => setConfirmingDisconnect(false)}
        />
      )}
    </div>
  );
}
