import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import CalendarGanttChart from '../components/Dashboard/CalendarGanttChart';
import StageAutocomplete from '../components/StageAutocomplete';

const HRSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [unsavedRows, setUnsavedRows] = useState({}); // Добавляем хранилище несохраненных строк
  const { user } = useAuth();

  const canEdit = user?.role !== 'director' && 
    (user?.role === 'admin' || user?.department === 'HR отдел');

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchSchedules();
    }
  }, [selectedCity]);

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

  const fetchSchedules = async () => {
    try {
      const response = await client.get('/schedules', {
        params: { 
          schedule_type: 'hr',
          city_id: selectedCity 
        }
      });
      // Добавляем несохраненные строки для этого города, если есть
      const savedSchedules = response.data;
      const cityUnsavedRows = unsavedRows[selectedCity] || [];
      setSchedules([...savedSchedules, ...cityUnsavedRows]);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

  const handleCellClick = (scheduleId, field, value) => {
    if (!canEdit) return;
    setEditingCell(`${scheduleId}-${field}`);
    setTempValue(value || '');
  };

  const handleCellChange = (e) => {
    setTempValue(e.target.value);
  };

  const handleCellBlur = async (scheduleId, field) => {
    if (editingCell === `${scheduleId}-${field}`) {
      await saveCell(scheduleId, field, tempValue);
      setEditingCell(null);
      setTempValue('');
    }
  };

  const handleKeyPress = async (e, scheduleId, field) => {
    if (e.key === 'Enter') {
      await saveCell(scheduleId, field, tempValue);
      setEditingCell(null);
      setTempValue('');
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
      setTempValue('');
    }
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
            ...(schedule.vacancy && { vacancy: schedule.vacancy.trim() }),
            ...(schedule.quantity_plan && { quantity_plan: parseInt(schedule.quantity_plan) }),
            ...(schedule.quantity_fact && { quantity_fact: parseInt(schedule.quantity_fact) }),
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
      schedule_type: 'hr',
      city_id: selectedCity, // Важно! Добавляем city_id
      construction_stage: '',
      vacancy: '',
      quantity_plan: '',
      quantity_fact: '',
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

  const formatDate = (date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('ru-RU');
  };

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  const renderCell = (schedule, field, value) => {
    const cellId = `${schedule.id}-${field}`;
    const isEditing = editingCell === cellId;
    const isDateField = field.includes('date');
    const isNumberField = field.includes('quantity');

    if (isEditing) {
      if (field === 'construction_stage') {
        return (
          <StageAutocomplete
            value={tempValue}
            onChange={(newValue) => {
              setTempValue(newValue);
              if (newValue && newValue.trim()) {
                saveCell(schedule.id, field, newValue);
                setEditingCell(null);
                setTempValue('');
              }
            }}
            onBlur={() => {
              if (!tempValue || tempValue === schedule.construction_stage) {
                setEditingCell(null);
                setTempValue('');
              }
            }}
            autoFocus={true}
          />
        );
      }
      return (
        <input
          type={isDateField ? 'date' : isNumberField ? 'number' : 'text'}
          value={tempValue}
          onChange={handleCellChange}
          onBlur={() => handleCellBlur(schedule.id, field)}
          onKeyDown={(e) => handleKeyPress(e, schedule.id, field)}
          autoFocus
          style={{
            width: '100%',
            border: '2px solid #007bff',
            padding: '4px',
            fontSize: '14px'
          }}
        />
      );
    }

    return (
      <div
        onClick={() => handleCellClick(schedule.id, field, isDateField ? formatDateForInput(value) : value)}
        style={{
          padding: '8px',
          cursor: canEdit ? 'pointer' : 'default',
          minHeight: '30px',
          backgroundColor: canEdit ? '#fff' : '#f8f9fa'
        }}
      >
        {isDateField ? formatDate(value) : value || ''}
      </div>
    );
  };

  return (
    <div className="container-fluid">
      <h1>HR-график</h1>
      
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

      {showCalendar ? (
        <div className="card-full-width">
          <CalendarGanttChart 
            schedules={schedules} 
            cities={cities}
            selectedView="hr"
          />
        </div>
      ) : (
        <>
          <div className="card-full-width" style={{ padding: 0, position: 'relative' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ marginBottom: 0 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '50px' }}>№</th>
                    <th style={{ minWidth: '200px', position: 'relative' }}>Этап строительства</th>
                    <th style={{ minWidth: '250px' }}>Вакансия</th>
                    <th style={{ minWidth: '100px' }}>Кол-во (план)</th>
                    <th style={{ minWidth: '100px' }}>Кол-во (факт)</th>
                    <th style={{ minWidth: '140px' }}>План начало</th>
                    <th style={{ minWidth: '140px' }}>План конец</th>
                    <th style={{ minWidth: '140px' }}>Факт начало</th>
                    <th style={{ minWidth: '140px' }}>Факт конец</th>
                    {canEdit && <th style={{ width: '80px' }}>Действия</th>}
                  </tr>
                </thead>
                <tbody>
                  {schedules.map((schedule, index) => (
                    <tr key={schedule.id} style={{ 
                      backgroundColor: schedule.isNew ? '#e8f5e9' : 'transparent',
                      transition: 'background-color 0.3s'
                    }}>
                      <td style={{ textAlign: 'center' }}>
                        {schedule.isNew ? '★' : index + 1}
                      </td>
                      <td style={{ position: 'relative', overflow: 'visible' }}>
                        {renderCell(schedule, 'construction_stage', schedule.construction_stage)}
                      </td>
                      <td>{renderCell(schedule, 'vacancy', schedule.vacancy)}</td>
                      <td>{renderCell(schedule, 'quantity_plan', schedule.quantity_plan)}</td>
                      <td>{renderCell(schedule, 'quantity_fact', schedule.quantity_fact)}</td>
                      <td>{renderCell(schedule, 'planned_start_date', schedule.planned_start_date)}</td>
                      <td>{renderCell(schedule, 'planned_end_date', schedule.planned_end_date)}</td>
                      <td>{renderCell(schedule, 'actual_start_date', schedule.actual_start_date)}</td>
                      <td>{renderCell(schedule, 'actual_end_date', schedule.actual_end_date)}</td>
                      {canEdit && (
                        <td style={{ textAlign: 'center' }}>
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

export default HRSchedule;