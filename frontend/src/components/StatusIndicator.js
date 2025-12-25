import React from 'react';
import { getRowStatus } from '../utils/scheduleHelpers';

/**
 * Индикатор статуса строки
 */
const StatusIndicator = ({ schedule, showLabel = false, size = 'normal' }) => {
  const status = getRowStatus(schedule);
  
  if (status.status === 'unknown' || !status.icon) {
    return null;
  }

  const sizeStyles = {
    small: { fontSize: '12px', padding: '2px 6px' },
    normal: { fontSize: '14px', padding: '4px 8px' },
    large: { fontSize: '16px', padding: '6px 12px' }
  };

  const style = sizeStyles[size] || sizeStyles.normal;

  return (
    <div
      title={status.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: status.bgColor,
        color: status.color,
        borderRadius: '12px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        ...style
      }}
    >
      <span>{status.icon}</span>
      {showLabel && <span>{status.label}</span>}
    </div>
  );
};

/**
 * Получение стиля для строки таблицы на основе статуса
 */
export const getRowStatusStyle = (schedule) => {
  const status = getRowStatus(schedule);
  
  return {
    backgroundColor: status.bgColor,
    borderLeft: `3px solid ${status.color}`
  };
};

/**
 * Компонент полосы прогресса для строки
 */
export const ProgressBar = ({ schedule }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const plannedStart = schedule.planned_start_date ? new Date(schedule.planned_start_date) : null;
  const plannedEnd = schedule.planned_end_date ? new Date(schedule.planned_end_date) : null;
  const actualEnd = schedule.actual_end_date ? new Date(schedule.actual_end_date) : null;
  
  if (!plannedStart || !plannedEnd) return null;
  
  // Если завершено
  if (actualEnd) {
    return (
      <div style={{
        width: '100%',
        height: '4px',
        backgroundColor: '#e9ecef',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: actualEnd <= plannedEnd ? '#28a745' : '#dc3545',
          borderRadius: '2px'
        }} />
      </div>
    );
  }
  
  // Вычисляем прогресс по времени
  const totalDays = (plannedEnd - plannedStart) / (1000 * 60 * 60 * 24);
  const elapsedDays = (today - plannedStart) / (1000 * 60 * 60 * 24);
  
  let progress = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));
  
  // Если просрочено
  const isOverdue = today > plannedEnd;
  
  return (
    <div style={{
      width: '100%',
      height: '4px',
      backgroundColor: '#e9ecef',
      borderRadius: '2px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${progress}%`,
        height: '100%',
        backgroundColor: isOverdue ? '#dc3545' : '#ffc107',
        borderRadius: '2px',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
};

export default StatusIndicator;

