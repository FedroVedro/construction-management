/**
 * Отправляет сообщение в Telegram
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} message - Текст сообщения
 * @returns {Promise<boolean>} - true если сообщение отправлено успешно
 */
export const sendTelegramMessage = async (botToken, chatId, message) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const result = await response.json();
    
    if (result.ok) {
      console.log('Telegram message sent successfully:', result);
      return true;
    } else {
      console.error('Telegram API error:', result);
      return false;
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return false;
  }
};

/**
 * Проверяет соединение с Telegram ботом
 * @param {string} botToken - Токен бота
 * @returns {Promise<boolean>} - true если бот доступен
 */
export const testTelegramConnection = async (botToken) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const result = await response.json();
    
    if (result.ok) {
      console.log('Telegram bot info:', result.result);
      return true;
    } else {
      console.error('Telegram bot error:', result);
      return false;
    }
  } catch (error) {
    console.error('Error testing Telegram connection:', error);
    return false;
  }
};

/**
 * Отправляет тестовое сообщение
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @returns {Promise<boolean>} - true если тестовое сообщение отправлено
 */
export const sendTestMessage = async (botToken, chatId) => {
  const testMessage = `🤖 <b>Тестовое сообщение</b>\n\nЭто тестовое сообщение от бота проектного офиса.\n\nЕсли вы получили это сообщение, значит настройки работают корректно!`;
  
  return await sendTelegramMessage(botToken, chatId, testMessage);
};

/**
 * Отправляет уведомления о задачах с приближающимся дедлайном
 * @param {Array} notifications - Массив уведомлений с задачами и сотрудниками
 * @param {string} siteUrl - URL сайта
 * @returns {Promise<Object>} - Результат отправки уведомлений
 */
export const sendDeadlineNotifications = async (notifications, siteUrl = '') => {
  const results = {
    sent: 0,
    failed: 0,
    errors: []
  };

  for (const notification of notifications) {
    try {
      const { task, employee, notificationType, deadline } = notification;
      
      // Создаем текст уведомления
      const message = createNotificationText(task, notificationType, deadline, siteUrl);

      // Отправляем уведомление ответственному сотруднику
      const success = await sendTelegramMessage(
        '8257710577:AAHJUmwbwB0mTj5KNn--pfT-04tXOunPVDY', // Используем токен из настроек
        employee.chatId, 
        message
      );
      
      if (success) {
        results.sent++;
      } else {
        results.failed++;
        results.errors.push(`Ошибка отправки ответственному: ${employee.name}`);
      }

    } catch (error) {
      results.failed++;
      results.errors.push(`Ошибка обработки уведомления: ${error.message}`);
    }
  }

  return {
    success: results.failed === 0,
    ...results
  };
};

/**
 * Создает текст уведомления о дедлайне
 * @param {Object} task - Задача
 * @param {string} notificationType - Тип уведомления
 * @param {Date} deadline - Дата дедлайна
 * @param {string} siteUrl - URL сайта
 * @returns {string} - Текст уведомления
 */
const createNotificationText = (task, notificationType, deadline, siteUrl) => {
  const deadlineStr = deadline.toLocaleDateString('ru-RU');
  const taskLink = siteUrl ? `${siteUrl}/project-office` : '';
  
  let urgency = '';
  let emoji = '';
  
  switch (notificationType) {
    case 'weekBefore':
      urgency = 'через неделю';
      emoji = '📅';
      break;
    case 'dayBefore':
      urgency = 'завтра';
      emoji = '⚠️';
      break;
    case 'dayOf':
      urgency = 'сегодня';
      emoji = '🚨';
      break;
    default:
      urgency = 'скоро';
      emoji = '📋';
  }

  return `${emoji} <b>Уведомление о дедлайне</b>\n\n` +
         `<b>Задача:</b> ${task.work_name || 'Не указано'}\n` +
         `<b>Дедлайн:</b> ${deadlineStr} (${urgency})\n` +
         `<b>Ответственный:</b> ${task.responsible || 'Не указан'}\n` +
         `<b>Этап:</b> ${task.construction_stage || 'Не указан'}\n\n` +
         (taskLink ? `🔗 <a href="${taskLink}">Открыть в проектном офисе</a>` : '');
};
