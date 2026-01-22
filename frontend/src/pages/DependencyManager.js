import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

const DependencyManager = () => {
  const { isDark } = useTheme();
  const { showSuccess, showError } = useToast();
  
  // Состояния
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [stages, setStages] = useState([]);
  const [dependencies, setDependencies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Фильтры
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  
  // Режим создания связи
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [selectedPredecessor, setSelectedPredecessor] = useState(null);
  const [linkType, setLinkType] = useState('FS');
  const [lagDays, setLagDays] = useState(0);
  
  // Критический путь
  const [criticalPath, setCriticalPath] = useState([]);
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  
  // Панель шаблонов
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [newTemplate, setNewTemplate] = useState({
    work_name: '',
    schedule_type: 'construction',
    construction_stage_id: '',
    typical_duration: '',
    can_parallel: false
  });

  // Типы графиков (мягкие пастельные оттенки)
  const scheduleTypes = {
    document: { name: 'Тех. заказчик', color: '#7b9eb8', icon: '📄' },
    hr: { name: 'HR', color: '#a99bc4', icon: '👥' },
    procurement: { name: 'Закупки', color: '#d4b896', icon: '🛒' },
    construction: { name: 'Строительство', color: '#8bc49a', icon: '🏗️' },
    marketing: { name: 'Маркетинг', color: '#d4a0b8', icon: '📢' }
  };

  // Типы связей
  const linkTypes = {
    FS: { name: 'Finish-to-Start', desc: 'После окончания', icon: '➡️' },
    SS: { name: 'Start-to-Start', desc: 'Одновременное начало', icon: '⇉' },
    FF: { name: 'Finish-to-Finish', desc: 'Одновременное окончание', icon: '⇶' },
    SF: { name: 'Start-to-Finish', desc: 'Начало влияет на окончание', icon: '↪️' }
  };

  // Загрузка базовых данных (города и этапы)
  const fetchBaseData = useCallback(async () => {
    setLoading(true);
    try {
      const [citiesRes, stagesRes] = await Promise.all([
        client.get('/cities'),
        client.get('/construction-stages')
      ]);
      
      setCities(citiesRes.data);
      setStages(stagesRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      showError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  // Загрузка данных для выбранного объекта
  const fetchCityData = useCallback(async (cityId) => {
    if (!cityId) {
      setSchedules([]);
      setDependencies([]);
      return;
    }
    
    try {
      const [schedulesRes, depsRes] = await Promise.all([
        client.get('/schedules', { params: { city_id: cityId } }),
        client.get('/dependencies/task-dependencies', { params: { city_id: cityId } })
      ]);
      
      setSchedules(schedulesRes.data);
      setDependencies(depsRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных объекта:', error);
      showError('Ошибка загрузки данных объекта');
    }
  }, [showError]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  // Загрузка данных при выборе объекта
  useEffect(() => {
    fetchCityData(selectedCity);
  }, [selectedCity, fetchCityData]);
  
  // Функция для перезагрузки данных (после создания/удаления зависимости)
  const fetchData = useCallback(() => {
    fetchCityData(selectedCity);
  }, [selectedCity, fetchCityData]);

  // Загрузка критического пути
  const fetchCriticalPath = async () => {
    try {
      const params = {};
      if (selectedCity) params.city_id = selectedCity;
      if (selectedType) params.schedule_type = selectedType;
      
      const response = await client.get('/dependencies/dependency-graph', { params });
      setCriticalPath(response.data.critical_path || []);
    } catch (error) {
      console.error('Ошибка расчёта критического пути:', error);
    }
  };

  useEffect(() => {
    if (showCriticalPath) {
      fetchCriticalPath();
    }
  }, [showCriticalPath, selectedCity, selectedType, dependencies]);

  // Загрузка шаблонов
  const fetchTemplates = async () => {
    try {
      const response = await client.get('/dependencies/work-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
    }
  };

  useEffect(() => {
    if (showTemplates) {
      fetchTemplates();
    }
  }, [showTemplates]);

  // Фильтрация задач
  const filteredSchedules = schedules.filter(s => {
    if (selectedCity && s.city_id !== parseInt(selectedCity)) return false;
    if (selectedType && s.schedule_type !== selectedType) return false;
    if (selectedStage && s.construction_stage !== selectedStage) return false;
    return true;
  }).sort((a, b) => new Date(a.planned_start_date) - new Date(b.planned_start_date));

  // Получение названия задачи
  const getTaskName = (schedule) => {
    return schedule.work_name || schedule.vacancy || schedule.sections || 'Без названия';
  };

  // Создание зависимости
  const createDependency = async (successorId) => {
    if (!selectedPredecessor) return;
    
    try {
      await client.post('/dependencies/task-dependencies', {
        predecessor_id: selectedPredecessor.id,
        successor_id: successorId,
        link_type: linkType,
        lag_days: lagDays
      });
      
      showSuccess('Зависимость создана');
      setIsCreatingLink(false);
      setSelectedPredecessor(null);
      fetchData();
    } catch (error) {
      showError(error.response?.data?.detail || 'Ошибка создания зависимости');
    }
  };

  // Удаление зависимости
  const deleteDependency = async (depId) => {
    try {
      await client.delete(`/dependencies/task-dependencies/${depId}`);
      showSuccess('Зависимость удалена');
      fetchData();
    } catch (error) {
      showError('Ошибка удаления зависимости');
    }
  };

  // Создание шаблона
  const createTemplate = async () => {
    try {
      await client.post('/dependencies/work-templates', {
        ...newTemplate,
        construction_stage_id: newTemplate.construction_stage_id || null,
        typical_duration: newTemplate.typical_duration ? parseInt(newTemplate.typical_duration) : null
      });
      showSuccess('Шаблон создан');
      setNewTemplate({
        work_name: '',
        schedule_type: 'construction',
        construction_stage_id: '',
        typical_duration: '',
        can_parallel: false
      });
      fetchTemplates();
    } catch (error) {
      showError('Ошибка создания шаблона');
    }
  };

  // Стили
  const containerStyle = {
    padding: '24px',
    minHeight: '100vh',
    backgroundColor: isDark ? '#1a1a2e' : '#f8fafc',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontFamily: "'Inter', -apple-system, sans-serif"
  };

  const cardStyle = {
    backgroundColor: isDark ? '#16213e' : '#ffffff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '20px',
    boxShadow: isDark 
      ? '0 4px 20px rgba(0, 0, 0, 0.3)' 
      : '0 4px 20px rgba(0, 0, 0, 0.08)',
    border: isDark ? '1px solid #0f3460' : '1px solid #e2e8f0'
  };

  const buttonStyle = (active = false, color = '#7b9eb8') => ({
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: active ? color : (isDark ? '#0f3460' : '#f1f5f9'),
    color: active ? '#ffffff' : (isDark ? '#94a3b8' : '#64748b'),
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease'
  });

  const selectStyle = {
    padding: '10px 14px',
    borderRadius: '8px',
    border: isDark ? '1px solid #0f3460' : '1px solid #e2e8f0',
    backgroundColor: isDark ? '#0f3460' : '#ffffff',
    color: isDark ? '#e2e8f0' : '#1e293b',
    fontSize: '14px',
    minWidth: '180px',
    cursor: 'pointer'
  };

  const taskCardStyle = (schedule, isSelected = false, isCritical = false) => ({
    padding: '16px',
    borderRadius: '10px',
    backgroundColor: isSelected 
      ? (isDark ? '#1e40af' : '#dbeafe')
      : isCritical 
        ? (isDark ? '#5c3a3a' : '#f5e6e6')
        : (isDark ? '#1e293b' : '#f8fafc'),
    border: `2px solid ${isSelected 
      ? '#7b9eb8' 
      : isCritical 
        ? '#d4a0a0' 
        : (isDark ? '#334155' : '#e2e8f0')}`,
    marginBottom: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative'
  });

  const tagStyle = (color) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: color + '20',
    color: color
  });

  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '50vh' 
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '50px', 
              height: '50px', 
              border: '4px solid #7b9eb8', 
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: isDark ? '#94a3b8' : '#64748b' }}>Загрузка данных...</p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Заголовок */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ 
          fontSize: '28px', 
          fontWeight: '700', 
          marginBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '32px' }}>🔗</span>
          Управление зависимостями задач
        </h1>
        <p style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '15px' }}>
          Настройте последовательность выполнения работ для расчёта критического пути
        </p>
      </div>

      {/* Панель фильтров */}
      <div style={cardStyle}>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '16px', 
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ 
                fontSize: '12px', 
                color: isDark ? '#94a3b8' : '#64748b', 
                display: 'block', 
                marginBottom: '4px',
                fontWeight: '600'
              }}>
                Объект строительства *
              </label>
              <select 
                value={selectedCity} 
                onChange={(e) => setSelectedCity(e.target.value)}
                style={{
                  ...selectStyle,
                  borderColor: !selectedCity ? '#d4b896' : (isDark ? '#0f3460' : '#e2e8f0'),
                  minWidth: '220px'
                }}
              >
                <option value="">-- Выберите объект --</option>
                {cities.map(city => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>

            {selectedCity && (
              <>
                <select 
                  value={selectedType} 
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Все отделы</option>
                  {Object.entries(scheduleTypes).map(([key, val]) => (
                    <option key={key} value={key}>{val.icon} {val.name}</option>
                  ))}
                </select>

                <select 
                  value={selectedStage} 
                  onChange={(e) => setSelectedStage(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Все этапы</option>
                  {[...new Set(schedules.map(s => s.construction_stage).filter(Boolean))].map(stage => (
                    <option key={stage} value={stage}>{stage}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowCriticalPath(!showCriticalPath)}
              style={buttonStyle(showCriticalPath, '#d4a0a0')}
              disabled={!selectedCity}
            >
              <span>🔥</span>
              {showCriticalPath ? 'Скрыть КП' : 'Критический путь'}
            </button>
            
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              style={buttonStyle(showTemplates, '#a99bc4')}
            >
              <span>📋</span>
              Шаблоны работ
            </button>
          </div>
        </div>
      </div>

      {/* Информация о критическом пути */}
      {showCriticalPath && criticalPath.length > 0 && (
        <div style={{
          ...cardStyle,
          background: isDark 
            ? 'linear-gradient(135deg, #5c3a3a 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #f5e6e6 0%, #ffffff 100%)',
          borderColor: '#d4a0a0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span style={{ fontSize: '28px' }}>🔥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Критический путь</h3>
              <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#d4a0a0' : '#a67878' }}>
                {criticalPath.length} задач на критическом пути
              </p>
            </div>
          </div>
          <p style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b', margin: 0 }}>
            Задержка любой из этих задач сдвинет срок завершения всего проекта
          </p>
        </div>
      )}

      {/* Панель шаблонов */}
      {showTemplates && (
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📋</span> Шаблоны работ
          </h3>
          
          {/* Форма создания шаблона */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '12px',
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: isDark ? '#0f3460' : '#f1f5f9',
            borderRadius: '8px'
          }}>
            <input
              type="text"
              placeholder="Наименование работы"
              value={newTemplate.work_name}
              onChange={(e) => setNewTemplate({...newTemplate, work_name: e.target.value})}
              style={{
                ...selectStyle,
                minWidth: 'auto'
              }}
            />
            <select
              value={newTemplate.schedule_type}
              onChange={(e) => setNewTemplate({...newTemplate, schedule_type: e.target.value})}
              style={{...selectStyle, minWidth: 'auto'}}
            >
              {Object.entries(scheduleTypes).map(([key, val]) => (
                <option key={key} value={key}>{val.name}</option>
              ))}
            </select>
            <select
              value={newTemplate.construction_stage_id}
              onChange={(e) => setNewTemplate({...newTemplate, construction_stage_id: e.target.value})}
              style={{...selectStyle, minWidth: 'auto'}}
            >
              <option value="">Без этапа</option>
              {stages.map(stage => (
                <option key={stage.id} value={stage.id}>{stage.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Длительность (дни)"
              value={newTemplate.typical_duration}
              onChange={(e) => setNewTemplate({...newTemplate, typical_duration: e.target.value})}
              style={{...selectStyle, minWidth: 'auto'}}
            />
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '14px',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={newTemplate.can_parallel}
                onChange={(e) => setNewTemplate({...newTemplate, can_parallel: e.target.checked})}
                style={{ width: '18px', height: '18px' }}
              />
              Параллельная
            </label>
            <button
              onClick={createTemplate}
              disabled={!newTemplate.work_name}
              style={{
                ...buttonStyle(true, '#8bc49a'),
                opacity: newTemplate.work_name ? 1 : 0.5,
                justifyContent: 'center'
              }}
            >
              <span>+</span> Добавить
            </button>
          </div>

          {/* Список шаблонов */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {templates.map(template => (
              <div key={template.id} style={{
                ...tagStyle(scheduleTypes[template.schedule_type]?.color || '#64748b'),
                padding: '8px 12px'
              }}>
                {template.work_name}
                {template.typical_duration && <span style={{ opacity: 0.7 }}> ({template.typical_duration}д)</span>}
                {template.can_parallel && <span title="Может выполняться параллельно">⇉</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Панель создания связи */}
      {isCreatingLink && (
        <div style={{
          ...cardStyle,
          background: isDark 
            ? 'linear-gradient(135deg, #1e3a5f 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
          borderColor: '#7b9eb8'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>🔗</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Создание связи</h3>
                <p style={{ margin: 0, fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                  От: <strong>{getTaskName(selectedPredecessor)}</strong>
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsCreatingLink(false);
                setSelectedPredecessor(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: isDark ? '#94a3b8' : '#64748b'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                Тип связи
              </label>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value)}
                style={selectStyle}
              >
                {Object.entries(linkTypes).map(([key, val]) => (
                  <option key={key} value={key}>{val.icon} {val.name} - {val.desc}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b', display: 'block', marginBottom: '4px' }}>
                Задержка (дни)
              </label>
              <input
                type="number"
                value={lagDays}
                onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                style={{ ...selectStyle, width: '100px' }}
              />
            </div>
            <div style={{ marginTop: '20px', color: isDark ? '#60a5fa' : '#2563eb', fontSize: '14px' }}>
              👆 Теперь кликните на задачу-последователя
            </div>
          </div>
        </div>
      )}

      {/* Предупреждение о выборе объекта */}
      {!selectedCity && (
        <div style={{
          ...cardStyle,
          background: isDark 
            ? 'linear-gradient(135deg, #78350f 0%, #16213e 100%)'
            : 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)',
          borderColor: '#d4b896',
          textAlign: 'center',
          padding: '40px 20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '600' }}>
            Выберите объект строительства
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            color: isDark ? '#fcd34d' : '#92400e',
            maxWidth: '500px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Зависимости между задачами настраиваются отдельно для каждого объекта строительства. 
            Выберите объект из списка выше, чтобы начать работу с его задачами и связями.
          </p>
        </div>
      )}

      {/* Основной контент - две колонки */}
      {selectedCity && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Левая колонка - Список задач */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📝</span> Задачи ({filteredSchedules.length})
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 'normal', 
              color: isDark ? '#94a3b8' : '#64748b',
              marginLeft: 'auto'
            }}>
              {cities.find(c => c.id === parseInt(selectedCity))?.name}
            </span>
          </h3>

          <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
            {filteredSchedules.map(schedule => {
              const city = cities.find(c => c.id === schedule.city_id);
              const type = scheduleTypes[schedule.schedule_type];
              const isCritical = showCriticalPath && criticalPath.includes(schedule.id);
              const isSelected = selectedPredecessor?.id === schedule.id;
              
              // Считаем связи
              const predecessorCount = dependencies.filter(d => d.successor_id === schedule.id).length;
              const successorCount = dependencies.filter(d => d.predecessor_id === schedule.id).length;

              return (
                <div
                  key={schedule.id}
                  style={taskCardStyle(schedule, isSelected, isCritical)}
                  onClick={() => {
                    if (isCreatingLink && selectedPredecessor && selectedPredecessor.id !== schedule.id) {
                      createDependency(schedule.id);
                    } else if (!isCreatingLink) {
                      setSelectedPredecessor(schedule);
                      setIsCreatingLink(true);
                    }
                  }}
                >
                  {/* Бейдж критического пути */}
                  {isCritical && (
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '12px',
                      background: '#d4a0a0',
                      color: '#fff',
                      padding: '2px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600'
                    }}>
                      🔥 Критический
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>
                        {getTaskName(schedule)}
                      </div>
                      <div style={{ fontSize: '13px', color: isDark ? '#94a3b8' : '#64748b' }}>
                        {city?.name} • {schedule.construction_stage || 'Без этапа'}
                      </div>
                    </div>
                    <span style={tagStyle(type?.color || '#64748b')}>
                      {type?.icon} {type?.name}
                    </span>
                  </div>

                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0'
                  }}>
                    <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>
                      📅 {new Date(schedule.planned_start_date).toLocaleDateString('ru-RU')} — {new Date(schedule.planned_end_date).toLocaleDateString('ru-RU')}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {predecessorCount > 0 && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          backgroundColor: isDark ? '#374151' : '#e5e7eb',
                          color: isDark ? '#9ca3af' : '#6b7280'
                        }}>
                          ← {predecessorCount}
                        </span>
                      )}
                      {successorCount > 0 && (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          backgroundColor: isDark ? '#374151' : '#e5e7eb',
                          color: isDark ? '#9ca3af' : '#6b7280'
                        }}>
                          {successorCount} →
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Правая колонка - Связи */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔗</span> Зависимости ({dependencies.length})
          </h3>

          {dependencies.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: isDark ? '#64748b' : '#94a3b8'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
              <p style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>Нет связей между задачами</p>
              <p style={{ fontSize: '14px' }}>
                Кликните на задачу слева, чтобы создать связь
              </p>
            </div>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '8px' }}>
              {dependencies.map(dep => {
                const linkInfo = linkTypes[dep.link_type];
                const predType = scheduleTypes[dep.predecessor_type];
                const succType = scheduleTypes[dep.successor_type];
                
                return (
                  <div
                    key={dep.id}
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                      marginBottom: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        {/* Предшественник */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ 
                            fontSize: '11px', 
                            color: isDark ? '#64748b' : '#94a3b8',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Предшественник
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={tagStyle(predType?.color || '#64748b')}>
                              {predType?.icon}
                            </span>
                            <span style={{ fontWeight: '500' }}>{dep.predecessor_name || 'Неизвестно'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                            {dep.predecessor_stage || 'Без этапа'}
                          </div>
                        </div>

                        {/* Стрелка с типом связи */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 12px',
                          backgroundColor: isDark ? '#0f3460' : '#e0f2fe',
                          borderRadius: '8px',
                          marginBottom: '12px',
                          width: 'fit-content'
                        }}>
                          <span style={{ fontSize: '18px' }}>{linkInfo?.icon}</span>
                          <span style={{ fontSize: '13px', fontWeight: '500' }}>
                            {linkInfo?.desc}
                          </span>
                          {dep.lag_days !== 0 && (
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '600',
                              backgroundColor: dep.lag_days > 0 ? '#fef3c7' : '#dcfce7',
                              color: dep.lag_days > 0 ? '#92400e' : '#166534'
                            }}>
                              {dep.lag_days > 0 ? '+' : ''}{dep.lag_days}д
                            </span>
                          )}
                        </div>

                        {/* Последователь */}
                        <div>
                          <div style={{ 
                            fontSize: '11px', 
                            color: isDark ? '#64748b' : '#94a3b8',
                            marginBottom: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            Последователь
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={tagStyle(succType?.color || '#64748b')}>
                              {succType?.icon}
                            </span>
                            <span style={{ fontWeight: '500' }}>{dep.successor_name || 'Неизвестно'}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: isDark ? '#64748b' : '#94a3b8', marginTop: '2px' }}>
                            {dep.successor_stage || 'Без этапа'}
                          </div>
                        </div>
                      </div>

                      {/* Кнопка удаления */}
                      <button
                        onClick={() => deleteDependency(dep.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '20px',
                          cursor: 'pointer',
                          color: isDark ? '#64748b' : '#94a3b8',
                          padding: '4px',
                          borderRadius: '4px',
                          transition: 'all 0.2s'
                        }}
                        title="Удалить связь"
                        onMouseEnter={(e) => {
                          e.target.style.color = '#d4a0a0';
                          e.target.style.backgroundColor = isDark ? '#5c3a3a' : '#f5e6e6';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = isDark ? '#64748b' : '#94a3b8';
                          e.target.style.backgroundColor = 'transparent';
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Легенда типов связей */}
      {selectedCity && (
        <>
          <div style={{
            ...cardStyle,
            marginTop: '24px'
          }}>
            <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '14px', fontWeight: '600' }}>
              📖 Типы связей между задачами
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
              {Object.entries(linkTypes).map(([key, val]) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                  borderRadius: '8px'
                }}>
                  <span style={{ fontSize: '24px' }}>{val.icon}</span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '13px' }}>{val.name} ({key})</div>
                    <div style={{ fontSize: '12px', color: isDark ? '#94a3b8' : '#64748b' }}>{val.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Подсказка */}
          <div style={{
            marginTop: '16px',
            padding: '16px',
            backgroundColor: isDark ? '#1e3a5f20' : '#eff6ff',
            borderRadius: '8px',
            border: isDark ? '1px solid #1e3a5f' : '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '24px' }}>💡</span>
            <div style={{ fontSize: '14px', color: isDark ? '#93c5fd' : '#1e40af' }}>
              <strong>Как создать связь:</strong> Кликните на задачу-предшественника (от которой зависит другая), 
              выберите тип связи и задержку, затем кликните на задачу-последователя (которая зависит).
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DependencyManager;
