import React from 'react';

const StatusBadge = ({ status }) => {
  if (!status) return null;

  const statusColors = {
    'Завершен': { bg: '#22c55e', text: '#fff' },
    'Строительство': { bg: '#f59e0b', text: '#fff' },
    'Проектирование': { bg: '#3b82f6', text: '#fff' },
    'Согласование': { bg: '#8b5cf6', text: '#fff' },
    'Подготовка': { bg: '#06b6d4', text: '#fff' },
    'Поиск участка': { bg: '#6366f1', text: '#fff' },
    'Приобретение прав на участок': { bg: '#a855f7', text: '#fff' },
    'Есть право на зу, ждет реализации': { bg: '#ec4899', text: '#fff' },
    'Проектирование, экспертиза, получение РНС': { bg: '#14b8a6', text: '#fff' },
  };

  const colors = statusColors[status] || { bg: '#64748b', text: '#fff' };

  return (
    <span
      style={{
        backgroundColor: colors.bg,
        color: colors.text,
        padding: '2px 6px',
        borderRadius: '6px',
        fontSize: '10px',
        fontWeight: '600',
        marginLeft: '6px',
        display: 'inline-block',
        whiteSpace: 'nowrap',
        verticalAlign: 'middle',
        lineHeight: '1'
      }}
      title={`Статус: ${status}`}
    >
      {status}
    </span>
  );
};

export default StatusBadge;
