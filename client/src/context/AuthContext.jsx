import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('auth_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('auth_token') || null);
  const [loading, setLoading] = useState(true);

  // Synchronize state and verify token validity on mount
  useEffect(() => {
    async function verifyAuth() {
      const existingToken = localStorage.getItem('auth_token');
      if (existingToken) {
        try {
          const res = await authAPI.getCurrentUser();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('auth_user', JSON.stringify(res.user));
          }
        } catch (err) {
          console.warn('Session verification failed, logging out:', err);
          logout();
        }
      }
      setLoading(false);
    }

    verifyAuth();

    // Listen for unauthorized events dispatched by API interceptor
    const handleUnauthorized = () => logout();
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    const data = await authAPI.login({ email, password });
    if (data.success && data.token) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    return data;
  };

  const register = async (name, email, password, date_of_birth) => {
    const data = await authAPI.register({ name, email, password, date_of_birth });
    if (data.success && data.token) {
      setToken(data.token);
      setUser(data.user);
      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    return data;
  };

  const updateProfile = async (profileData) => {
    const data = await authAPI.updateProfile(profileData);
    if (data.success && data.user) {
      setUser(data.user);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
    }
    return data;
  };

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  }, []);

  const value = {
    user,
    token,
    isAuthenticated: !!(token || localStorage.getItem('auth_token')),
    loading,
    login,
    register,
    updateProfile,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
