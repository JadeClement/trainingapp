import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login({ email, password });
    setUser(data.user);
  }, []);

  const signup = useCallback(async (email, password, confirmPassword, firstName, lastName, accountType) => {
    const data = await api.signup({
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
      accountType,
    });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const createCoachProfile = useCallback(async () => {
    const data = await api.createCoachProfile();
    setUser(data.user);
  }, []);

  const setAccountMode = useCallback(async (mode) => {
    const data = await api.setAccountMode(mode);
    setUser(data.user);
  }, []);

  const setWeekStart = useCallback(async (weekStartsOn) => {
    const data = await api.setWeekStart(weekStartsOn);
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, createCoachProfile, setAccountMode, setWeekStart }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
