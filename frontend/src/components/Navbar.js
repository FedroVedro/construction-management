import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
  };

  const navContainerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
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
        <div>
          <Link to="/" style={linkStyle}>Главная</Link>
          {user?.role === 'admin' && (
            <Link to="/cities" style={linkStyle}>Города</Link>
          )}
          <Link to="/document-schedule" style={linkStyle}>График документов</Link>
          <Link to="/hr-schedule" style={linkStyle}>HR-график</Link>
          <Link to="/procurement-schedule" style={linkStyle}>График закупок</Link>
          <Link to="/construction-schedule" style={linkStyle}>График строительства</Link>
          <Link to="/directive-schedule" style={linkStyle}>Директивный график</Link>
        </div>
        <div>
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