import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MasterCard from '../components/Dashboard/MasterCard';
import ModernGanttChart from '../components/Dashboard/ModernGanttChart';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { saveSelectedCity, getSelectedCity } from '../utils/userPreferences';

const Home = () => {
  const [cities, setCities] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      setCities(response.data);
      
      // Восстанавливаем сохранённый город
      const savedCity = getSelectedCity();
      if (savedCity && response.data.some(c => c.id === savedCity)) {
        setSelectedCity(savedCity);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
      showError('Ошибка при загрузке объектов');
    }
  };

  const handleScheduleUpdate = async (scheduleId, updates) => {
    // Сохраняем старое состояние для отката в случае ошибки
    const previousSchedules = [...schedules];
    
    // Оптимистично обновляем UI сразу (без перезагрузки)
    setSchedules(prevSchedules => 
      prevSchedules.map(schedule => 
        schedule.id === scheduleId 
          ? { ...schedule, ...updates }
          : schedule
      )
    );
    
    // Синхронизируем с сервером в фоне
    try {
      await client.put(`/schedules/${scheduleId}`, updates);
      // Успешно сохранено - ничего не делаем, UI уже обновлён
    } catch (error) {
      console.error('Error updating schedule:', error);
      // Откатываем изменения при ошибке
      setSchedules(previousSchedules);
      showError('Ошибка при обновлении дат');
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
      showError('Ошибка при загрузке графиков');
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (value) => {
    const cityId = value || null;
    setSelectedCity(cityId);
    if (cityId) {
      saveSelectedCity(cityId);
    }
  };

  return (
    <div className="container-fluid">
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <div>
          <h1 style={{ marginBottom: '5px' }}>Панель управления</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Добро пожаловать, {user?.username}! 
            <span style={{ marginLeft: '10px', fontSize: '13px' }}>
              💡 Нажмите <kbd style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '3px',
                padding: '1px 5px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}>?</kbd> для справки по горячим клавишам
            </span>
          </p>
        </div>
      </div>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            🏗️ Выберите объект строительства
          </label>
          <select 
            className="form-control"
            value={selectedCity || ''}
            onChange={(e) => handleCityChange(e.target.value)}
            style={{ fontSize: '16px', padding: '10px 12px' }}
          >
            <option value="">Все объекты</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>

      <MasterCard cityId={selectedCity} />
      
      {(user?.role === 'admin' || user?.role === 'director') && (
        <div className="card-full-width">
          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div className="loading-spinner" style={{ width: '40px', height: '40px' }}></div>
              <div style={{ color: 'var(--text-muted)' }}>Загрузка графика...</div>
            </div>
          ) : (
            <ModernGanttChart 
              schedules={schedules} 
              cities={cities} 
              onScheduleUpdate={handleScheduleUpdate}
            />
          )}
        </div>
      )}

      {/* Быстрые ссылки */}
      <div className="card">
        <h3 style={{ marginBottom: '15px' }}>⚡ Быстрые действия</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <QuickLink to="/construction-schedule" icon="🔨" text="График строительства" shortcut="Ctrl+B" />
          <QuickLink to="/project-office" icon="📁" text="Проектный офис" shortcut="Ctrl+P" />
          <QuickLink to="/document-schedule" icon="📄" text="График документации" shortcut="Ctrl+D" />
          <QuickLink to="/procurement-schedule" icon="🛒" text="График закупок" />
          <QuickLink to="/hr-schedule" icon="👥" text="HR-график" />
        </div>
      </div>
    </div>
  );
};

// Компонент быстрой ссылки (использует React Router для навигации без перезагрузки)
const QuickLink = ({ to, icon, text, shortcut }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        color: 'var(--text-primary)',
        fontSize: '14px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--table-hover)';
        e.currentTarget.style.borderColor = '#007bff';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span style={{ fontSize: '18px', pointerEvents: 'none' }}>{icon}</span>
      <span style={{ pointerEvents: 'none' }}>{text}</span>
      {shortcut && (
        <kbd style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '3px',
          padding: '2px 6px',
          fontSize: '10px',
          fontFamily: 'monospace',
          marginLeft: '4px',
          color: 'var(--text-muted)',
          pointerEvents: 'none'
        }}>
          {shortcut}
        </kbd>
      )}
    </button>
  );
};

export default Home;
