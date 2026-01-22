import React from 'react';

const StatusBadge = ({ status }) => {
  if (!status) return null;

  // Мягкие пастельные цвета для статусов
  const statusColors = {
    'Завершен': { bg: '#8bc49a', text: '#fff' },
    'Строительство': { bg: '#d4b896', text: '#fff' },
    'Проектирование': { bg: '#7b9eb8', text: '#fff' },
    'Согласование': { bg: '#a99bc4', text: '#fff' },
    'Подготовка': { bg: '#7ab5ad', text: '#fff' },
    'Поиск участка': { bg: '#8b9cc4', text: '#fff' },
    'Приобретение прав на участок': { bg: '#b8a0c4', text: '#fff' },
    'Есть право на зу, ждет реализации': { bg: '#d4a0b8', text: '#fff' },
    'Проектирование, экспертиза, получение РНС': { bg: '#7ab5ad', text: '#fff' },
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
