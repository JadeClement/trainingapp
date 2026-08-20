import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { ConfirmDialog } from '../components/ConfirmDialog.jsx';
import { SPORTS, sportMeta } from '../dateUtils.js';
import { useAuth } from '../context/AuthContext.jsx';

export function SettingsPage() {
  const { user, createCoachProfile, setWeekStart } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);
  const [creatingCoachProfile, setCreatingCoachProfile] = useState(false);

  const [zones, setZones] = useState([]);
  const [addingZone, setAddingZone] = useState(false);
  const [newSport, setNewSport] = useState('');
  const [newMaxHr, setNewMaxHr] = useState('');
  const [savingZone, setSavingZone] = useState(false);
  const [savingWeekStart, setSavingWeekStart] = useState(false);

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
    try {
      const data = await api.stravaSync();
      setSyncResult(data.synced);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setConfirmingDisconnect(false);
    try {
      await api.stravaDisconnect();
      setStatus({ connected: false, athleteId: null });
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
      {error && <p className="form-error">{error}</p>}

      <h2 className="settings-group-title">Preferences</h2>
      <section className="settings-card">
        <h3>Week starts on</h3>
        <p className="settings-status">Used by the calendar and weekly stats.</p>
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

      <h2 className="settings-group-title">Integrations</h2>
      <section className="settings-card">
        <h3>Strava</h3>

        {status?.connected ? (
          <>
            <p className="settings-status">
              Connected — athlete ID <code>{status.athleteId}</code>
            </p>
            <div className="settings-actions">
              <button type="button" className="primary" onClick={handleSync} disabled={syncing}>
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
          </>
        ) : (
          <>
            <p className="settings-status">
              Connect your Strava account to automatically pull in activities and see fitness trends.
            </p>
            <a className="primary-link" href="/api/strava/connect">
              Connect Strava
            </a>
          </>
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
