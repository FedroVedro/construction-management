import React, { useState } from 'react';
import { exportToCSV } from '../utils/scheduleHelpers';

/**
 * Панель инструментов для графиков
 */
const ScheduleToolbar = ({
  schedules,
  columns,
  filename,
  onAddRow,
  onRefresh,
  canEdit = false,
  scheduleType = 'schedule',
  cities = [],
  selectedCity = null,
  onCityChange = null,
  showCalendar = false,
  onToggleCalendar = null
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExportCSV = () => {
    const city = cities.find(c => c.id === selectedCity);
    const cityName = city ? city.name : 'all';
    const date = new Date().toISOString().split('T')[0];
    const exportFilename = `${filename}_${cityName}_${date}.csv`;
    
    exportToCSV(schedules, columns, exportFilename);
    setShowExportMenu(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 16px',
      backgroundColor: 'var(--table-stripe)',
      borderRadius: '8px',
      marginBottom: '16px',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Левая часть - табы городов и информация */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        {/* Счётчик записей */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '20px',
          fontSize: '13px',
          color: 'var(--text-secondary)'
        }}>
          <span style={{ fontSize: '16px' }}>📋</span>
          <span>Записей: <strong style={{ color: 'var(--text-primary)' }}>{schedules.length}</strong></span>
        </div>

        {/* Статистика */}
        <ScheduleStats schedules={schedules} />
      </div>

      {/* Правая часть - кнопки действий */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Кнопка обновления */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            title="Обновить данные"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            🔄 Обновить
          </button>
        )}

        {/* Экспорт */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            📥 Экспорт
          </button>
          
          {showExportMenu && (
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
              minWidth: '160px',
              overflow: 'hidden'
            }}>
              <button
                onClick={handleExportCSV}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '10px 16px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--table-hover)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              >
                📄 Экспорт в CSV
              </button>
            </div>
          )}
        </div>

        {/* Переключатель вида */}
        {onToggleCalendar && (
          <button
            onClick={onToggleCalendar}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            {showCalendar ? '📊 Таблица' : '📅 Календарь'}
          </button>
        )}

        {/* Добавить строку */}
        {canEdit && onAddRow && (
          <button
            onClick={onAddRow}
            className="btn btn-primary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            ➕ Добавить строку
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Компонент статистики
 */
const ScheduleStats = ({ schedules }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Считаем статистику
  const stats = schedules.reduce((acc, s) => {
    const actualEnd = s.actual_end_date ? new Date(s.actual_end_date) : null;
    const plannedEnd = s.planned_end_date ? new Date(s.planned_end_date) : null;
    const actualStart = s.actual_start_date ? new Date(s.actual_start_date) : null;

    if (actualEnd) {
      acc.completed++;
      if (plannedEnd && actualEnd > plannedEnd) {
        acc.delayed++;
      }
    } else if (actualStart) {
      acc.inProgress++;
      if (plannedEnd && today > plannedEnd) {
        acc.overdue++;
      }
    } else {
      acc.notStarted++;
    }

    return acc;
  }, { completed: 0, inProgress: 0, notStarted: 0, delayed: 0, overdue: 0 });

  if (schedules.length === 0) return null;

  return (
    <div style={{ 
      display: 'flex', 
      gap: '12px', 
      fontSize: '12px',
      flexWrap: 'wrap'
    }}>
      {stats.completed > 0 && (
        <StatBadge 
          icon="✓" 
          count={stats.completed} 
          label="завершено" 
          color="#28a745" 
        />
      )}
      {stats.inProgress > 0 && (
        <StatBadge 
          icon="🔄" 
          count={stats.inProgress} 
          label="в работе" 
          color="#ffc107" 
        />
      )}
      {stats.overdue > 0 && (
        <StatBadge 
          icon="🔴" 
          count={stats.overdue} 
          label="просрочено" 
          color="#dc3545" 
        />
      )}
      {stats.notStarted > 0 && (
        <StatBadge 
          icon="📋" 
          count={stats.notStarted} 
          label="ожидает" 
          color="#6c757d" 
        />
      )}
    </div>
  );
};

const StatBadge = ({ icon, count, label, color }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 8px',
    backgroundColor: `${color}15`,
    borderRadius: '12px',
    color: color
  }}>
    <span>{icon}</span>
    <span style={{ fontWeight: 600 }}>{count}</span>
    <span style={{ opacity: 0.8 }}>{label}</span>
  </div>
);

export default ScheduleToolbar;

