import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function initialsFor(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickAway(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickAway);
    return () => document.removeEventListener('mousedown', handleClickAway);
  }, [open]);

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        type="button"
        className="profile-button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user ? initialsFor(user.displayName) : '?'}
      </button>

      {open && (
        <div className="profile-dropdown" role="menu">
          {user ? (
            <>
              <div className="profile-dropdown-name">{user.displayName}</div>
              <Link to="/settings" role="menuitem" onClick={() => setOpen(false)}>
                Settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" role="menuitem" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
