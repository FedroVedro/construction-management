import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

// Безопасный парсинг JSON из localStorage (защита от crash при corrupted data)
const safeJsonParse = (key) => {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error parsing ${key} from localStorage:`, error);
    // Очищаем повреждённые данные
    localStorage.removeItem(key);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = safeJsonParse('user');
    
    if (token && userData) {
      setUser(userData);
    } else if (token && !userData) {
      // Токен есть, но данные пользователя повреждены - очищаем всё
      localStorage.removeItem('token');
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const response = await client.post('/auth/login', formData);
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return response.data;
    } catch (error) {
      // Очищаем старые данные при ошибке логина
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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