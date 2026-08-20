import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { ProfileMenu } from './ProfileMenu.jsx';

export function NavBar() {
  const { user, setAccountMode } = useAuth();
  const isCoach = user?.activeMode === 'coach';

  return (
    <header className="navbar">
      <NavLink to="/" className="navbar-brand" end>
        Training Log
      </NavLink>
      {user && (
        <nav className="navbar-links">
          <NavLink to="/progress" className={({ isActive }) => (isActive ? 'active' : '')}>
            Progress
          </NavLink>
          <NavLink to="/people" className={({ isActive }) => (isActive ? 'active' : '')}>
            People
          </NavLink>
        </nav>
      )}
      <div className="navbar-actions">
        {user?.hasCoachProfile && (
          <div className="view-toggle mode-toggle">
            <button
              type="button"
              className={!isCoach ? 'active' : ''}
              onClick={() => setAccountMode('personal')}
            >
              Personal
            </button>
            <button
              type="button"
              className={isCoach ? 'active' : ''}
              onClick={() => setAccountMode('coach')}
            >
              Coach
            </button>
          </div>
        )}
        <ProfileMenu />
      </div>
    </header>
  );
}
