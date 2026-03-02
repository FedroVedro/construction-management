import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/images/logo.png';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navStyle = {
    backgroundColor: isDark ? '#0f3460' : '#2c3e50',
    padding: '1rem 0',
    color: 'white',
    width: '100%',
    transition: 'background-color 0.3s ease',
  };

  const navContainerStyle = {
    width: '100%',
    padding: '0 40px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    marginRight: '20px',
    transition: 'opacity 0.2s',
  };

  return (
    <nav style={navStyle}>
      <div style={navContainerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          {/* Логотип в начале */}
          <img 
            src={logo} 
            alt="Логотип компании" 
            style={{
              height: '40px',
              width: 'auto',
              objectFit: 'contain',
              marginRight: '20px',
              borderRight: '1px solid rgba(255, 255, 255, 0.3)',
              paddingRight: '20px'
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
            <Link to="/" style={linkStyle}>Главная</Link>
            {user?.role === 'admin' && (
              <>
                <Link to="/cities" style={linkStyle}>Объекты строительства</Link>
                <Link to="/construction-stages" style={linkStyle}>Этапы строительства</Link>
              </>
            )}
            <Link to="/document-schedule" style={linkStyle}>График выдачи документации</Link>
            <Link to="/hr-schedule" style={linkStyle}>HR-график</Link>
            <Link to="/procurement-schedule" style={linkStyle}>График закупок</Link>
            <Link to="/construction-schedule" style={linkStyle}>График строительства</Link>
            <Link to="/directive-schedule" style={linkStyle}>Директивный график</Link>
            <Link to="/marketing-schedule" style={linkStyle}>График маркетинга</Link>
            <Link to="/preconstruction-schedule" style={linkStyle}>График ТЗ</Link>
            <Link to="/project-office" style={linkStyle}>Проектный офис</Link>
            <Link to="/strategic-map" style={{...linkStyle, color: '#a78bfa', fontWeight: 500}}>📊 Мастер-карта</Link>
            <Link to="/process-management" style={{...linkStyle, color: '#fbbf24', fontWeight: 500}}>📋 Процесс управления</Link>
            <Link to="/dependency-manager" style={{...linkStyle, color: '#f97316', fontWeight: 500}}>🔗 Зависимости</Link>
            {user?.role === 'admin' && (
              <>
                <Link to="/telegram-settings" style={linkStyle}>Настройки Telegram</Link>
                <Link to="/admin" style={{...linkStyle, color: '#f87171', fontWeight: 600}}>👑 Админ-панель</Link>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {/* Переключатель темы */}
          <button
            onClick={toggleTheme}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            style={{
              background: 'none',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '20px',
              padding: '6px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: 'white',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
              e.target.style.borderColor = 'rgba(255,255,255,0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          >
            <span style={{ fontSize: '18px' }}>{isDark ? '☀️' : '🌙'}</span>
            <span>{isDark ? 'Светлая' : 'Тёмная'}</span>
          </button>
          
          <span style={{ marginRight: '10px', opacity: 0.9 }}>
            👤 {user?.username} ({user?.role})
          </span>
          <button onClick={handleLogout} className="btn btn-secondary">
            Выйти
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
