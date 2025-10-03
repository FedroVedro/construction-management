import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import DeadlineChecker from '../components/DeadlineChecker';

const TelegramSettings = () => {
  const [botToken, setBotToken] = useState('8257710577:AAHJUmwbwB0mTj5KNn--pfT-04tXOunPVDY');
  const [responsibleSettings, setResponsibleSettings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [selectedResponsible, setSelectedResponsible] = useState(null);
  const [responsibleTasks, setResponsibleTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const { user } = useAuth();

  const canEdit = user?.role === 'admin';

  useEffect(() => {
    fetchResponsibleOptions();
  }, []);

  const fetchResponsibleOptions = async () => {
    try {
      // Сначала получаем список городов
      const citiesResponse = await client.get('/cities');
      const cities = citiesResponse.data || [];
      
      if (cities.length === 0) {
        console.warn('No cities found');
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
      
      // Преобразуем в массив настроек для каждого ответственного
      const settings = Array.from(responsibleSet).map(responsible => ({
        id: responsible,
        responsible: responsible,
        chatId: '',
        weekBefore: true,
        dayBefore: true,
        dayOf: true
      }));
      
      setResponsibleSettings(settings);
      console.log('Loaded responsible settings:', settings);
      
      // Загружаем сохраненные настройки после установки базовых данных
      loadSavedSettings(settings);
    } catch (error) {
      console.error('Error fetching responsible options:', error);
    }
  };

  const loadSavedSettings = (baseSettings) => {
    try {
      const savedSettings = JSON.parse(localStorage.getItem('telegramSettings') || '{}');
      const updatedSettings = baseSettings.map(responsible => {
        const saved = savedSettings[responsible.id];
        if (saved) {
          return {
            ...responsible,
            chatId: saved.chatId || '',
            weekBefore: saved.weekBefore !== undefined ? saved.weekBefore : true,
            dayBefore: saved.dayBefore !== undefined ? saved.dayBefore : true,
            dayOf: saved.dayOf !== undefined ? saved.dayOf : true
          };
        }
        return responsible;
      });
      
      setResponsibleSettings(updatedSettings);
      console.log('Applied saved settings:', updatedSettings);
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
  };

  const saveResponsibleSettings = async (responsibleId, settings, showMessage = true) => {
    if (showMessage) {
      setLoading(true);
    }
    try {
      // Сохраняем настройки локально в localStorage
      const existingSettings = JSON.parse(localStorage.getItem('telegramSettings') || '{}');
      existingSettings[responsibleId] = settings;
      localStorage.setItem('telegramSettings', JSON.stringify(existingSettings));
      
      if (showMessage) {
        setMessage('Настройки ответственного сохранены успешно!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error saving responsible settings:', error);
      if (showMessage) {
        setMessage('Ошибка при сохранении настроек ответственного');
        setTimeout(() => setMessage(''), 3000);
      }
    } finally {
      if (showMessage) {
        setLoading(false);
      }
    }
  };

  const testNotificationForResponsible = async (responsible) => {
    if (!responsible.chatId) {
      setMessage('Ошибка: не указан Chat ID для ответственного');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const testMessage = `🧪 <b>Тестовое уведомление</b>\n\n` +
        `Привет, ${responsible.responsible}!\n\n` +
        `Это тестовое сообщение от бота проектного офиса.\n` +
        `Если вы получили это сообщение, значит настройки работают корректно!\n\n` +
        `📅 Настройки уведомлений:\n` +
        `• За неделю: ${responsible.weekBefore ? '✅' : '❌'}\n` +
        `• За день: ${responsible.dayBefore ? '✅' : '❌'}\n` +
        `• В день: ${responsible.dayOf ? '✅' : '❌'}`;

      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: responsible.chatId,
          text: testMessage,
          parse_mode: 'HTML'
        })
      });

      const result = await response.json();
      
      if (result.ok) {
        setMessage(`Тестовое уведомление отправлено ${responsible.responsible} успешно!`);
      } else {
        setMessage(`Ошибка отправки: ${result.description || 'Неизвестная ошибка'}`);
      }
      setTimeout(() => setMessage(''), 5000);
    } catch (error) {
      console.error('Error sending test notification:', error);
      setMessage('Ошибка при отправке тестового уведомления');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const testTelegramConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const data = await response.json();
      if (data.ok) {
        setMessage('Соединение с Telegram успешно!');
      } else {
        setMessage('Ошибка соединения с Telegram');
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error testing telegram connection:', error);
      setMessage('Ошибка при тестировании соединения');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const testAutomaticNotifications = async () => {
    setLoading(true);
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
      
      // Создаем тестовые уведомления для каждого ответственного с настройками
      const testNotifications = [];
      
      for (const responsible of responsibleSettings) {
        if (!responsible.chatId) continue;
        
        // Находим задачи этого ответственного
        const responsibleTasks = allTasks.filter(task => 
          task.responsible && task.responsible.trim().toLowerCase() === responsible.responsible.toLowerCase()
        );
        
        if (responsibleTasks.length === 0) continue;
        
        // Создаем тестовые уведомления для каждого типа
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        if (responsible.weekBefore) {
          testNotifications.push({
            task: {
              ...responsibleTasks[0],
              deadline: nextWeek.toLocaleDateString('ru-RU')
            },
            employee: responsible,
            notificationType: 'weekBefore',
            deadline: nextWeek,
            key: `test_weekBefore_${responsible.id}`
          });
        }
        
        if (responsible.dayBefore) {
          testNotifications.push({
            task: {
              ...responsibleTasks[0],
              deadline: tomorrow.toLocaleDateString('ru-RU')
            },
            employee: responsible,
            notificationType: 'dayBefore',
            deadline: tomorrow,
            key: `test_dayBefore_${responsible.id}`
          });
        }
        
        if (responsible.dayOf) {
          testNotifications.push({
            task: {
              ...responsibleTasks[0],
              deadline: today.toLocaleDateString('ru-RU')
            },
            employee: responsible,
            notificationType: 'dayOf',
            deadline: today,
            key: `test_dayOf_${responsible.id}`
          });
        }
      }
      
      if (testNotifications.length === 0) {
        setMessage('Нет настроенных ответственных с Chat ID для тестирования');
        setTimeout(() => setMessage(''), 3000);
        return;
      }
      
      // Отправляем тестовые уведомления
      const { sendDeadlineNotifications } = await import('../utils/telegramApi');
      await sendDeadlineNotifications(testNotifications, window.location.origin);
      
      setMessage(`Отправлено ${testNotifications.length} тестовых уведомлений!`);
      setTimeout(() => setMessage(''), 5000);
      
    } catch (error) {
      console.error('Error testing automatic notifications:', error);
      setMessage('Ошибка при тестировании уведомлений');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const updateResponsibleSetting = (responsibleId, field, value) => {
    setResponsibleSettings(prev => {
      const updated = prev.map(resp => 
        resp.id === responsibleId ? { ...resp, [field]: value } : resp
      );
      
      // Автоматически сохраняем изменения
      const responsible = updated.find(resp => resp.id === responsibleId);
      if (responsible) {
        saveResponsibleSettings(responsibleId, {
          responsible: responsible.responsible,
          chatId: responsible.chatId,
          weekBefore: responsible.weekBefore,
          dayBefore: responsible.dayBefore,
          dayOf: responsible.dayOf
        }, false); // Не показываем сообщение при автоматическом сохранении
      }
      
      return updated;
    });
  };

  const showResponsibleTasks = async (responsible) => {
    setSelectedResponsible(responsible);
    setLoadingTasks(true);
    setShowTasksModal(true);
    
    try {
      // Получаем список городов
      const citiesResponse = await client.get('/cities');
      const cities = citiesResponse.data || [];
      
      // Получаем задачи из всех городов для данного ответственного
      const allTasks = [];
      for (const city of cities) {
        try {
          const response = await client.get(`/project-office?city_id=${city.id}`);
          if (response.data) {
            const cityTasks = response.data.filter(task => 
              task.responsible && task.responsible.trim().toLowerCase() === responsible.responsible.toLowerCase()
            );
            allTasks.push(...cityTasks);
          }
        } catch (cityError) {
          console.warn(`Error fetching tasks for city ${city.id}:`, cityError);
        }
      }
      
      setResponsibleTasks(allTasks);
    } catch (error) {
      console.error('Error fetching responsible tasks:', error);
      setMessage('Ошибка при загрузке задач ответственного');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setLoadingTasks(false);
    }
  };

  const closeTasksModal = () => {
    setShowTasksModal(false);
    setSelectedResponsible(null);
    setResponsibleTasks([]);
  };

  if (!canEdit) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning">
          У вас нет прав для доступа к настройкам Telegram
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <h2 className="mb-4">
        <i className="fas fa-robot me-2"></i>
        Настройки Telegram уведомлений
      </h2>
      
      {message && (
        <div className={`alert ${message.includes('Ошибка') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`}>
          <i className={`fas ${message.includes('Ошибка') ? 'fa-exclamation-triangle' : 'fa-check-circle'} me-2`}></i>
          {message}
          <button type="button" className="btn-close" onClick={() => setMessage('')}></button>
        </div>
      )}

      <div className="row">
        <div className="col-md-4">
          <div className="card shadow-sm">
            <div className="card-header bg-primary text-white">
              <h5 className="mb-0">
                <i className="fas fa-cog me-2"></i>
                Настройки бота
              </h5>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label fw-bold">
                  <i className="fas fa-key me-1"></i>
                  Токен бота
                </label>
                <div className="input-group">
                  <input
                    type="password"
                    className="form-control"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    placeholder="Введите токен Telegram бота"
                  />
                  <button 
                    className="btn btn-outline-secondary" 
                    type="button"
                    onClick={() => setBotToken('')}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <small className="form-text text-muted">
                  <i className="fas fa-info-circle me-1"></i>
                  Получите токен у @BotFather в Telegram
                </small>
              </div>

              <div className="d-grid gap-2">
                <button
                  className="btn btn-outline-primary"
                  onClick={testTelegramConnection}
                  disabled={loading || !botToken}
                >
                  <i className="fas fa-wifi me-2"></i>
                  {loading ? 'Тестирование...' : 'Тест соединения'}
                </button>
                
                <button
                  className="btn btn-outline-success"
                  onClick={testAutomaticNotifications}
                  disabled={loading || !botToken}
                >
                  <i className="fas fa-bell me-2"></i>
                  {loading ? 'Тестирование...' : 'Тест уведомлений'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-8">
          <div className="card shadow-sm">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="fas fa-users me-2"></i>
                Настройки ответственных
              </h5>
            </div>
            <div className="card-body">
              {responsibleSettings.length === 0 ? (
                <div className="text-center py-4">
                  <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                  <p className="text-muted">Нет данных об ответственных в проектном офисе</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead className="table-light">
                      <tr>
                        <th>
                          <i className="fas fa-user-tie me-1"></i>
                          Ответственный
                        </th>
                        <th>
                          <i className="fab fa-telegram me-1"></i>
                          Chat ID
                        </th>
                        <th className="text-center">
                          <i className="fas fa-calendar-week me-1"></i>
                          За неделю
                        </th>
                        <th className="text-center">
                          <i className="fas fa-calendar-day me-1"></i>
                          За день
                        </th>
                        <th className="text-center">
                          <i className="fas fa-calendar-check me-1"></i>
                          В день
                        </th>
                        <th className="text-center">
                          <i className="fas fa-tasks me-1"></i>
                          Мои задачи
                        </th>
                        <th className="text-center">
                          <i className="fas fa-paper-plane me-1"></i>
                          Тест бота
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {responsibleSettings.map(responsible => (
                        <tr key={responsible.id}>
                          <td>
                            <div className="d-flex align-items-center">
                              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-2" 
                                   style={{width: '32px', height: '32px', fontSize: '14px'}}>
                                {responsible.responsible.charAt(0).toUpperCase()}
                              </div>
                              <span className="fw-bold">{responsible.responsible}</span>
                            </div>
                          </td>
                          <td>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text">
                                <i className="fab fa-telegram"></i>
                              </span>
                              <input
                                type="text"
                                className="form-control"
                                value={responsible.chatId || ''}
                                onChange={(e) => updateResponsibleSetting(responsible.id, 'chatId', e.target.value)}
                                placeholder="Введите Chat ID"
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-flex justify-content-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={responsible.weekBefore}
                                onChange={(e) => updateResponsibleSetting(responsible.id, 'weekBefore', e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-flex justify-content-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={responsible.dayBefore}
                                onChange={(e) => updateResponsibleSetting(responsible.id, 'dayBefore', e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="form-check form-switch d-flex justify-content-center">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={responsible.dayOf}
                                onChange={(e) => updateResponsibleSetting(responsible.id, 'dayOf', e.target.checked)}
                              />
                            </div>
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => showResponsibleTasks(responsible)}
                              disabled={loadingTasks}
                              title="Показать задачи и дедлайны"
                            >
                              <i className="fas fa-tasks me-1"></i>
                              Задачи
                            </button>
                          </td>
                          <td className="text-center">
                            <button
                              className="btn btn-info btn-sm"
                              onClick={() => testNotificationForResponsible(responsible)}
                              disabled={loading || !responsible.chatId}
                              title="Отправить тестовое уведомление"
                            >
                              <i className="fas fa-paper-plane me-1"></i>
                              Тест
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row mt-4">
        <div className="col-12">
          <DeadlineChecker />
        </div>
      </div>

      {/* Модальное окно для отображения задач */}
      {showTasksModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.5)'}}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="fas fa-tasks me-2"></i>
                  Задачи и дедлайны: {selectedResponsible?.responsible}
                </h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={closeTasksModal}
                ></button>
              </div>
              <div className="modal-body">
                {loadingTasks ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Загрузка...</span>
                    </div>
                    <p className="mt-2">Загрузка задач...</p>
                  </div>
                ) : responsibleTasks.length === 0 ? (
                  <div className="text-center py-4">
                    <i className="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p className="text-muted">У данного ответственного нет задач в проектном офисе</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>
                            <i className="fas fa-list-ol me-1"></i>
                            №
                          </th>
                          <th>
                            <i className="fas fa-hammer me-1"></i>
                            Наименование работ
                          </th>
                          <th>
                            <i className="fas fa-building me-1"></i>
                            Этап строительства
                          </th>
                          <th>
                            <i className="fas fa-calendar-alt me-1"></i>
                            Срок
                          </th>
                          <th>
                            <i className="fas fa-percentage me-1"></i>
                            Готовность
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {responsibleTasks.map((task, index) => (
                          <tr key={task.id}>
                            <td>{index + 1}</td>
                            <td>
                              <div className="fw-bold">{task.work_name || 'Не указано'}</div>
                            </td>
                            <td>
                              <span className="badge bg-secondary">
                                {task.construction_stage || 'Не указано'}
                              </span>
                            </td>
                            <td>
                              <div className="text-wrap" style={{maxWidth: '200px'}}>
                                {task.deadline || 'Не указано'}
                              </div>
                            </td>
                            <td>
                              <div className="d-flex align-items-center">
                                <div className="progress me-2" style={{width: '60px', height: '8px'}}>
                                  <div 
                                    className="progress-bar" 
                                    style={{width: `${task.completion_percentage || 0}%`}}
                                  ></div>
                                </div>
                                <span className="small">{task.completion_percentage || 0}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={closeTasksModal}
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TelegramSettings;