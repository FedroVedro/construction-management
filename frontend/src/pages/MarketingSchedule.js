import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import CalendarGanttChart from '../components/Dashboard/CalendarGanttChart';
import StageAutocomplete from '../components/StageAutocomplete';
import ScheduleFilters from '../components/ScheduleFilters';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';

const MarketingSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [unsavedRows, setUnsavedRows] = useState({});
  const [filterStage, setFilterStage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);
  const [stages, setStages] = useState([]);
  const { user } = useAuth();

  const canEdit = user?.role !== 'director' && 
    (user?.role === 'admin' || user?.department === 'Отдел маркетинга');

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
          schedule_type: 'marketing',
          city_id: selectedCity 
        }
      });
      const savedSchedules = response.data;
      const cityUnsavedRows = unsavedRows[selectedCity] || [];
      let allSchedules = [...savedSchedules, ...cityUnsavedRows];
      
      allSchedules = applyScheduleOrder(allSchedules, selectedCity, 'marketing');
      
      setSchedules(allSchedules);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const getFilteredSchedules = () => {
    let filtered = schedules;
    
    if (filterStage) {
      filtered = filtered.filter(s => s.construction_stage === filterStage);
    }
    
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(s => 
        s.construction_stage?.toLowerCase().includes(search) ||
        s.work_name?.toLowerCase().includes(search)
      );
    }
    
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
        const updatedSchedules = schedules.map(s => {
          if (s.id === scheduleId) {
            const updated = { ...s };
            if (field === 'days_before_rns' || field === 'duration') {
              updated[field] = value ? parseInt(value) : '';
            } else {
              updated[field] = value;
            }
            return updated;
          }
          return s;
        });
        
        setSchedules(updatedSchedules);
        
        const cityUnsaved = updatedSchedules.filter(s => 
          s.id.toString().startsWith('new-') && s.city_id === selectedCity
        );
        setUnsavedRows(prev => ({
          ...prev,
          [selectedCity]: cityUnsaved
        }));
        
        const schedule = updatedSchedules.find(s => s.id === scheduleId);
        
        const canSave = schedule.construction_stage && 
                        schedule.planned_start_date && 
                        schedule.planned_end_date;
        
        if (canSave) {
          console.log('Creating new schedule with data:', schedule);
          
          const requestData = {
            schedule_type: schedule.schedule_type,
            city_id: parseInt(selectedCity),
            construction_stage: schedule.construction_stage.trim(),
            planned_start_date: schedule.planned_start_date,
            planned_end_date: schedule.planned_end_date,
            ...(schedule.work_name && { work_name: schedule.work_name.trim() }),
            ...(schedule.days_before_rns && { days_before_rns: parseInt(schedule.days_before_rns) }),
            ...(schedule.duration && { duration: parseInt(schedule.duration) }),
            ...(schedule.actual_start_date && { actual_start_date: schedule.actual_start_date }),
            ...(schedule.actual_end_date && { actual_end_date: schedule.actual_end_date })
          };
          
          const response = await client.post('/schedules', requestData);
          
          setSchedules(schedules.map(s => 
            s.id === scheduleId ? { ...response.data, isNew: false } : s
          ));
          
          setUnsavedRows(prev => {
            const updated = { ...prev };
            updated[selectedCity] = updated[selectedCity]?.filter(row => row.id !== scheduleId) || [];
            return updated;
          });
        }
      } else {
        let processedValue = value;
        
        if (field === 'days_before_rns' || field === 'duration') {
          processedValue = value ? parseInt(value) : null;
        } else if (typeof value === 'string') {
          processedValue = value.trim() || null;
        }
        
        const updateData = {};
        updateData[field] = processedValue;
        
        await client.put(`/schedules/${scheduleId}`, updateData);
        
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
      fetchSchedules();
    }
  };

  const addNewRow = () => {
    if (!selectedCity) {
      alert('Пожалуйста, выберите город');
      return;
    }
    
    const newRow = {
      id: `new-${Date.now()}`,
      schedule_type: 'marketing',
      city_id: selectedCity,
      construction_stage: '',
      work_name: '',
      days_before_rns: '',
      duration: '',
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
    
    const fromSchedule = filteredSchedules[fromIndex];
    const toSchedule = filteredSchedules[toIndex];
    
    const realFromIndex = schedules.findIndex(s => s.id === fromSchedule.id);
    const realToIndex = schedules.findIndex(s => s.id === toSchedule.id);
    
    const newSchedules = [...schedules];
    const [movedItem] = newSchedules.splice(realFromIndex, 1);
    newSchedules.splice(realToIndex, 0, movedItem);
    
    setSchedules(newSchedules);
    
    saveScheduleOrder(selectedCity, 'marketing', newSchedules);
    
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

  const renderCell = (schedule, field, value) => {
    const isDateField = field.includes('date');
    const isNumberField = field === 'days_before_rns' || field === 'duration';

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
      <h1>Маркетинг и продажи</h1>
      
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
            selectedView="marketing"
          />
        </div>
      ) : (
        <>
          <div className="card-full-width" style={{ padding: 0, overflow: 'visible' }}>
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table className="table po-table" style={{ 
                marginBottom: 0, 
                borderCollapse: 'collapse',
                border: '1px solid #dee2e6'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '50px', border: '1px solid #dee2e6', padding: '8px' }}>№</th>
                    {canEdit && <th style={{ width: '70px', border: '1px solid #dee2e6', padding: '8px' }}>Порядок</th>}
                    <th style={{ minWidth: '180px', position: 'relative', border: '1px solid #dee2e6', padding: '8px' }}>Этап строительства</th>
                    <th style={{ minWidth: '250px', border: '1px solid #dee2e6', padding: '8px' }}>Наименование работ</th>
                    <th style={{ minWidth: '120px', border: '1px solid #dee2e6', padding: '8px' }}>Дней до РНС</th>
                    <th style={{ minWidth: '100px', border: '1px solid #dee2e6', padding: '8px' }}>Длительность</th>
                    <th style={{ minWidth: '130px', border: '1px solid #dee2e6', padding: '8px' }}>План начало</th>
                    <th style={{ minWidth: '130px', border: '1px solid #dee2e6', padding: '8px' }}>План конец</th>
                    <th style={{ minWidth: '130px', border: '1px solid #dee2e6', padding: '8px' }}>Факт начало</th>
                    <th style={{ minWidth: '130px', border: '1px solid #dee2e6', padding: '8px' }}>Факт конец</th>
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
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'days_before_rns', schedule.days_before_rns)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'duration', schedule.duration)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'planned_start_date', schedule.planned_start_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'planned_end_date', schedule.planned_end_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'actual_start_date', schedule.actual_start_date)}</td>
                      <td style={{ border: '1px solid #dee2e6', padding: '8px' }}>{renderCell(schedule, 'actual_end_date', schedule.actual_end_date)}</td>
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
                  {canEdit && getFilteredSchedules().length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 11 : 9} style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
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

export default MarketingSchedule;

