import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { sendDeadlineNotifications } from '../utils/telegramApi';
import { parseLastDate, shouldSendNotification } from '../utils/dateParser';

const DeadlineChecker = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [checkResults, setCheckResults] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    fetchSettings();
    // Проверяем дедлайны каждые 30 минут
    const interval = setInterval(checkDeadlines, 30 * 60 * 1000);
    
    // Первая проверка при загрузке
    checkDeadlines();
    
    return () => clearInterval(interval);
  }, []);

  const fetchSettings = async () => {
    try {
      // Сначала пытаемся загрузить локальные настройки
      const localSettings = JSON.parse(localStorage.getItem('telegramSettings') || '{}');
      const localEmployees = Object.values(localSettings).map(setting => ({
        id: setting.responsible,
        responsible: setting.responsible,
        chatId: setting.chatId || '',
        weekBefore: setting.weekBefore !== undefined ? setting.weekBefore : true,
        dayBefore: setting.dayBefore !== undefined ? setting.dayBefore : true,
        dayOf: setting.dayOf !== undefined ? setting.dayOf : true
      }));
      
      if (localEmployees.length > 0) {
        setSettings({ employees: localEmployees });
        console.log('Loaded local telegram settings:', localEmployees);
        return;
      }
      
      // Fallback: получаем данные из проектного офиса
      await loadFallbackSettings();
    } catch (error) {
      console.error('Error fetching telegram settings:', error);
    }
  };

  const loadFallbackSettings = async () => {
    try {
      // Сначала получаем список городов
      const citiesResponse = await client.get('/cities');
      const cities = citiesResponse.data || [];
      
      if (cities.length === 0) {
        console.warn('No cities found for fallback');
        return;
      }
      
      // Получаем данные из всех городов
      const allTasks = [];
      for (const city of cities) {
        try {
          const response = await client.get(`/project-office?city_id=${city.id}`);
          if (response.data) {
            allTasks.push(...response.data);
          }
        } catch (cityError) {
          console.warn(`Error fetching tasks for city ${city.id}:`, cityError);
        }
      }
      
      // Извлекаем уникальные значения ответственных
      const responsibleSet = new Set();
      allTasks.forEach(task => {
        if (task.responsible && task.responsible.trim()) {
          responsibleSet.add(task.responsible.trim());
        }
      });
      
      // Создаем настройки по умолчанию
      const defaultSettings = Array.from(responsibleSet).map(responsible => ({
        id: responsible,
        responsible: responsible,
        chatId: '',
        weekBefore: true,
        dayBefore: true,
        dayOf: true
      }));
      
      setSettings({ employees: defaultSettings });
      console.log('Loaded fallback settings:', defaultSettings);
    } catch (fallbackError) {
      console.error('Error fetching fallback settings:', fallbackError);
    }
  };

  const checkDeadlines = async () => {
    if (!settings || !settings.employees || settings.employees.length === 0) {
      return;
    }

    setIsRunning(true);
    
    try {
      // Получаем список городов
      const citiesResponse = await client.get('/cities');
      const cities = citiesResponse.data || [];
      
      // Получаем задачи из всех городов
      const allTasks = [];
      for (const city of cities) {
        try {
          const response = await client.get(`/project-office?city_id=${city.id}`);
          if (response.data) {
            allTasks.push(...response.data);
          }
        } catch (cityError) {
          console.warn(`Error fetching tasks for city ${city.id}:`, cityError);
        }
      }
      
      const notificationsToSend = [];
      
      // Проверяем каждую задачу
      for (const task of allTasks) {
        if (!task.deadline || !task.responsible) continue;
        
        const lastDate = parseLastDate(task.deadline);
        if (!lastDate) continue;
        
        // Находим ответственного сотрудника
        const responsibleEmployee = settings.employees.find(emp => 
          emp.responsible && emp.chatId && 
          (emp.responsible.toLowerCase().trim() === task.responsible.toLowerCase().trim())
        );
        
        if (!responsibleEmployee) continue;
        
        // Проверяем, нужно ли отправить уведомления
        const notifications = [];
        
        if (responsibleEmployee.weekBefore && shouldSendNotification(lastDate, 'weekBefore')) {
          notifications.push({
            task,
            employee: responsibleEmployee,
            notificationType: 'weekBefore',
            deadline: lastDate,
            key: `${task.id}_weekBefore_${lastDate.toISOString().split('T')[0]}`
          });
        }
        
        if (responsibleEmployee.dayBefore && shouldSendNotification(lastDate, 'dayBefore')) {
          notifications.push({
            task,
            employee: responsibleEmployee,
            notificationType: 'dayBefore',
            deadline: lastDate,
            key: `${task.id}_dayBefore_${lastDate.toISOString().split('T')[0]}`
          });
        }
        
        if (responsibleEmployee.dayOf && shouldSendNotification(lastDate, 'dayOf')) {
          notifications.push({
            task,
            employee: responsibleEmployee,
            notificationType: 'dayOf',
            deadline: lastDate,
            key: `${task.id}_dayOf_${lastDate.toISOString().split('T')[0]}`
          });
        }
        
        notificationsToSend.push(...notifications);
      }
      
      // Отправляем уведомления
      if (notificationsToSend.length > 0) {
        await sendDeadlineNotifications(notificationsToSend, window.location.origin);
        console.log(`Sent ${notificationsToSend.length} notifications`);
      }
      
      setCheckResults({
        totalTasks: allTasks.length,
        notificationsSent: notificationsToSend.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('Error checking deadlines:', error);
    } finally {
      setIsRunning(false);
      setLastCheck(new Date());
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">
          <i className="fas fa-clock me-2"></i>
          Автоматические уведомления
        </h5>
      </div>
      <div className="card-body">
        <div className="row">
          <div className="col-md-6">
            <div className="d-flex align-items-center mb-3">
              <div className={`spinner-border spinner-border-sm me-2 ${isRunning ? '' : 'd-none'}`} role="status">
                <span className="visually-hidden">Проверка...</span>
              </div>
              <span className="fw-bold">
                {isRunning ? 'Проверка дедлайнов...' : 'Система активна'}
              </span>
            </div>
            
            <div className="mb-3">
              <small className="text-muted">
                Проверка выполняется каждые 30 минут
              </small>
            </div>
            
            {lastCheck && (
              <div className="mb-3">
                <small className="text-muted">
                  Последняя проверка: {lastCheck.toLocaleString()}
                </small>
              </div>
            )}
          </div>
          
          <div className="col-md-6">
            {checkResults && (
              <div className="alert alert-info">
                <h6 className="alert-heading">
                  <i className="fas fa-info-circle me-1"></i>
                  Результаты последней проверки
                </h6>
                <p className="mb-1">
                  <strong>Всего задач:</strong> {checkResults.totalTasks}
                </p>
                <p className="mb-1">
                  <strong>Уведомлений отправлено:</strong> {checkResults.notificationsSent}
                </p>
                <p className="mb-0">
                  <strong>Время:</strong> {checkResults.timestamp.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="row">
          <div className="col-12">
            <div className="alert alert-success">
              <h6 className="alert-heading">
                <i className="fas fa-bell me-1"></i>
                Настройки уведомлений
              </h6>
              <p className="mb-1">
                <i className="fas fa-calendar-week me-1"></i>
                <strong>За неделю:</strong> Уведомления отправляются за 7 дней до дедлайна
              </p>
              <p className="mb-1">
                <i className="fas fa-calendar-day me-1"></i>
                <strong>За день:</strong> Уведомления отправляются за 1 день до дедлайна
              </p>
              <p className="mb-0">
                <i className="fas fa-calendar-check me-1"></i>
                <strong>В день:</strong> Уведомления отправляются в день дедлайна
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeadlineChecker;