import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Хук для горячих клавиш
export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);

  const handleKeyDown = useCallback((event) => {
    // Игнорируем, если фокус на инпуте или textarea
    const target = event.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // Ctrl/Cmd + сочетания
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'h':
          event.preventDefault();
          navigate('/');
          break;
        case 'b':
          event.preventDefault();
          navigate('/construction-schedule');
          break;
        case 'p':
          event.preventDefault();
          navigate('/project-office');
          break;
        case 'd':
          event.preventDefault();
          navigate('/document-schedule');
          break;
        case '/':
          event.preventDefault();
          setShowHelp(prev => !prev);
          break;
        default:
          break;
      }
    }

    // Обычные клавиши (без модификаторов)
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      switch (event.key) {
        case '?':
          setShowHelp(prev => !prev);
          break;
        case 'Escape':
          setShowHelp(false);
          break;
        default:
          break;
      }
    }
  }, [navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
};

// Компонент справки по горячим клавишам
export const KeyboardShortcutsHelp = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: 'Ctrl + H', description: 'Главная страница' },
    { keys: 'Ctrl + B', description: 'График строительства' },
    { keys: 'Ctrl + P', description: 'Проектный офис' },
    { keys: 'Ctrl + D', description: 'График документации' },
    { keys: '?', description: 'Показать/скрыть справку' },
    { keys: 'Esc', description: 'Закрыть диалоги' }
  ];

  return (
    <>
      {/* Overlay */}
      <div 
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 9998
        }}
      />
      
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'var(--bg-card, white)',
        borderRadius: '12px',
        padding: '24px',
        zIndex: 9999,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        minWidth: '360px',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          <h2 style={{ 
            margin: 0, 
            color: 'var(--text-primary, #212529)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            ⌨️ Горячие клавиши
          </h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted, #6c757d)',
              padding: '0'
            }}
          >
            ×
          </button>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shortcuts.map((shortcut, index) => (
            <div 
              key={index}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < shortcuts.length - 1 ? '1px solid var(--border-color, #dee2e6)' : 'none'
              }}
            >
              <span style={{ color: 'var(--text-secondary, #495057)' }}>
                {shortcut.description}
              </span>
              <kbd style={{
                backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                color: 'var(--text-primary, #212529)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}>
                {shortcut.keys}
              </kbd>
            </div>
          ))}
        </div>
        
        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: 'var(--bg-secondary, #f8f9fa)',
          borderRadius: '8px',
          fontSize: '13px',
          color: 'var(--text-muted, #6c757d)'
        }}>
          💡 Нажмите <kbd style={{
            backgroundColor: 'var(--bg-card, white)',
            border: '1px solid var(--border-color, #dee2e6)',
            borderRadius: '3px',
            padding: '2px 6px',
            fontSize: '11px',
            fontFamily: 'monospace'
          }}>?</kbd> в любой момент для вызова этой справки
        </div>
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
};

