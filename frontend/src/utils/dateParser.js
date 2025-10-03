/**
 * Парсит последнюю дату из строки с несколькими датами
 * @param {string} dateString - Строка с датами, например "06.05.2025\n30.05.2025\n04.06.2025-\nконцепция\n15.07.2025\n15.08.2025"
 * @returns {Date|null} - Последняя валидная дата или null
 */
export const parseLastDate = (dateString) => {
  if (!dateString || typeof dateString !== 'string') {
    return null;
  }

  // Разбиваем строку на строки и очищаем от лишних символов
  const lines = dateString.split('\n').map(line => line.trim()).filter(line => line);
  
  const dates = [];
  
  for (const line of lines) {
    // Ищем даты в формате DD.MM.YYYY
    const dateMatches = line.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g);
    
    if (dateMatches) {
      for (const dateMatch of dateMatches) {
        const [day, month, year] = dateMatch.split('.').map(num => parseInt(num, 10));
        
        // Проверяем валидность даты
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && 
            date.getMonth() === month - 1 && 
            date.getDate() === day) {
          dates.push(date);
        }
      }
    }
  }
  
  // Возвращаем последнюю дату (самую позднюю)
  if (dates.length > 0) {
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[dates.length - 1];
  }
  
  return null;
};

/**
 * Форматирует дату для отображения
 * @param {Date} date - Дата для форматирования
 * @returns {string} - Отформатированная дата
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Вычисляет количество дней до дедлайна
 * @param {Date} deadline - Дата дедлайна
 * @returns {number} - Количество дней до дедлайна (отрицательное, если дедлайн прошел)
 */
export const getDaysUntilDeadline = (deadline) => {
  if (!deadline) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Проверяет, нужно ли отправить уведомление
 * @param {Date} deadline - Дата дедлайна
 * @param {string} notificationType - Тип уведомления ('weekBefore', 'dayBefore', 'dayOf')
 * @returns {boolean} - true если нужно отправить уведомление
 */
export const shouldSendNotification = (deadline, notificationType) => {
  if (!deadline || !notificationType) {
    return false;
  }
  
  const daysUntil = getDaysUntilDeadline(deadline);
  
  if (daysUntil === null) {
    return false;
  }
  
  // Проверяем различные типы уведомлений
  switch (notificationType) {
    case 'dayOf':
      return daysUntil === 0;
    case 'dayBefore':
      return daysUntil === 1;
    case 'weekBefore':
      return daysUntil === 7;
    default:
      return false;
  }
};

/**
 * Создает текст уведомления
 * @param {Object} task - Задача
 * @param {string} type - Тип уведомления
 * @param {number} daysUntil - Количество дней до дедлайна
 * @param {string} siteUrl - URL сайта
 * @returns {string} - Текст уведомления
 */
export const createNotificationText = (task, type, daysUntil, siteUrl = '') => {
  const taskName = task.work_name || task.task || 'Неизвестная задача';
  const responsible = task.responsible || 'Не указан';
  const deadline = formatDate(parseLastDate(task.due_date));
  
  let urgencyText = '';
  switch (type) {
    case 'dayOf':
      urgencyText = '🚨 СЕГОДНЯ ДЕДЛАЙН!';
      break;
    case 'dayBefore':
      urgencyText = '⚠️ Завтра дедлайн!';
      break;
    case 'weekBefore':
      urgencyText = '📅 Через неделю дедлайн';
      break;
    default:
      urgencyText = '📋 Напоминание о задаче';
  }
  
  let message = `${urgencyText}\n\n`;
  message += `📋 Задача: ${taskName}\n`;
  message += `👤 Ответственный: ${responsible}\n`;
  message += `📅 Дедлайн: ${deadline}\n`;
  
  if (task.construction_stage) {
    message += `🏗️ Этап: ${task.construction_stage}\n`;
  }
  
  if (siteUrl) {
    message += `\n🔗 Ссылка на сайт: ${siteUrl}`;
  }
  
  return message;
};
