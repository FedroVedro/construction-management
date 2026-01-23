import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getQuickDates, formatDateForInput, addDaysToDate } from '../utils/scheduleHelpers';

/**
 * Компонент быстрого выбора дат
 */
const QuickDatePicker = ({ 
  value, 
  onChange, 
  onSave,
  onBlur,
  disabled = false,
  placeholder = '',
  relatedDate = null,
  isEndDate = false
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  
  const quickDates = getQuickDates();

  // Открыть календарь браузера (с проверкой поддержки showPicker)
  const openCalendar = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) {
      // Проверяем поддержку showPicker (не поддерживается в Safari и старых браузерах)
      if (typeof inputRef.current.showPicker === 'function') {
        try {
          inputRef.current.showPicker();
        } catch (err) {
          // Fallback: фокусируемся на input
          inputRef.current.focus();
        }
      } else {
        // Fallback для браузеров без showPicker
        inputRef.current.focus();
        inputRef.current.click();
      }
    }
  }, []);

  const save = useCallback((newValue) => {
    if (onSave) {
      onSave(newValue);
    } else if (onBlur) {
      if (onChange) {
        onChange(newValue);
      }
      setTimeout(() => onBlur(), 0);
    }
  }, [onSave, onBlur, onChange]);

  // Вычисление позиции popup
  const updatePopupPosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 4,
        left: Math.max(10, rect.left - 140) // Смещаем влево чтобы не выходило за экран
      });
    }
  }, []);

  // Закрытие popup при клике вне
  useEffect(() => {
    if (!showPopup) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowPopup(false);
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 0);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [showPopup]);

  const handleQuickDate = useCallback((date) => {
    if (onChange) {
      onChange(date);
    }
    setShowPopup(false);
    
    setTimeout(() => {
      save(date);
    }, 10);
  }, [onChange, save]);

  const handleRelativeDate = useCallback((days) => {
    const baseDate = relatedDate || value || quickDates.today;
    const newDate = addDaysToDate(baseDate, days);
    
    if (onChange) {
      onChange(newDate);
    }
    setShowPopup(false);
    
    setTimeout(() => {
      save(newDate);
    }, 10);
  }, [relatedDate, value, quickDates.today, onChange, save]);

  const togglePopup = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    updatePopupPosition();
    setShowPopup(prev => !prev);
  }, [updatePopupPosition]);

  const handleInputChange = useCallback((e) => {
    const newValue = e.target.value;
    if (onChange) {
      onChange(newValue);
    }
  }, [onChange]);

  const handleInputBlur = useCallback(() => {
    save(value);
  }, [save, value]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="date"
          value={formatDateForInput(value)}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          disabled={disabled}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: '120px' }}
        />
        {!disabled && (
          <>
            <button
              type="button"
              onClick={openCalendar}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Открыть календарь"
            >
              🗓️
            </button>
            <button
              ref={buttonRef}
              type="button"
              onClick={togglePopup}
              style={{
                padding: '4px 8px',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-secondary, #f8f9fa)',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
              title="Быстрый выбор даты"
            >
              ⚡
            </button>
          </>
        )}
      </div>
      
      {showPopup && !disabled && (
        <div
          style={{
            position: 'fixed',
            top: popupPosition.top,
            left: popupPosition.left,
            zIndex: 99999,
            backgroundColor: 'var(--bg-card, white)',
            border: '1px solid var(--border-color, #dee2e6)',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            padding: '10px',
            minWidth: '180px'
          }}
        >
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-muted, #6c757d)', 
            marginBottom: '8px',
            fontWeight: 600,
            paddingBottom: '6px',
            borderBottom: '1px solid var(--border-color, #dee2e6)'
          }}>
            ⚡ Быстрый выбор
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <QuickDateButton 
              onClick={() => handleQuickDate(quickDates.today)}
              label="Сегодня"
              icon="📅"
            />
            <QuickDateButton 
              onClick={() => handleQuickDate(quickDates.tomorrow)}
              label="Завтра"
              icon="➡️"
            />
            <QuickDateButton 
              onClick={() => handleQuickDate(quickDates.nextWeek)}
              label="Через неделю"
              icon="📆"
            />
            <QuickDateButton 
              onClick={() => handleQuickDate(quickDates.nextMonth)}
              label="Через месяц"
              icon="🗓️"
            />
            <QuickDateButton 
              onClick={() => handleQuickDate(quickDates.endOfQuarter)}
              label="Конец квартала"
              icon="📊"
            />
          </div>
          
          {isEndDate && relatedDate && (
            <>
              <div style={{ 
                borderTop: '1px solid var(--border-color, #dee2e6)', 
                marginTop: '8px', 
                paddingTop: '8px',
                fontSize: '12px', 
                color: 'var(--text-muted, #6c757d)',
                marginBottom: '6px',
                fontWeight: 600
              }}>
                📏 От даты начала
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <QuickDateButton 
                  onClick={() => handleRelativeDate(7)}
                  label="+7 дней"
                  icon="➕"
                />
                <QuickDateButton 
                  onClick={() => handleRelativeDate(14)}
                  label="+14 дней"
                  icon="➕"
                />
                <QuickDateButton 
                  onClick={() => handleRelativeDate(30)}
                  label="+30 дней"
                  icon="➕"
                />
                <QuickDateButton 
                  onClick={() => handleRelativeDate(60)}
                  label="+60 дней"
                  icon="➕"
                />
                <QuickDateButton 
                  onClick={() => handleRelativeDate(90)}
                  label="+90 дней"
                  icon="➕"
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const QuickDateButton = ({ onClick, label, icon }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 10px',
        border: 'none',
        borderRadius: '6px',
        backgroundColor: isHovered ? 'var(--table-hover, #e9ecef)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '13px',
        color: 'var(--text-primary, #212529)',
        transition: 'background-color 0.15s ease',
        width: '100%'
      }}
    >
      <span style={{ fontSize: '14px', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
    </button>
  );
};

export default QuickDatePicker;
