import React, { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Компонент действий со строкой (копирование, удаление и т.д.)
 */
const RowActions = ({
  onCopy,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  isNew = false
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: Math.max(10, rect.right - 150)
      });
    }
  }, []);

  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) &&
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleToggleMenu = () => {
    updateMenuPosition();
    setShowMenu(!showMenu);
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '4px', 
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Кнопки перемещения */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <button
          onClick={onMoveUp}
          disabled={!canMoveUp}
          className="btn btn-sm"
          style={{ 
            padding: '2px 6px', 
            fontSize: '10px',
            opacity: canMoveUp ? 1 : 0.4,
            lineHeight: 1
          }}
          title="Переместить вверх"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={!canMoveDown}
          className="btn btn-sm"
          style={{ 
            padding: '2px 6px', 
            fontSize: '10px',
            opacity: canMoveDown ? 1 : 0.4,
            lineHeight: 1
          }}
          title="Переместить вниз"
        >
          ▼
        </button>
      </div>

      {/* Меню действий */}
      <div style={{ position: 'relative' }}>
        <button
          ref={buttonRef}
          onClick={handleToggleMenu}
          className="btn btn-sm"
          style={{ 
            padding: '4px 8px',
            fontSize: '14px'
          }}
          title="Действия"
        >
          ⋮
        </button>

        {showMenu && (
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              top: menuPosition.top,
              left: menuPosition.left,
              zIndex: 99999,
              backgroundColor: 'var(--bg-card, white)',
              border: '1px solid var(--border-color, #dee2e6)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              minWidth: '140px',
              overflow: 'hidden'
            }}
          >
            {onCopy && (
              <ActionMenuItem
                icon="📋"
                label="Копировать"
                onClick={() => {
                  onCopy();
                  setShowMenu(false);
                }}
              />
            )}
            
            {onDelete && (
              <ActionMenuItem
                icon="🗑️"
                label="Удалить"
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
                danger
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ActionMenuItem = ({ icon, label, onClick, danger = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '10px 14px',
        border: 'none',
        backgroundColor: isHovered ? (danger ? '#f8d7da' : 'var(--table-hover, #e9ecef)') : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '13px',
        color: danger ? '#dc3545' : 'var(--text-primary, #212529)',
        transition: 'background-color 0.15s ease'
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
};

export default RowActions;
