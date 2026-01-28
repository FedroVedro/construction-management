import React, { useState } from 'react';

/**
 * Красивая кнопка добавления строки под таблицей
 * Используется во всех графиках отделов
 */
const AddRowButton = ({ onClick, disabled = false, label = 'Добавить строку' }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  if (disabled) return null;

  return (
    <div 
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: isHovered ? 'rgba(0, 123, 255, 0.03)' : 'transparent',
        borderTop: '2px dashed var(--border-color)',
        transition: 'all 0.2s ease',
        marginTop: '-1px'
      }}
    >
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          padding: '12px 32px',
          fontSize: '14px',
          fontWeight: '600',
          color: isHovered ? '#fff' : '#007bff',
          backgroundColor: isHovered ? '#007bff' : 'transparent',
          border: `2px solid ${isHovered ? '#007bff' : '#007bff'}`,
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          transform: isPressed ? 'scale(0.98)' : 'scale(1)',
          boxShadow: isHovered ? '0 4px 12px rgba(0, 123, 255, 0.25)' : 'none',
          minWidth: '200px'
        }}
      >
        <span style={{ 
          fontSize: '20px',
          lineHeight: 1,
          transition: 'transform 0.2s ease',
          transform: isHovered ? 'rotate(90deg)' : 'rotate(0deg)'
        }}>
          +
        </span>
        <span>{label}</span>
      </button>
    </div>
  );
};

/**
 * Компактная версия кнопки для размещения внутри строки таблицы
 */
export const AddRowButtonCompact = ({ onClick, disabled = false, colSpan = 1 }) => {
  const [isHovered, setIsHovered] = useState(false);

  if (disabled) return null;

  return (
    <tr>
      <td 
        colSpan={colSpan}
        style={{ 
          padding: 0,
          border: '1px solid var(--border-color)',
          backgroundColor: isHovered ? 'rgba(0, 123, 255, 0.05)' : 'var(--table-stripe)'
        }}
      >
        <button
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
            color: isHovered ? '#007bff' : '#6c757d',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ 
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: isHovered ? '#007bff' : '#e9ecef',
            color: isHovered ? '#fff' : '#6c757d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            transition: 'all 0.2s ease'
          }}>
            +
          </span>
          <span>Добавить новую строку</span>
        </button>
      </td>
    </tr>
  );
};

export default AddRowButton;
