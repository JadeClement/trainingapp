import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PasswordInput } from '../components/PasswordInput.jsx';

const ACCOUNT_TYPES = [
  { value: 'athlete', label: 'Athlete', hint: 'Log and plan your own training.' },
  { value: 'coach', label: 'Coach', hint: 'Plan and comment on workouts for athletes you coach.' },
  { value: 'both', label: 'Both', hint: 'Your own training log, plus coaching tools.' },
];

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('athlete');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signup(email, password, displayName, accountType);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Sign up</h1>
        {error && <p className="form-error">{error}</p>}
        <label>
          Name
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
        <div>
          <span className="label-like">I'm signing up as a</span>
          <div className="view-toggle account-type-toggle">
            {ACCOUNT_TYPES.map((t) => (
              <button
                type="button"
                key={t.value}
                className={accountType === t.value ? 'active' : ''}
                onClick={() => setAccountType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="label-hint account-type-hint">
            {ACCOUNT_TYPES.find((t) => t.value === accountType).hint}
          </p>
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
