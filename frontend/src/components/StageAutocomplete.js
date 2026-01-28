import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';

// Цвета для этапов строительства (циклически)
const STAGE_COLORS = [
  { bg: '#e3f2fd', border: '#2196f3', text: '#1565c0' }, // Синий
  { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' }, // Зеленый
  { bg: '#fff3e0', border: '#ff9800', text: '#e65100' }, // Оранжевый
  { bg: '#f3e5f5', border: '#9c27b0', text: '#6a1b9a' }, // Фиолетовый
  { bg: '#e0f7fa', border: '#00bcd4', text: '#00838f' }, // Бирюзовый
  { bg: '#fce4ec', border: '#e91e63', text: '#c2185b' }, // Розовый
  { bg: '#fff8e1', border: '#ffc107', text: '#ff8f00' }, // Желтый
  { bg: '#e8eaf6', border: '#3f51b5', text: '#283593' }, // Индиго
  { bg: '#efebe9', border: '#795548', text: '#4e342e' }, // Коричневый
  { bg: '#eceff1', border: '#607d8b', text: '#37474f' }, // Серо-синий
];

const getStageColor = (index) => {
  return STAGE_COLORS[index % STAGE_COLORS.length];
};

const StageAutocomplete = ({ value, onChange, onBlur, autoFocus = false, stages = [] }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, openUpward: false, inputHeight: 0 });
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const isMouseDownOnDropdown = useRef(false);
  const hasSelectedStage = useRef(false);

  // Используем stages из props - НЕ загружаем каждый раз!
  // Добавляем индексы к этапам для отображения номеров
  const allStages = stages.map((stage, index) => ({
    ...stage,
    displayIndex: index + 1,
    color: getStageColor(index)
  }));

  // Устанавливаем начальное значение
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Обработка клика вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Проверяем клик вне wrapper и вне dropdown
      const dropdownEl = dropdownRef.current;
      if (wrapperRef.current && 
          !wrapperRef.current.contains(event.target) && 
          (!dropdownEl || !dropdownEl.contains(event.target))) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Вычисление позиции дропдауна
  const updatePosition = useCallback(() => {
    if (inputRef.current && showSuggestions) {
      const rect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownMaxHeight = 350; // Максимальная высота dropdown
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // Определяем, нужно ли открывать вверх
      const openUpward = spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow;
      
      setDropdownPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: rect.left,
        width: rect.width,
        openUpward,
        inputHeight: rect.height
      });
    }
  }, [showSuggestions]);

  // Обновляем позицию при скролле окна
  useEffect(() => {
    if (showSuggestions) {
      updatePosition();
      const handleScroll = () => updatePosition();
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [showSuggestions, updatePosition]);

  // Фильтрация предложений
  const filterSuggestions = useCallback((searchValue) => {
    if (!searchValue || searchValue.trim() === '') {
      return allStages;
    }
    return allStages.filter(stage =>
      stage.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [allStages]);

  // Обработка клика на поле ввода
  const handleInputClick = () => {
    if (!showSuggestions) {
      // При клике показываем все этапы
      setSuggestions(allStages);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    }
  };

  // Обработка изменения текста
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    hasSelectedStage.current = false;
    
    // Фильтруем предложения
    const filtered = filterSuggestions(newValue);
    setSuggestions(filtered);
    
    // Показываем dropdown если есть предложения
    if (filtered.length > 0) {
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  // Обработка фокуса
  const handleInputFocus = () => {
    // При фокусе показываем либо отфильтрованные, либо все этапы
    const filtered = filterSuggestions(inputValue);
    setSuggestions(filtered);
    if (filtered.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Обработка клавиш
  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      // Если нажат Enter и dropdown закрыт, вызываем onChange с текущим значением
      if (e.key === 'Enter') {
        e.preventDefault();
        const exactMatch = allStages.find(s =>
          s.name.toLowerCase() === inputValue.toLowerCase()
        );
        if (exactMatch) {
          selectStage(exactMatch);
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < suggestions.length - 1 ? prev + 1 : 0;
          // Прокручиваем к выбранному элементу после обновления состояния
          requestAnimationFrame(() => {
            if (dropdownRef.current && dropdownRef.current.children[newIndex]) {
              const element = dropdownRef.current.children[newIndex];
              const container = dropdownRef.current;
              const elementTop = element.offsetTop;
              const elementBottom = elementTop + element.offsetHeight;
              const containerTop = container.scrollTop;
              const containerBottom = containerTop + container.clientHeight;
              
              if (elementBottom > containerBottom) {
                container.scrollTop = elementBottom - container.clientHeight;
              } else if (elementTop < containerTop) {
                container.scrollTop = elementTop;
              }
            }
          });
          return newIndex;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : suggestions.length - 1;
          requestAnimationFrame(() => {
            if (dropdownRef.current && dropdownRef.current.children[newIndex]) {
              const element = dropdownRef.current.children[newIndex];
              const container = dropdownRef.current;
              const elementTop = element.offsetTop;
              const elementBottom = elementTop + element.offsetHeight;
              const containerTop = container.scrollTop;
              const containerBottom = containerTop + container.clientHeight;
              
              if (elementTop < containerTop) {
                container.scrollTop = elementTop;
              } else if (elementBottom > containerBottom) {
                container.scrollTop = elementBottom - container.clientHeight;
              }
            }
          });
          return newIndex;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          selectStage(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          selectStage(suggestions[0]);
        } else {
          // Ищем точное совпадение
          const exactMatch = suggestions.find(s =>
            s.name.toLowerCase() === inputValue.toLowerCase()
          );
          if (exactMatch) {
            selectStage(exactMatch);
          }
        }
        break;

      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;

      case 'Tab':
        if (suggestions.length === 1) {
          e.preventDefault();
          selectStage(suggestions[0]);
        }
        break;

      default:
        // Игнорируем другие клавиши
        break;
    }
  };

  // Выбор этапа
  const selectStage = (stage) => {
    setInputValue(stage.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    hasSelectedStage.current = true;
    // Вызываем onChange с задержкой, чтобы избежать конфликтов
    setTimeout(() => {
      onChange(stage.name);
    }, 10);
  };

  // Обработка потери фокуса
  const handleInputBlur = () => {
    // Не закрываем dropdown если кликнули по нему
    if (isMouseDownOnDropdown.current) {
      isMouseDownOnDropdown.current = false;
      inputRef.current?.focus();
      return;
    }
    
    // Если уже выбран этап, не делаем ничего
    if (hasSelectedStage.current) {
      hasSelectedStage.current = false;
      setShowSuggestions(false);
      if (onBlur) onBlur();
      return;
    }
    
    setTimeout(() => {
      // Проверяем точное совпадение
      const exactMatch = allStages.find(s =>
        s.name.toLowerCase() === inputValue.toLowerCase()
      );
      
      if (exactMatch) {
        setInputValue(exactMatch.name);
        onChange(exactMatch.name);
      } else if (inputValue) {
        // Если введен текст, но нет точного совпадения
        const filtered = filterSuggestions(inputValue);
        if (filtered.length === 1) {
          // Если есть только одно предложение, выбираем его
          setInputValue(filtered[0].name);
          onChange(filtered[0].name);
        } else if (filtered.length === 0) {
          // Если нет совпадений
          alert('Пожалуйста, выберите этап из списка');
          setInputValue('');
          onChange('');
        } else {
          // Если несколько совпадений, не меняем значение
          // Пользователь должен выбрать конкретный этап
        }
      } else {
        onChange('');
      }
      
      setShowSuggestions(false);
      if (onBlur) onBlur();
    }, 200);
  };

  // Находим цвет текущего выбранного этапа
  const currentStageIndex = allStages.findIndex(s => s.name === inputValue);
  const currentColor = currentStageIndex >= 0 ? allStages[currentStageIndex].color : null;

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {currentColor && (
          <div style={{
            position: 'absolute',
            left: '8px',
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: currentColor.bg,
            border: `2px solid ${currentColor.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '700',
            color: currentColor.text,
            zIndex: 1,
            pointerEvents: 'none'
          }}>
            {currentStageIndex + 1}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          onBlur={handleInputBlur}
          placeholder="Выберите этап строительства..."
          autoFocus={autoFocus}
          style={{
            width: '100%',
            padding: currentColor ? '6px 8px 6px 40px' : '6px 8px',
            fontSize: '14px',
            cursor: 'pointer',
            border: currentColor ? `1px solid ${currentColor.border}` : '1px solid #ddd',
            borderRadius: '6px',
            backgroundColor: currentColor ? currentColor.bg : 'white',
            color: currentColor ? currentColor.text : 'inherit',
            fontWeight: currentColor ? '500' : 'normal',
            transition: 'all 0.2s ease'
          }}
        />
        <div style={{
          position: 'absolute',
          right: '8px',
          pointerEvents: 'none',
          color: '#999',
          fontSize: '10px'
        }}>
          ▼
        </div>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <DropdownPortal
          dropdownRef={dropdownRef}
          position={dropdownPosition}
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onMouseDown={() => { isMouseDownOnDropdown.current = true; }}
          onMouseUp={() => { isMouseDownOnDropdown.current = false; }}
          onSelect={selectStage}
          onHover={setSelectedIndex}
          allStages={allStages}
        />
      )}
    </div>
  );
};

// Отдельный компонент для портала
const DropdownPortal = ({ 
  dropdownRef, 
  position, 
  suggestions, 
  selectedIndex, 
  onMouseDown,
  onMouseUp,
  onSelect, 
  onHover,
  allStages 
}) => {
  const { openUpward } = position;
  const maxHeight = 350;
  
  // Вычисляем доступную высоту
  const availableHeight = openUpward 
    ? position.top - 8 
    : window.innerHeight - position.top - 8;
  const actualMaxHeight = Math.min(maxHeight, availableHeight);
  
  return ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        ...(openUpward 
          ? { bottom: window.innerHeight - position.top + 4 }
          : { top: position.top + 4 }
        ),
        left: position.left,
        width: Math.max(position.width, 320),
        zIndex: 99999,
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        maxHeight: `${actualMaxHeight}px`,
        overflowY: 'auto',
        overflowX: 'hidden',
        boxShadow: openUpward 
          ? '0 -8px 24px rgba(0,0,0,0.15)' 
          : '0 8px 24px rgba(0,0,0,0.15)',
        borderRadius: '10px'
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {/* Заголовок списка */}
      <div style={{
        padding: '12px 16px 8px',
        fontSize: '11px',
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        position: 'sticky',
        top: 0,
        zIndex: 1
      }}>
        Этапы строительства ({suggestions.length})
      </div>
      
      {suggestions.map((stage, index) => {
        // Находим оригинальный индекс этапа в allStages
        const originalIndex = allStages.findIndex(s => s.id === stage.id);
        const stageColor = originalIndex >= 0 ? allStages[originalIndex].color : getStageColor(index);
        const displayNumber = originalIndex >= 0 ? originalIndex + 1 : index + 1;
        
        return (
          <div
            key={stage.id}
            onClick={() => onSelect(stage)}
            onMouseEnter={() => onHover(index)}
            style={{
              padding: '10px 16px',
              cursor: 'pointer',
              backgroundColor: index === selectedIndex ? stageColor.bg : 'white',
              borderLeft: index === selectedIndex ? `4px solid ${stageColor.border}` : '4px solid transparent',
              transition: 'all 0.15s ease',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            {/* Номер этапа */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: stageColor.bg,
              border: `2px solid ${stageColor.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: '700',
              color: stageColor.text,
              flexShrink: 0,
              pointerEvents: 'none'
            }}>
              {displayNumber}
            </div>
            
            {/* Информация об этапе */}
            <div style={{ flex: 1, minWidth: 0, pointerEvents: 'none' }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '14px',
                color: index === selectedIndex ? stageColor.text : '#333',
                marginBottom: stage.description ? '4px' : 0,
                lineHeight: '1.3'
              }}>
                {stage.name}
              </div>
              {stage.description && (
                <div style={{
                  fontSize: '12px',
                  color: '#888',
                  lineHeight: '1.4',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {stage.description}
                </div>
              )}
            </div>
            
            {/* Индикатор выбора */}
            {index === selectedIndex && (
              <div style={{
                color: stageColor.text,
                fontSize: '14px',
                fontWeight: 'bold',
                pointerEvents: 'none'
              }}>
                ✓
              </div>
            )}
          </div>
        );
      })}
      
      {/* Подсказка внизу */}
      <div style={{
        padding: '8px 16px',
        fontSize: '11px',
        color: '#999',
        borderTop: '1px solid #f0f0f0',
        backgroundColor: '#fafafa',
        display: 'flex',
        justifyContent: 'space-between',
        position: 'sticky',
        bottom: 0
      }}>
        <span>↑↓ навигация</span>
        <span>Enter для выбора</span>
        <span>Esc для отмены</span>
      </div>
    </div>,
    document.body
  );
};

export default StageAutocomplete;