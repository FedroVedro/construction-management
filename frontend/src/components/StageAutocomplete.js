import React, { useState, useEffect, useRef } from 'react';
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
  const isClickingDropdown = useRef(false);

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

  // Устанавливаем начальное значение при изменении props.value
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Фильтрация предложений по введённому тексту
  useEffect(() => {
    if (inputValue && allStages.length > 0) {
      const filtered = allStages.filter(stage =>
        stage.name.toLowerCase().includes(inputValue.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, allStages]);

  // Закрываем dropdown при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        const dropdownElement = document.querySelector('[data-stage-dropdown="true"]');
        if (dropdownElement && dropdownElement.contains(event.target)) {
          return;
        }
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Вычисление позиции дропдауна
  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width
      });
    }
  };

  // Обновляем позицию dropdown при показе, прокрутке и изменении размера
  useEffect(() => {
    updatePosition();
    if (showSuggestions) {
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
    }
    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showSuggestions]);

  // Обработка клавиш для навигации по списку
  const handleKeyDown = (e) => {
    if (!showSuggestions) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev < suggestions.length - 1 ? prev + 1 : prev;
          setTimeout(() => {
            const dropdown = document.querySelector('[data-stage-dropdown="true"]');
            const selectedElement = dropdown?.children[newIndex];
            if (selectedElement) {
              selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
          }, 0);
          return newIndex;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : -1;
          if (newIndex >= 0) {
            setTimeout(() => {
              const dropdown = document.querySelector('[data-stage-dropdown="true"]');
              const selectedElement = dropdown?.children[newIndex];
              if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }, 0);
          }
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
        break;
    }
  };

  // Выбор этапа
  const selectStage = (stage) => {
    setInputValue(stage.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    onChange(stage.name);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Обработка потери фокуса
  const handleInputBlur = () => {
    if (isClickingDropdown.current) {
      return;
    }
    setTimeout(() => {
      const exactMatch = allStages.find(s =>
        s.name.toLowerCase() === inputValue.toLowerCase()
      );
      if (exactMatch) {
        setInputValue(exactMatch.name);
        onChange(exactMatch.name);
      } else if (inputValue) {
        const partialMatch = allStages.find(s =>
          s.name.toLowerCase().includes(inputValue.toLowerCase())
        );
        if (partialMatch && suggestions.length === 1) {
          setInputValue(partialMatch.name);
          onChange(partialMatch.name);
        } else {
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

  // Обработка изменения текста
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedIndex(-1);
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: '100%', cursor: 'text' }}
      onClick={() => {
        updatePosition();
        setShowSuggestions(true);
        inputRef.current?.focus();
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        onFocus={() => {
          updatePosition();
          setShowSuggestions(true);
        }}
        placeholder="Начните вводить название этапа..."
        autoFocus={autoFocus}
        style={{
          width: '100%',
          border: '2px solid #007bff',
          padding: '4px',
          fontSize: '14px'
        }}
      />
      <Dropdown />
    </div>
  );

  // Вспомогательный Dropdown компонент
  function Dropdown() {
    if (!showSuggestions || suggestions.length === 0) return null;
    return ReactDOM.createPortal(
      <div
        data-stage-dropdown="true"
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: 99999,
          backgroundColor: 'white',
          border: '1px solid #ddd',
          borderTop: 'none',
          maxHeight: '200px',
          overflowY: 'auto',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          borderRadius: '0 0 4px 4px'
        }}
        onMouseEnter={() => { isClickingDropdown.current = true; }}
        onMouseLeave={() => { isClickingDropdown.current = false; }}
      >
        {suggestions.map((stage, index) => (
          <div
            key={stage.id}
            onClick={() => { selectStage(stage); isClickingDropdown.current = false; }}
            onMouseEnter={() => setSelectedIndex(index)}
            style={{
              padding: '8px 12px',
              cursor: 'pointer',
              backgroundColor: index === selectedIndex ? '#007bff' : 'white',
              color: index === selectedIndex ? 'white' : 'black',
              borderBottom: '1px solid #f0f0f0',
              transition: 'background-color 0.1s ease'
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
  }
};

export default StageAutocomplete;
