import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api.js';
import { PasswordInput } from '../components/PasswordInput.jsx';

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [tokenState, setTokenState] = useState(token ? 'checking' : 'invalid');
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showMatchHint = confirmPassword.length > 0;

  useEffect(() => {
    if (!token) {
      setTokenState('invalid');
      setError('This reset link is invalid or has expired.');
      return;
    }

    let cancelled = false;
    api
      .validateResetToken(token)
      .then(() => {
        if (!cancelled) setTokenState('valid');
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenState('invalid');
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password, confirmPassword);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (tokenState === 'checking') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h1>Set a new password</h1>
          <p className="page-loading">Checking reset link…</p>
        </div>
      </div>
    );
  }

  if (tokenState === 'invalid') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h1>Set a new password</h1>
          <p className="form-error">{error || 'This reset link is invalid or has expired.'}</p>
          <p className="auth-switch">
            <Link to="/forgot-password">Request a new reset link</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Set a new password</h1>
        {error && <p className="form-error">{error}</p>}
        <label>
          New password
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
          {showMatchHint && (
            <p
              className={`password-match-hint ${passwordsMatch ? 'match' : 'mismatch'}`}
              aria-live="polite"
            >
              {passwordsMatch ? '✓ Passwords match' : '× Do not match'}
            </p>
          )}
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  );
}
