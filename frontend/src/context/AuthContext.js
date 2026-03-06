import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Проверяем сессию при загрузке — httpOnly cookie отправляется автоматически
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await client.get('/auth/me');
        setUser(response.data);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Обработка 401 от других запросов (истекла сессия) — без полной перезагрузки
  useEffect(() => {
    const onSessionExpired = () => setUser(null);
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, []);

  const login = useCallback(async (username, password) => {
    // JSON-эндпоинт надёжнее для кросс-доменных запросов
    const response = await client.post('/auth/login-json', {
      username,
      password,
    });
    const { user: userData } = response.data;
    setUser(userData);
    return response.data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await client.post('/auth/logout');
    } catch {
      // игнорируем ошибки при выходе
    }
    setUser(null);
  }, []);

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};