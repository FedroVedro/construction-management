import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { showError, showSuccess } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(username, password);
      showSuccess('Добро пожаловать!');
      navigate('/');
    } catch (err) {
      showError('Неверное имя пользователя или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: isDark ? '#1a1a2e' : '#f5f5f5',
      backgroundImage: isDark 
        ? 'radial-gradient(circle at 50% 50%, #16213e 0%, #1a1a2e 100%)'
        : 'radial-gradient(circle at 50% 50%, #ffffff 0%, #f5f5f5 100%)',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Декоративные элементы */}
      <div style={{
        position: 'absolute',
        top: '-100px',
        right: '-100px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: isDark ? 'rgba(0,123,255,0.1)' : 'rgba(0,123,255,0.05)',
        filter: 'blur(60px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-100px',
        left: '-100px',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: isDark ? 'rgba(40,167,69,0.1)' : 'rgba(40,167,69,0.05)',
        filter: 'blur(60px)'
      }} />

      {/* Кнопка переключения темы */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'none',
          border: '2px solid ' + (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'),
          borderRadius: '20px',
          padding: '8px 14px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: isDark ? '#e8e8e8' : '#495057',
          fontSize: '14px',
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{ fontSize: '18px' }}>{isDark ? '☀️' : '🌙'}</span>
        <span>{isDark ? 'Светлая тема' : 'Тёмная тема'}</span>
      </button>

      <div style={{ 
        backgroundColor: isDark ? '#0f3460' : 'white',
        width: '420px',
        borderRadius: '16px',
        padding: '40px',
        boxShadow: isDark 
          ? '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)'
          : '0 20px 60px rgba(0,0,0,0.1)',
        position: 'relative',
        animation: 'slideUp 0.5s ease-out',
        transition: 'all 0.3s ease'
      }}>
        {/* Логотип */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #007bff 0%, #28a745 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: '36px',
            boxShadow: '0 10px 30px rgba(0,123,255,0.3)'
          }}>
            🏗️
          </div>
          <h2 style={{ 
            color: isDark ? '#e8e8e8' : '#212529',
            marginBottom: '8px',
            fontSize: '24px',
            fontWeight: 600
          }}>
            Система управления строительством
          </h2>
          <p style={{
            color: isDark ? '#a0a0a0' : '#6c757d',
            fontSize: '14px',
            margin: 0
          }}>
            Войдите для продолжения работы
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 500,
              color: isDark ? '#a0a0a0' : '#495057',
              fontSize: '14px'
            }}>
              👤 Имя пользователя
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid ' + (isDark ? '#2d4059' : '#dee2e6'),
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: isDark ? '#1a1a2e' : 'white',
                color: isDark ? '#e8e8e8' : '#212529',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#007bff';
                e.target.style.boxShadow = '0 0 0 4px rgba(0,123,255,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isDark ? '#2d4059' : '#dee2e6';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <div className="form-group">
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 500,
              color: isDark ? '#a0a0a0' : '#495057',
              fontSize: '14px'
            }}>
              🔒 Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid ' + (isDark ? '#2d4059' : '#dee2e6'),
                borderRadius: '8px',
                fontSize: '16px',
                backgroundColor: isDark ? '#1a1a2e' : 'white',
                color: isDark ? '#e8e8e8' : '#212529',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#007bff';
                e.target.style.boxShadow = '0 0 0 4px rgba(0,123,255,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isDark ? '#2d4059' : '#dee2e6';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%',
              padding: '14px 24px',
              background: loading 
                ? (isDark ? '#2d4059' : '#6c757d')
                : 'linear-gradient(135deg, #007bff 0%, #0056b3 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(0,123,255,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              marginTop: '10px'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(0,123,255,0.4)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = loading ? 'none' : '0 4px 12px rgba(0,123,255,0.3)';
            }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: '20px', height: '20px' }}></div>
                Вход...
              </>
            ) : (
              <>
                🚀 Войти
              </>
            )}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          paddingTop: '24px',
          borderTop: '1px solid ' + (isDark ? '#2d4059' : '#dee2e6'),
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '13px',
            color: isDark ? '#6c757d' : '#6c757d',
            margin: 0
          }}>
            💡 Нажмите <kbd style={{
              backgroundColor: isDark ? '#1a1a2e' : '#f8f9fa',
              border: '1px solid ' + (isDark ? '#2d4059' : '#dee2e6'),
              borderRadius: '3px',
              padding: '2px 6px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}>?</kbd> для справки по горячим клавишам
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .loading-spinner {
          border: 2px solid rgba(255,255,255,0.3);
          border-radius: 50%;
          border-top-color: white;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
