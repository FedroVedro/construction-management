import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import client from '../api/client';

const StageAutocomplete = ({ value, onChange, onBlur, autoFocus = false }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [allStages, setAllStages] = useState([]);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);
  const wrapperRef = useRef(null);
  const dropdownRef = useRef(null);
  const isMouseDownOnDropdown = useRef(false);

  // Загружаем все этапы при монтировании компонента
  useEffect(() => {
    const fetchStages = async () => {
      try {
        const response = await client.get('/construction-stages?active_only=true');
        setAllStages(response.data);
      } catch (error) {
        console.error('Error fetching stages:', error);
      }
    };
    fetchStages();
  }, []);

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
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
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
    if (!showSuggestions || suggestions.length === 0) return;

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
    }
  };

  // Выбор этапа
  const selectStage = (stage) => {
    setInputValue(stage.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onChange(stage.name);
  };

  // Обработка потери фокуса
  const handleInputBlur = () => {
    // Не закрываем dropdown если кликнули по нему
    if (isMouseDownOnDropdown.current) {
      isMouseDownOnDropdown.current = false;
      inputRef.current?.focus();
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
        }
      } else {
        onChange('');
      }
      
      setShowSuggestions(false);
      if (onBlur) onBlur();
    }, 200);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onClick={handleInputClick}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        placeholder="Кликните или начните вводить название этапа..."
        autoFocus={autoFocus}
        style={{
          width: '100%',
          border: '2px solid #007bff',
          padding: '4px',
          fontSize: '14px',
          cursor: 'text'
        }}
      />
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
  onHover 
}) => {
  return ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: position.width,
        zIndex: 99999,
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderTop: 'none',
        maxHeight: '200px',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        borderRadius: '0 0 4px 4px'
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
    >
      {suggestions.map((stage, index) => (
        <div
          key={stage.id}
          onClick={() => onSelect(stage)}
          onMouseEnter={() => onHover(index)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            backgroundColor: index === selectedIndex ? '#007bff' : 'white',
            color: index === selectedIndex ? 'white' : 'black',
            borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none',
            transition: 'background-color 0.1s ease',
            userSelect: 'none'
          }}
        >
          <div style={{ fontWeight: 'bold', pointerEvents: 'none' }}>
            {stage.name}
          </div>
          {stage.description && (
            <div style={{
              fontSize: '12px',
              color: index === selectedIndex ? '#e0e0e0' : '#666',
              marginTop: '2px',
              pointerEvents: 'none'
            }}>
              {stage.description}
            </div>
          )}
        </div>
      ))}
    </div>,
    document.body
  );
};

export default StageAutocomplete;