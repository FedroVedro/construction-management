import React from 'react';

const ScheduleFilters = ({ 
  stages = [], 
  selectedStage, 
  onStageChange, 
  searchText, 
  onSearchChange,
  showOnlyDelayed,
  onDelayedChange,
  customFilters = null 
}) => {
  const hasActiveFilters = selectedStage || searchText || showOnlyDelayed;

  const clearAllFilters = () => {
    onStageChange('');
    onSearchChange('');
    onDelayedChange(false);
  };

  return (
    <div style={{ 
      padding: '16px', 
      backgroundColor: 'var(--table-stripe)', 
      borderRadius: '8px',
      marginBottom: '16px',
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap',
      alignItems: 'flex-end'
    }}>
      {/* Фильтр по этапу строительства */}
      <div style={{ minWidth: '220px' }}>
        <label style={{ 
          fontSize: '12px', 
          color: 'var(--text-muted)', 
          display: 'flex', 
          alignItems: 'center',
          gap: '4px',
          marginBottom: '6px' 
        }}>
          📋 Этап строительства
        </label>
        <select 
          value={selectedStage || ''} 
          onChange={(e) => onStageChange(e.target.value)}
          className="form-control"
          style={{ fontSize: '14px' }}
        >
          <option value="">Все этапы</option>
          {stages.map((stage, index) => (
            <option key={stage.id} value={stage.name}>
              {index + 1}. {stage.name}
            </option>
          ))}
        </select>
      </div>

      {/* Поиск */}
      <div style={{ minWidth: '220px', flex: 1, maxWidth: '400px' }}>
        <label style={{ 
          fontSize: '12px', 
          color: 'var(--text-muted)', 
          display: 'flex', 
          alignItems: 'center',
          gap: '4px',
          marginBottom: '6px' 
        }}>
          🔍 Поиск
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Введите для поиска..."
            value={searchText}
            onChange={(e) => onSearchChange(e.target.value)}
            className="form-control"
            style={{ 
              fontSize: '14px',
              paddingRight: searchText ? '32px' : '12px'
            }}
          />
          {searchText && (
            <button
              onClick={() => onSearchChange('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '16px',
                padding: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Очистить поиск"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Показать только с задержкой */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          cursor: 'pointer',
          padding: '8px 12px',
          backgroundColor: showOnlyDelayed ? '#f8d7da' : 'var(--bg-card)',
          borderRadius: '8px',
          border: showOnlyDelayed ? '1px solid #dc3545' : '1px solid var(--border-color)',
          transition: 'all 0.2s ease',
          gap: '8px'
        }}>
          <input
            type="checkbox"
            checked={showOnlyDelayed}
            onChange={(e) => onDelayedChange(e.target.checked)}
            style={{ 
              width: '16px', 
              height: '16px',
              accentColor: '#dc3545'
            }}
          />
          <span style={{ 
            fontSize: '14px', 
            color: showOnlyDelayed ? '#dc3545' : 'var(--text-primary)',
            fontWeight: showOnlyDelayed ? 600 : 400
          }}>
            ⚠️ Только с задержкой
          </span>
        </label>
      </div>

      {/* Кнопка сброса */}
      {hasActiveFilters && (
        <button
          onClick={clearAllFilters}
          className="btn btn-secondary btn-sm"
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            whiteSpace: 'nowrap'
          }}
        >
          ✕ Сбросить фильтры
        </button>
      )}

      {/* Дополнительные фильтры */}
      {customFilters}
    </div>
  );
};

export default ScheduleFilters;
