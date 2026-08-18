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
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountType, setAccountType] = useState('athlete');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password, confirmPassword, firstName, lastName, accountType);
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
        <div className="form-row">
          <label>
            First name
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              required
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              required
            />
          </label>
        </div>
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
        <label>
          Confirm password
          <PasswordInput
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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
