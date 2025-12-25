import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    // Применяем CSS переменные к документу
    const root = document.documentElement;
    
    if (isDark) {
      root.style.setProperty('--bg-primary', '#1a1a2e');
      root.style.setProperty('--bg-secondary', '#16213e');
      root.style.setProperty('--bg-card', '#0f3460');
      root.style.setProperty('--bg-input', '#1a1a2e');
      root.style.setProperty('--text-primary', '#e8e8e8');
      root.style.setProperty('--text-secondary', '#a0a0a0');
      root.style.setProperty('--text-muted', '#6c757d');
      root.style.setProperty('--border-color', '#2d4059');
      root.style.setProperty('--navbar-bg', '#0f3460');
      root.style.setProperty('--table-stripe', '#16213e');
      root.style.setProperty('--table-hover', '#1a1a2e');
      root.style.setProperty('--shadow-color', 'rgba(0,0,0,0.3)');
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    } else {
      root.style.setProperty('--bg-primary', '#f5f5f5');
      root.style.setProperty('--bg-secondary', '#ffffff');
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--bg-input', '#ffffff');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#495057');
      root.style.setProperty('--text-muted', '#6c757d');
      root.style.setProperty('--border-color', '#dee2e6');
      root.style.setProperty('--navbar-bg', '#2c3e50');
      root.style.setProperty('--table-stripe', '#f8f9fa');
      root.style.setProperty('--table-hover', '#e9ecef');
      root.style.setProperty('--shadow-color', 'rgba(0,0,0,0.1)');
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

