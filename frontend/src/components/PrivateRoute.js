import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        gap: '15px',
        backgroundColor: 'var(--bg-primary, #f5f5f5)',
        flexDirection: 'column'
      }}>
        <div 
          className="loading-spinner" 
          style={{ 
            width: '50px', 
            height: '50px',
            border: '4px solid rgba(0, 123, 255, 0.2)',
            borderTop: '4px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} 
        />
        <span style={{ color: 'var(--text-muted, #6c757d)', fontSize: '16px' }}>
          Загрузка приложения...
        </span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;