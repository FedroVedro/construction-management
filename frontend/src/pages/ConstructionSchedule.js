import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import CalendarGanttChart from '../components/Dashboard/CalendarGanttChart';
import StageAutocomplete from '../components/StageAutocomplete';
import ScheduleFilters from '../components/ScheduleFilters';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';

const ConstructionSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [unsavedRows, setUnsavedRows] = useState({}); // Добавляем хранилище несохраненных строк
  const [filterStage, setFilterStage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);
  const [stages, setStages] = useState([]);
  const { user } = useAuth();

  const canEdit = user?.role !== 'director' && 
    (user?.role === 'admin' || user?.department === 'Строительный отдел');

  useEffect(() => {
    fetchCities();
    fetchStages();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchSchedules();
    }
  }, [selectedCity]);

  // Автоматическая настройка высоты textarea после загрузки данных
  useEffect(() => {
    const adjustTextareaHeights = () => {
      const textareas = document.querySelectorAll('textarea[data-auto-resize="true"]');
      textareas.forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    };
    
    // Дать DOM обновиться
    const timeoutId = setTimeout(adjustTextareaHeights, 0);
    return () => clearTimeout(timeoutId);
  }, [schedules]);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      setCities(response.data);
      if (response.data.length > 0) {
        setSelectedCity(response.data[0].id);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };
  const fetchStages = async () => {
    try {
      const response = await client.get('/construction-stages?active_only=true');
      setStages(response.data);
    } catch (error) {
      console.error('Error fetching stages:', error);
    }
  };

