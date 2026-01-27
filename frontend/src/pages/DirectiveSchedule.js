import React, { useState, useEffect } from 'react';
import ModernGanttChart from '../components/Dashboard/ModernGanttChart';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const DirectiveSchedule = () => {
  const [cities, setCities] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      // Фильтруем только объекты, которые должны отображаться в графиках
      const visibleCities = response.data.filter(city => city.visible_in_schedules !== false);
      setCities(visibleCities);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = selectedCity ? { city_id: selectedCity } : {};
      const response = await client.get('/schedules', { params });
      setSchedules(response.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Обработчик обновления дат из диаграммы Ганта
  // Важно: НЕ обновляем schedules здесь - ModernGanttChart сам управляет UI
  const handleScheduleUpdate = async (scheduleId, updates) => {
    try {
      // БАГ-ФИХ: Добавлен таймаут 8 секунд для предотвращения зависания
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      await client.put(`/schedules/${scheduleId}`, updates, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // БАГ-ФИХ: Обновляем локальный state после успешного сохранения
      // Это предотвращает визуальный возврат блока на старое место
      setSchedules(prev => prev.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, ...updates }
          : schedule
      ));
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('Таймаут запроса сохранения');
        showError('Превышено время ожидания сохранения');
      } else {
        console.error('Error updating schedule:', error);
        showError('Ошибка при обновлении дат');
      }
      throw error;
    }
  };

  return (
    <div className="container-fluid">
      <h1>Директивный агрегированный график</h1>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label className="form-label">Выберите объект строительства</label>
          <select 
            className="form-control"
            value={selectedCity || ''}
            onChange={(e) => setSelectedCity(e.target.value || null)}
          >
            <option value="">Все объекты</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card-full-width">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div>Загрузка данных...</div>
          </div>
        ) : (
          <ModernGanttChart schedules={schedules} cities={cities} onScheduleUpdate={handleScheduleUpdate} />
        )}
      </div>
    </div>
  );
};

export default DirectiveSchedule;