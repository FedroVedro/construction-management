// Утилиты для сохранения порядка строк в localStorage

const STORAGE_KEY_PREFIX = 'schedule_order_';

export const saveScheduleOrder = (cityId, scheduleType, schedules) => {
  const key = `${STORAGE_KEY_PREFIX}${cityId}_${scheduleType}`;
  const order = schedules.map(s => s.id);
  localStorage.setItem(key, JSON.stringify(order));
};

export const getScheduleOrder = (cityId, scheduleType) => {
  const key = `${STORAGE_KEY_PREFIX}${cityId}_${scheduleType}`;
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : null;
};

export const applyScheduleOrder = (schedules, cityId, scheduleType) => {
  const savedOrder = getScheduleOrder(cityId, scheduleType);
  if (!savedOrder || savedOrder.length === 0) return schedules;
  
  // Создаем map для быстрого поиска
  const scheduleMap = new Map(schedules.map(s => [s.id, s]));
  
  // Сортируем согласно сохраненному порядку
  const ordered = [];
  
  // Сначала добавляем элементы в сохраненном порядке
  savedOrder.forEach(id => {
    if (scheduleMap.has(id)) {
      ordered.push(scheduleMap.get(id));
      scheduleMap.delete(id);
    }
  });
  
  // Добавляем новые элементы, которых не было в сохраненном порядке
  scheduleMap.forEach(schedule => {
    ordered.push(schedule);
  });
  
  return ordered;
};