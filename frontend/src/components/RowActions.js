import React, { useState } from 'react';

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
          onClick={() => setShowMenu(!showMenu)}
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
          <>
            {/* Overlay для закрытия */}
            <div 
              onClick={() => setShowMenu(false)}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99
              }}
            />
            
            {/* Меню */}
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: '0 4px 12px var(--shadow-color)',
              zIndex: 100,
              minWidth: '140px',
              overflow: 'hidden'
            }}>
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
          </>
        )}
      </div>
    </div>
  );
};

const ActionMenuItem = ({ icon, label, onClick, danger = false }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      width: '100%',
      padding: '10px 14px',
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      textAlign: 'left',
      fontSize: '13px',
      color: danger ? '#dc3545' : 'var(--text-primary)',
      transition: 'background-color 0.2s'
    }}
    onMouseEnter={(e) => e.target.style.backgroundColor = danger ? '#f8d7da' : 'var(--table-hover)'}
    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
  >
    <span>{icon}</span>
    <span>{label}</span>
  </button>
);

export default RowActions;

