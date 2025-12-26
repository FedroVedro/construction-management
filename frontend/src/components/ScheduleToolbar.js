import React, { useState, useEffect, useRef } from 'react';
import { exportToCSV, exportToExcel } from '../utils/scheduleHelpers';

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
  const menuRef = useRef(null);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportMenu]);

  const getExportFilename = (ext) => {
    const city = cities.find(c => c.id === selectedCity);
    const cityName = city ? city.name : 'all';
    const date = new Date().toISOString().split('T')[0];
    return `${filename}_${cityName}_${date}.${ext}`;
  };

  const handleExportCSV = () => {
    exportToCSV(schedules, columns, getExportFilename('csv'));
    setShowExportMenu(false);
  };

  const handleExportExcel = () => {
    const sheetName = getScheduleTypeName(scheduleType);
    exportToExcel(schedules, columns, getExportFilename('xlsx'), sheetName);
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
            <div 
              ref={menuRef}
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px var(--shadow-color)',
                zIndex: 100,
                minWidth: '180px',
                overflow: 'hidden'
              }}
            >
              <ExportMenuItem
                icon="📊"
                label="Экспорт в Excel"
                sublabel=".xlsx"
                onClick={handleExportExcel}
                color="#217346"
              />
              <ExportMenuItem
                icon="📄"
                label="Экспорт в CSV"
                sublabel=".csv"
                onClick={handleExportCSV}
                color="#6c757d"
              />
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

const ExportMenuItem = ({ icon, label, sublabel, onClick, color }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
        padding: '12px 16px',
        border: 'none',
        backgroundColor: isHovered ? 'var(--table-hover)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: '14px',
        color: 'var(--text-primary)',
        transition: 'background-color 0.15s'
      }}
    >
      <span style={{ 
        fontSize: '18px',
        width: '24px',
        textAlign: 'center'
      }}>
        {icon}
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {sublabel && (
          <div style={{ 
            fontSize: '11px', 
            color: color || 'var(--text-muted)',
            marginTop: '2px'
          }}>
            {sublabel}
          </div>
        )}
      </div>
    </button>
  );
};

const getScheduleTypeName = (type) => {
  const names = {
    construction: 'Строительство',
    document: 'Документация',
    procurement: 'Закупки',
    hr: 'HR',
    marketing: 'Маркетинг',
    directive: 'Директивный'
  };
  return names[type] || 'График';
};

export default ScheduleToolbar;

