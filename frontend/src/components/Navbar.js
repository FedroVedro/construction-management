import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/images/logo.png';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navStyle = {
    backgroundColor: '#2c3e50',
    padding: '1rem 0',
    color: 'white',
    width: '100%',
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
            <Link to="/marketing-schedule" style={linkStyle}>Маркетинг и продажи</Link>
            <Link to="/project-office" style={linkStyle}>Проектный офис</Link>
            {user?.role === 'admin' && (
              <Link to="/telegram-settings" style={linkStyle}>Настройки Telegram</Link>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '20px' }}>
            {user?.username} ({user?.role})
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