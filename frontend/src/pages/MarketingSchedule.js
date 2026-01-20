import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import CalendarGanttChart from '../components/Dashboard/CalendarGanttChart';
import StageAutocomplete from '../components/StageAutocomplete';
import ScheduleFilters from '../components/ScheduleFilters';
import ScheduleToolbar from '../components/ScheduleToolbar';
import QuickDatePicker from '../components/QuickDatePicker';
import RowActions from '../components/RowActions';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';
import { saveSelectedCity, getSelectedCity, saveViewMode, getViewMode } from '../utils/userPreferences';
import { validateDates, prepareRowForCopy } from '../utils/scheduleHelpers';

// Колонки для экспорта
const EXPORT_COLUMNS = [
  { field: 'construction_stage', label: 'Этап строительства', type: 'text' },
  { field: 'work_name', label: 'Наименование работ', type: 'text' },
  { field: 'days_before_rns', label: 'Дней до РНС', type: 'number' },
  { field: 'duration', label: 'Длительность', type: 'number' },
  { field: 'planned_start_date', label: 'План начало', type: 'date' },
  { field: 'planned_end_date', label: 'План конец', type: 'date' },
  { field: 'actual_start_date', label: 'Факт начало', type: 'date' },
  { field: 'actual_end_date', label: 'Факт конец', type: 'date' },
  { field: 'cost_plan', label: 'Стоимость план', type: 'number' },
  { field: 'cost_fact', label: 'Стоимость факт', type: 'number' }
];

const MarketingSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showCalendar, setShowCalendar] = useState(() => getViewMode('marketing') === 'calendar');
  const [unsavedRows, setUnsavedRows] = useState({});
  const [filterStage, setFilterStage] = useState('');
  const [searchText, setSearchText] = useState('');
  const [showOnlyDelayed, setShowOnlyDelayed] = useState(false);
  const [stages, setStages] = useState([]);
  const [dateErrors, setDateErrors] = useState({});
  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useToast();

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

  useEffect(() => {
    const errors = {};
    schedules.forEach(s => {
      const planValidation = validateDates(s.planned_start_date, s.planned_end_date);
      const factValidation = validateDates(s.actual_start_date, s.actual_end_date);
      
      if (!planValidation.valid) errors[`${s.id}_plan`] = planValidation.error;
      if (!factValidation.valid) errors[`${s.id}_fact`] = factValidation.error;
    });
    setDateErrors(errors);
  }, [schedules]);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      // Фильтруем только объекты, которые должны отображаться в графиках
      const visibleCities = response.data.filter(city => city.visible_in_schedules !== false);
      setCities(visibleCities);
      if (visibleCities.length > 0) {
        const savedCity = getSelectedCity();
        const cityExists = visibleCities.some(c => c.id === savedCity);
        setSelectedCity(cityExists ? savedCity : visibleCities[0].id);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
      showError('Ошибка при загрузке списка объектов');
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
      showError('Ошибка при загрузке графика');
    }
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
    saveSelectedCity(cityId);
  };

  const handleViewModeChange = () => {
    const newMode = !showCalendar;
    setShowCalendar(newMode);
    saveViewMode('marketing', newMode ? 'calendar' : 'table');
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
          const dateValidation = validateDates(schedule.planned_start_date, schedule.planned_end_date);
          if (!dateValidation.valid) {
            showWarning(dateValidation.error);
            return;
          }

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
          
          showSuccess('Запись успешно создана');
        }
      } else {
        let processedValue = value;
        
        if (field === 'days_before_rns' || field === 'duration') {
          processedValue = value ? parseInt(value) : null;
        } else if (field === 'cost_plan' || field === 'cost_fact') {
          processedValue = (value === '' || value == null) ? null : (isNaN(parseFloat(value)) ? null : parseFloat(value));
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
      if (error.response?.data?.detail) {
        if (typeof error.response.data.detail === 'string') {
          showError(`Ошибка: ${error.response.data.detail}`);
        } else if (Array.isArray(error.response.data.detail)) {
          const messages = error.response.data.detail.map(e => `${e.loc.join('.')}: ${e.msg}`).join(', ');
          showError(`Ошибки валидации: ${messages}`);
        }
      } else {
        showError('Ошибка при сохранении данных');
      }
      fetchSchedules();
    }
  };

  const addNewRow = () => {
    if (!selectedCity) {
      showInfo('Пожалуйста, выберите город');
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
      cost_plan: '',
      cost_fact: '',
      isNew: true
    };
    setSchedules([...schedules, newRow]);
    showInfo('Добавлена новая строка');
  };

  const copyRow = (schedule) => {
    const copy = prepareRowForCopy(schedule, 'marketing');
    copy.city_id = selectedCity;
    setSchedules([...schedules, copy]);
    showSuccess('Строка скопирована');
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
          showSuccess('Строка удалена');
        } else {
          await client.delete(`/schedules/${id}`);
          showSuccess('Запись удалена');
          fetchSchedules();
        }
      } catch (error) {
        console.error('Error deleting schedule:', error);
        if (error.response?.data?.detail) {
          showError(`Ошибка: ${error.response.data.detail}`);
        } else {
          showError('Ошибка при удалении');
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

  const renderCell = (schedule, field, value) => {
    const isNumberField = field === 'days_before_rns' || field === 'duration';
    const isCostField = field.includes('cost');
    const isDateField = field.includes('date');
    const hasDateError = dateErrors[`${schedule.id}_${field.includes('actual') ? 'fact' : 'plan'}`];

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

    // Даты с быстрым выбором
    if (isDateField) {
      const isEndDate = field.includes('end');
      const relatedDateField = isEndDate ? field.replace('end', 'start') : null;
      const relatedDate = relatedDateField ? schedule[relatedDateField] : null;
      
      return (
        <div style={{ position: 'relative' }}>
          <QuickDatePicker
            value={value}
            onChange={(newValue) => {
              setSchedules(prev => prev.map(s => 
                s.id === schedule.id ? { ...s, [field]: newValue } : s
              ));
            }}
            onSave={(newValue) => saveCell(schedule.id, field, newValue)}
            disabled={!canEdit}
            isEndDate={isEndDate}
            relatedDate={relatedDate}
          />
          {hasDateError && isEndDate && (
            <div style={{
              position: 'absolute',
              bottom: '-18px',
              left: 0,
              fontSize: '11px',
              color: '#dc3545',
              whiteSpace: 'nowrap'
            }}>
              ⚠️ {hasDateError}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={isNumberField ? 'number' : 'text'}
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
          width: '100%'
        }}
        disabled={!canEdit}
      />
    );
  };

  const filteredSchedules = getFilteredSchedules();

  return (
    <div className="container-fluid">
      <h1>График маркетинга и продаж</h1>
      
      {/* Табы городов */}
      <div style={{ 
        borderBottom: '2px solid var(--border-color)', 
        marginBottom: '16px'
      }}>
        <div style={{ 
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          paddingBottom: '8px'
        }}>
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => handleCityChange(city.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: selectedCity === city.id ? '#007bff' : 'var(--table-stripe)',
                color: selectedCity === city.id ? '#fff' : 'var(--text-muted)',
                fontWeight: selectedCity === city.id ? '600' : 'normal',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                boxShadow: selectedCity === city.id ? '0 2px 8px rgba(0, 123, 255, 0.3)' : 'none'
              }}
            >
              {city.name}
            </button>
          ))}
        </div>
      </div>

      {/* Панель инструментов */}
      <ScheduleToolbar
        schedules={filteredSchedules}
        columns={EXPORT_COLUMNS}
        filename="marketing_schedule"
        onAddRow={canEdit ? addNewRow : null}
        onRefresh={fetchSchedules}
        canEdit={canEdit}
        scheduleType="marketing"
        cities={cities}
        selectedCity={selectedCity}
        showCalendar={showCalendar}
        onToggleCalendar={handleViewModeChange}
      />

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
                padding: 40, 
                marginBottom: 0, 
                borderCollapse: 'collapse',
                border: '1px solid var(--border-color)'
              }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--table-stripe)', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '50px', border: '1px solid var(--border-color)', padding: '8px' }}>№</th>
                    {canEdit && <th style={{ width: '90px', border: '1px solid var(--border-color)', padding: '8px' }}>Действия</th>}
                    <th style={{ minWidth: '200px', border: '1px solid var(--border-color)', padding: '8px' }}>Этап строительства</th>
                    <th style={{ minWidth: '250px', border: '1px solid var(--border-color)', padding: '8px' }}>Наименование работ</th>
                    <th style={{ minWidth: '100px', border: '1px solid var(--border-color)', padding: '8px' }}>Дней до РНС</th>
                    <th style={{ minWidth: '100px', border: '1px solid var(--border-color)', padding: '8px' }}>Длительность</th>
                    <th style={{ minWidth: '160px', border: '1px solid var(--border-color)', padding: '8px' }}>План начало</th>
                    <th style={{ minWidth: '160px', border: '1px solid var(--border-color)', padding: '8px' }}>План конец</th>
                    <th style={{ minWidth: '160px', border: '1px solid var(--border-color)', padding: '8px' }}>Факт начало</th>
                    <th style={{ minWidth: '160px', border: '1px solid var(--border-color)', padding: '8px' }}>Факт конец</th>
                    <th style={{ minWidth: '130px', border: '1px solid var(--border-color)', padding: '8px' }}>Стоимость план</th>
                    <th style={{ minWidth: '130px', border: '1px solid var(--border-color)', padding: '8px' }}>Стоимость факт</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((schedule, index) => {
                    const rowStyle = schedule.isNew ? { backgroundColor: '#e8f5e9' } : {};
                    
                    return (
                      <tr key={schedule.id} style={{ 
                        ...rowStyle,
                        transition: 'background-color 0.3s'
                      }}>
                        <td style={{ textAlign: 'center', border: '1px solid var(--border-color)', padding: '8px' }}>
                          {schedule.isNew ? '★' : index + 1}
                        </td>
                        {canEdit && (
                          <td style={{ textAlign: 'center', border: '1px solid var(--border-color)', padding: '8px' }}>
                            <RowActions
                              onCopy={() => copyRow(schedule)}
                              onDelete={() => deleteRow(schedule.id)}
                              onMoveUp={() => moveRow(index, index - 1)}
                              onMoveDown={() => moveRow(index, index + 1)}
                              canMoveUp={index > 0}
                              canMoveDown={index < filteredSchedules.length - 1}
                              isNew={schedule.isNew}
                            />
                          </td>
                        )}
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'construction_stage', schedule.construction_stage)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'work_name', schedule.work_name)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'days_before_rns', schedule.days_before_rns)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'duration', schedule.duration)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'planned_start_date', schedule.planned_start_date)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'planned_end_date', schedule.planned_end_date)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'actual_start_date', schedule.actual_start_date)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'actual_end_date', schedule.actual_end_date)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'cost_plan', schedule.cost_plan)}</td>
                        <td style={{ border: '1px solid var(--border-color)', padding: '8px' }}>{renderCell(schedule, 'cost_fact', schedule.cost_fact)}</td>
                      </tr>
                    );
                  })}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 12 : 11} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📈</div>
                        <div>Нет данных для отображения</div>
                        {canEdit && (
                          <button onClick={addNewRow} className="btn btn-primary" style={{ marginTop: '16px' }}>
                            + Добавить первую строку
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!canEdit && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: 'var(--table-stripe)',
              borderRadius: '4px',
              color: 'var(--text-muted)',
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
