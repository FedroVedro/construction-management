import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Breadcrumbs from './Breadcrumbs';
import { useTheme } from '../context/ThemeContext';
import { useKeyboardShortcuts, KeyboardShortcutsHelp } from '../hooks/useKeyboardShortcuts';

const Layout = () => {
  const { isDark } = useTheme();
  const { showHelp, setShowHelp } = useKeyboardShortcuts();

  return (
    <div className="App" style={{
      backgroundColor: 'var(--bg-primary)',
      minHeight: '100vh',
      transition: 'background-color 0.3s ease'
    }}>
      <Navbar />
      <main style={{ 
        flex: 1,
        width: '100%',
        backgroundColor: 'var(--bg-primary)',
        minHeight: 'calc(100vh - 60px)',
        color: 'var(--text-primary)',
        transition: 'all 0.3s ease'
      }}>
        <div style={{ padding: '0 40px' }}>
          <Breadcrumbs />
        </div>
        <Outlet />
      </main>
      
      {/* Помощь по горячим клавишам */}
      <KeyboardShortcutsHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />
      
      {/* Кнопка справки в углу */}
      <button
        onClick={() => setShowHelp(true)}
        title="Горячие клавиши (?)"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#0f3460' : '#2c3e50',
          color: 'white',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          zIndex: 1000
        }}
        onMouseEnter={(e) => {
          e.target.style.transform = 'scale(1.1)';
          e.target.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.transform = 'scale(1)';
          e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        }}
      >
        ⌨️
      </button>
    </div>
  );
};

export default Layout;
