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
  return (
    <div style={{ 
      padding: '15px', 
      backgroundColor: '#f8f9fa', 
      borderRadius: '4px',
      marginBottom: '15px',
      display: 'flex',
      gap: '15px',
      flexWrap: 'wrap',
      alignItems: 'center'
    }}>
      {/* Фильтр по этапу строительства */}
      <div style={{ minWidth: '200px' }}>
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
          Этап строительства:
        </label>
        <select 
          value={selectedStage || ''} 
          onChange={(e) => onStageChange(e.target.value)}
          style={{ 
            padding: '6px 10px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            width: '100%',
            fontSize: '14px'
          }}
        >
          <option value="">Все этапы</option>
          {stages.map(stage => (
            <option key={stage.id} value={stage.name}>{stage.name}</option>
          ))}
        </select>
      </div>

      {/* Поиск */}
      <div style={{ minWidth: '200px' }}>
        <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
          Поиск:
        </label>
        <input
          type="text"
          placeholder="Поиск..."
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ 
            padding: '6px 10px', 
            borderRadius: '4px', 
            border: '1px solid #ddd',
            width: '100%',
            fontSize: '14px'
          }}
        />
      </div>

      {/* Показать только с задержкой */}
      <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showOnlyDelayed}
            onChange={(e) => onDelayedChange(e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontSize: '14px' }}>Показать только с задержкой</span>
        </label>
      </div>

      {/* Дополнительные фильтры */}
      {customFilters}
    </div>
  );
};

export default ScheduleFilters;