const fetchSchedules = async () => {
  try {
    const response = await client.get('/schedules', {
      params: { 
        schedule_type: 'construction',
        city_id: selectedCity 
      }
    });
    // Добавляем несохраненные строки для этого города, если есть
    const savedSchedules = response.data;
    const cityUnsavedRows = unsavedRows[selectedCity] || [];
    let allSchedules = [...savedSchedules, ...cityUnsavedRows];
    
    // Применяем сохраненный порядок
    allSchedules = applyScheduleOrder(allSchedules, selectedCity, 'construction');
    
    setSchedules(allSchedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
  }
};
  const getFilteredSchedules = () => {
    let filtered = schedules;
    
    // Фильтр по этапу
    if (filterStage) {
      filtered = filtered.filter(s => s.construction_stage === filterStage);
    }
    
    // Поиск
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(s => 
        s.construction_stage?.toLowerCase().includes(search) ||
        s.work_name?.toLowerCase().includes(search) // Изменено с sections на work_name
      );
    }
    
    // Показать только с задержкой
    if (showOnlyDelayed) {
      filtered = filtered.filter(s => {
        if (!s.actual_end_date || !s.planned_end_date) return false;
        return new Date(s.actual_end_date) > new Date(s.planned_end_date);
      });
    }
    
    return filtered;
  };

  const saveCell = async (scheduleId, field, value) => {
    try {
      const isNewRow = scheduleId.toString().startsWith('new-');
      
      if (isNewRow) {
        // Для новых записей обновляем локально
        const updatedSchedules = schedules.map(s => {
          if (s.id === scheduleId) {
            const updated = { ...s };
            if (field === 'quantity_plan' || field === 'quantity_fact' || field === 'workers_count') {
              updated[field] = value ? parseInt(value) : '';
            } else if (field === 'cost_plan' || field === 'cost_fact') {
              updated[field] = value === '' ? '' : (isNaN(parseFloat(value)) ? '' : parseFloat(value));
            } else {
              updated[field] = value;
            }
            return updated;
          }
          return s;
        });
        
        setSchedules(updatedSchedules);
        
        // Обновляем несохраненные строки для города
        const cityUnsaved = updatedSchedules.filter(s => 
          s.id.toString().startsWith('new-') && s.city_id === selectedCity
        );
        setUnsavedRows(prev => ({
          ...prev,
          [selectedCity]: cityUnsaved
        }));
        
        // Проверяем минимальные обязательные поля
        const schedule = updatedSchedules.find(s => s.id === scheduleId);
        
        // Упрощенная проверка - только обязательные поля
        const canSave = schedule.construction_stage && 
                        schedule.planned_start_date && 
                        schedule.planned_end_date;
        
        if (canSave) {
          console.log('Creating new schedule with data:', schedule);
          
          // Подготавливаем данные для отправки
          const requestData = {
            schedule_type: schedule.schedule_type,
            city_id: parseInt(selectedCity),
            construction_stage: schedule.construction_stage.trim(),
            planned_start_date: schedule.planned_start_date,
            planned_end_date: schedule.planned_end_date,
            // Добавляем остальные поля только если они заполнены
            ...(schedule.work_name && { work_name: schedule.work_name.trim() }),
            ...(schedule.workers_count && { workers_count: parseInt(schedule.workers_count) }),
            ...(schedule.actual_start_date && { actual_start_date: schedule.actual_start_date }),
            ...(schedule.actual_end_date && { actual_end_date: schedule.actual_end_date })
          };
          
          // Создаем новую запись в БД
          const response = await client.post('/schedules', requestData);
          
          // Заменяем временный ID на реальный
          setSchedules(schedules.map(s => 
            s.id === scheduleId ? { ...response.data, isNew: false } : s
          ));
          
          // Удаляем из несохраненных
          setUnsavedRows(prev => {
            const updated = { ...prev };
            updated[selectedCity] = updated[selectedCity]?.filter(row => row.id !== scheduleId) || [];
            return updated;
          });
        }
      } else {
        // Обновление существующей записи
        let processedValue = value;
        
        if (field === 'quantity_plan' || field === 'quantity_fact' || field === 'workers_count') {
          processedValue = value ? parseInt(value) : null;
        } else if (field === 'cost_plan' || field === 'cost_fact') {
          processedValue = (value === '' || value == null) ? null : (isNaN(parseFloat(value)) ? null : parseFloat(value));
        } else if (typeof value === 'string') {
          processedValue = value.trim() || null;
        }
        
        const updateData = {};
        updateData[field] = processedValue;
        
        await client.put(`/schedules/${scheduleId}`, updateData);
        
        // Обновляем локально для мгновенного отображения
        setSchedules(schedules.map(s => 
          s.id === scheduleId ? { ...s, [field]: processedValue } : s
        ));
      }
    } catch (error) {
      console.error('Error saving cell:', error);
      console.error('Response data:', error.response?.data);
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          alert(`Ошибка: ${error.response.data.detail}`);
        } else if (Array.isArray(error.response.data.detail)) {
          const messages = error.response.data.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join('\n');
          alert(`Ошибки валидации:\n${messages}`);
        }
      } else {
        alert('Ошибка при сохранении данных');
      }
      fetchSchedules(); // Перезагружаем данные в случае ошибки
    }
  };

  const addNewRow = () => {
    if (!selectedCity) {
      alert('Пожалуйста, выберите город');
      return;
    }
    
    const newRow = {
      id: `new-${Date.now()}`,
      schedule_type: 'construction',
      city_id: selectedCity, // Важно! Добавляем city_id
      construction_stage: '',
      work_name: '',
      workers_count: '',
      planned_start_date: '',
      planned_end_date: '',
      actual_start_date: null,
      actual_end_date: null,
      isNew: true
    };
    setSchedules([...schedules, newRow]);
  };

  const deleteRow = async (id) => {
    if (window.confirm('Удалить эту строку?')) {
      try {
        if (id.toString().startsWith('new-')) {
          setSchedules(schedules.filter(s => s.id !== id));
          // Удаляем из несохраненных
          setUnsavedRows(prev => {
            const updated = { ...prev };
            updated[selectedCity] = updated[selectedCity]?.filter(row => row.id !== id) || [];
            return updated;
          });
        } else {
          await client.delete(`/schedules/${id}`);
          fetchSchedules();
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        if (error.response?.data?.detail) {
          alert(`Ошибка: ${error.response.data.detail}`);
        }
      }
    }
  };
  const moveRow = (fromIndex, toIndex) => {
    const filteredSchedules = getFilteredSchedules();
    if (toIndex < 0 || toIndex >= filteredSchedules.length) return;
    
    // Находим реальные индексы в основном массиве
    const fromSchedule = filteredSchedules[fromIndex];
    const toSchedule = filteredSchedules[toIndex];
    
    const realFromIndex = schedules.findIndex(s => s.id === fromSchedule.id);
    const realToIndex = schedules.findIndex(s => s.id === toSchedule.id);
    
    const newSchedules = [...schedules];
    const [movedItem] = newSchedules.splice(realFromIndex, 1);
    newSchedules.splice(realToIndex, 0, movedItem);
    
    setSchedules(newSchedules);
    
    // Сохраняем новый порядок
    saveScheduleOrder(selectedCity, 'construction', newSchedules);
    
    // Обновляем несохраненные строки для города
    const cityUnsaved = newSchedules.filter(s => 
      s.id.toString().startsWith('new-') && s.city_id === selectedCity
    );
    setUnsavedRows(prev => ({
      ...prev,
      [selectedCity]: cityUnsaved
    }));
  };

  const moveRowUp = (index) => {
    moveRow(index, index - 1);
  };

  const moveRowDown = (index) => {
    moveRow(index, index + 1);
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const formatPrice = (value) => {
    if (!value || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('ru-RU') + ' руб';
  };

  const renderCell = (schedule, field, value) => {
    const isDateField = field.includes('date');
    const isNumberField = field === 'workers_count';
    const isCostField = field.includes('cost');

    if (field === 'construction_stage') {
      return (
        <StageAutocomplete
          value={value || ''}
          onChange={(newValue) => {
            if (newValue && newValue.trim()) {
              saveCell(schedule.id, field, newValue);
            }
          }}
          onBlur={() => {
            // Автосохранение при потере фокуса
            if (value !== schedule.construction_stage) {
              saveCell(schedule.id, field, value);
            }
          }}
        />
      );
    }

    if (field === 'work_name') {
      return (
        <textarea
          value={value || ''}
          placeholder="Наименование работ"
          onChange={(e) => {
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            const newValue = e.target.value;
            setSchedules(prev => prev.map(s => 
              s.id === schedule.id ? { ...s, [field]: newValue } : s
            ));
          }}
          onBlur={() => saveCell(schedule.id, field, value)}
          style={{
            width: '100%',
            resize: 'none',
            overflow: 'hidden',
            lineHeight: '1.4',
            minHeight: '30px'
          }}
          rows={1}
          disabled={!canEdit}
          data-auto-resize="true"
        />
      );
    }

    if (isCostField) {
      return (
        <input
          type="number"
          value={value || ''}
          onChange={(e) => {
            const newValue = e.target.value;
            setSchedules(prev => prev.map(s => 
              s.id === schedule.id ? { ...s, [field]: newValue } : s
            ));
          }}
          onBlur={() => saveCell(schedule.id, field, value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              saveCell(schedule.id, field, value);
            }
          }}
          style={{
            width: '100%',
            textAlign: 'right'
          }}
          disabled={!canEdit}
          placeholder="0"
        />
      );
    }

    return (
      <input
        type={isDateField ? 'date' : isNumberField ? 'number' : 'text'}
        value={isDateField ? formatDateForInput(value) : (value || '')}
        onChange={(e) => {
          const newValue = e.target.value;
          setSchedules(prev => prev.map(s => 
            s.id === schedule.id ? { ...s, [field]: newValue } : s
          ));
        }}
        onBlur={() => saveCell(schedule.id, field, value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            saveCell(schedule.id, field, value);
          }
        }}
        style={{
          width: '100%'
        }}
        disabled={!canEdit}
      />
    );
  };

  return (
    <div className="container-fluid">
      <h1>График строительства</h1>
      
      <div style={{ 
        display: 'flex', 
        borderBottom: '2px solid #dee2e6',
        marginBottom: '20px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex' }}>
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => setSelectedCity(city.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: selectedCity === city.id ? '2px solid #007bff' : 'none',
                backgroundColor: selectedCity === city.id ? '#f8f9fa' : 'transparent',
                color: selectedCity === city.id ? '#007bff' : '#6c757d',
                fontWeight: selectedCity === city.id ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {city.name}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="btn btn-secondary"
          style={{ marginRight: '20px' }}
        >
          {showCalendar ? '📊 Табличный вид' : '📅 Календарный вид'}
        </button>
      </div>
      {!showCalendar && (
        <ScheduleFilters
          stages={stages}
          selectedStage={filterStage}
          onStageChange={setFilterStage}
          searchText={searchText}
          onSearchChange={setSearchText}
          showOnlyDelayed={showOnlyDelayed}
          onDelayedChange={setShowOnlyDelayed}
        />
      )}
      {showCalendar ? (
        <div className="card-full-width">
          <CalendarGanttChart 
            schedules={schedules} 
            cities={cities}
            selectedView="construction"
          />
        </div>
      ) : (
        <>
          <div className="card-full-width" style={{ padding: 0, overflow: 'visible' }}>
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table className="table po-table" style={{ 
                padding: 40, 
                marginBottom: 0, 
                borderCollapse: 'collapse',
                border: '1px solid #dee2e6'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '50px', border: '1px solid #dee2e6', padding: '8px' }}>№</th>
                    {canEdit && <th style={{ width: '70px', border: '1px solid #dee2e6', padding: '8px' }}>Порядок</th>}
                    <th style={{ minWidth: '200px', border: '1px solid #dee2e6', padding: '8px' }}>Этап строительства</th>
                    <th style={{ minWidth: '250px', border: '1px solid #dee2e6', padding: '8px' }}>Наименование работ</th>
                    <th style={{ minWidth: '120px', border: '1px solid #dee2e6', padding: '8px' }}>Кол-во рабочих</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>План начало</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>План конец</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>Факт начало</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>Факт конец</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>Стоимость план</th>
                    <th style={{ minWidth: '140px', border: '1px solid #dee2e6', padding: '8px' }}>Стоимость факт</th>
                    {canEdit && <th style={{ width: '80px', border: '1px solid #dee2e6', padding: '8px' }}>Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredSchedules().map((schedule, index) => (
                    <tr key={schedule.id} style={{ 
                      backgroundColor: schedule.isNew ? '#e8f5e9' : 'transparent',
                      transition: 'background-color 0.3s'
                    }}>
                      <td style={{ textAlign: 'center', border: '1px solid #dee2e6', padding: '8px' }}>
                        {schedule.isNew ? '★' : index + 1}
                      </td>
                      {canEdit && (
                        <td style={{ textAlign: 'center', border: '1px solid #dee2e6', padding: '8px' }}>
                          <button
                            onClick={() => moveRowUp(index)}
                            disabled={index === 0}
                            className="btn btn-sm"
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: '12px',
                              marginRight: '2px',
                              opacity: index === 0 ? 0.5 : 1
                            }}
                            title="Переместить вверх"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => moveRowDown(index)}
                            disabled={index === getFilteredSchedules().length - 1}
                            className="btn btn-sm"
                            style={{ 
                              padding: '2px 6px', 
                              fontSize: '12px',
                              opacity: index === getFilteredSchedules().length - 1 ? 0.5 : 1
                            }}
                            title="Переместить вниз"
                          >
                            ↓
                          </button>
                        </td>
                      )}
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'construction_stage', schedule.construction_stage)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'work_name', schedule.work_name)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'workers_count', schedule.workers_count)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'planned_start_date', schedule.planned_start_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'planned_end_date', schedule.planned_end_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'actual_start_date', schedule.actual_start_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'actual_end_date', schedule.actual_end_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'cost_plan', schedule.cost_plan)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'cost_fact', schedule.cost_fact)}</td>
                      {canEdit && (
                        <td style={{ textAlign: 'center', border: '1px solid #dee2e6', padding: '8px' }}>
                          <button
                            onClick={() => deleteRow(schedule.id)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '2px 8px' }}
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {canEdit && schedules.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                        Нет данных. Нажмите "Добавить строку" для начала работы.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {canEdit && (
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#f8f9fa',
                borderTop: '1px solid #dee2e6',
                textAlign: 'center'
              }}>
                <button 
                  onClick={addNewRow}
                  className="btn btn-primary"
                >
                  + Добавить строку
                </button>
              </div>
            )}
          </div>

          {!canEdit && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#f8f9fa',
              borderRadius: '4px',
              color: '#6c757d',
              fontSize: '14px'
            }}>
              <i>Режим просмотра. У вас нет прав для редактирования этого графика.</i>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConstructionSchedule;