import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

function resetPathFromUrl(resetUrl) {
  if (!resetUrl) return null;
  try {
    const url = new URL(resetUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      const data = await api.forgotPassword(email);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    const resetPath = resetPathFromUrl(result.resetUrl);
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h1>Forgot password</h1>
          <p className="form-success">{result.message}</p>
          {resetPath && (
            <p className="auth-dev-hint">
              Local development: <Link to={resetPath}>open reset link</Link>
            </p>
          )}
          <p className="auth-switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Forgot password</h1>
        <p className="auth-lead">
          Enter your email and we'll send a link to reset your password.
        </p>
        {error && <p className="form-error">{error}</p>}
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
        <p className="auth-switch">
          Remembered it? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

