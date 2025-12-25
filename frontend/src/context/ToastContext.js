import React, { createContext, useState, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

// Типы уведомлений с иконками и цветами
const TOAST_TYPES = {
  success: { icon: '✓', color: '#28a745', bgColor: '#d4edda' },
  error: { icon: '✕', color: '#dc3545', bgColor: '#f8d7da' },
  warning: { icon: '⚠', color: '#856404', bgColor: '#fff3cd' },
  info: { icon: 'ℹ', color: '#0c5460', bgColor: '#d1ecf1' }
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random();
    
    setToasts(prev => [...prev, { id, message, type, duration }]);
    
    // Автоматическое удаление
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Удобные методы
  const showSuccess = useCallback((message) => addToast(message, 'success'), [addToast]);
  const showError = useCallback((message) => addToast(message, 'error', 5000), [addToast]);
  const showWarning = useCallback((message) => addToast(message, 'warning', 4000), [addToast]);
  const showInfo = useCallback((message) => addToast(message, 'info'), [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, showSuccess, showError, showWarning, showInfo }}>
      {children}
      
      {/* Контейнер для тостов */}
      <div style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none'
      }}>
        {toasts.map((toast, index) => {
          const typeConfig = TOAST_TYPES[toast.type] || TOAST_TYPES.info;
          
          return (
            <div
              key={toast.id}
              style={{
                backgroundColor: typeConfig.bgColor,
                color: typeConfig.color,
                padding: '14px 20px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                minWidth: '280px',
                maxWidth: '400px',
                animation: 'slideInRight 0.3s ease-out',
                pointerEvents: 'auto',
                cursor: 'pointer',
                border: `1px solid ${typeConfig.color}30`,
                transform: `translateY(${index * 0}px)`
              }}
              onClick={() => removeToast(toast.id)}
            >
              <span style={{
                fontSize: '18px',
                fontWeight: 'bold',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: typeConfig.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {typeConfig.icon}
              </span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: 500 }}>
                {toast.message}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeToast(toast.id); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: typeConfig.color,
                  fontSize: '18px',
                  cursor: 'pointer',
                  opacity: 0.6,
                  padding: '0',
                  marginLeft: '8px'
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      
      {/* Стили анимации */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

