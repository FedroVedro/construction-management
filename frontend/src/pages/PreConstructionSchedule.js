import React, { useState, useEffect, useCallback } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ModernGanttChart from '../components/Dashboard/ModernGanttChart';
import ScheduleToolbar from '../components/ScheduleToolbar';
import QuickDatePicker from '../components/QuickDatePicker';
import RowActions from '../components/RowActions';
import StatusBadge from '../components/StatusBadge';
import { AddRowButtonCompact } from '../components/AddRowButton';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';
import { saveSelectedCity, getSelectedCity, saveViewMode, getViewMode } from '../utils/userPreferences';
import { validateDates, prepareRowForCopy } from '../utils/scheduleHelpers';
import PRE_CONSTRUCTION_TEMPLATE from '../utils/preConstructionTemplate';

const SCHEDULE_TYPE = 'preconstruction';

const EXPORT_COLUMNS = [
  { field: 'construction_stage', label: '№ п/п', type: 'text' },
  { field: 'work_name', label: 'Наименование работ', type: 'text' },
  { field: 'planned_start_date', label: 'План начало', type: 'date' },
  { field: 'planned_end_date', label: 'План конец', type: 'date' },
  { field: 'actual_start_date', label: 'Факт начало', type: 'date' },
  { field: 'actual_end_date', label: 'Факт конец', type: 'date' },
  { field: 'service', label: 'Исполнитель', type: 'text' },
  { field: 'responsible_employee', label: 'Ответственный', type: 'text' },
  { field: 'vacancy', label: 'Документы', type: 'text' },
];

const calcReadiness = (startDate, endDate) => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const total = end - start;
  const elapsed = now - start;
  const pct = Math.round((elapsed / total) * 100);
  return Math.max(0, Math.min(100, pct));
};

const calcDelay = (plannedEnd, actualEnd) => {
  if (!plannedEnd || !actualEnd) return null;
  const pe = new Date(plannedEnd);
  const ae = new Date(actualEnd);
  if (isNaN(pe) || isNaN(ae)) return null;
  return Math.round((ae - pe) / (1000 * 60 * 60 * 24));
};

const isSectionRow = (schedule) => {
  const num = (schedule.construction_stage || '').trim();
  const name = (schedule.work_name || '').trim();
  if (!name) return false;
  if (num && !num.includes('.') && /^\d+$/.test(num)) return true;
  if (!num && name === name.toUpperCase() && /[A-ZА-ЯЁ]/.test(name)) return true;
  return false;
};

const PreConstructionSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [showCalendar, setShowCalendar] = useState(() => getViewMode(SCHEDULE_TYPE) === 'calendar');
  const [unsavedRows, setUnsavedRows] = useState({});
  const [searchText, setSearchText] = useState('');
  const [dateErrors, setDateErrors] = useState({});
  const [templateLoading, setTemplateLoading] = useState(false);
  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useToast();

  const canEdit = user?.role !== 'director' && 
    (user?.role === 'admin' || user?.department === 'ТЗ отдел');

  useEffect(() => { fetchCities(); }, []);

  useEffect(() => {
    if (selectedCity) fetchSchedules();
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
      const visibleCities = response.data.filter(city => city.visible_in_schedules !== false);
      setCities(visibleCities);
      if (visibleCities.length > 0) {
        const savedCity = getSelectedCity();
        const cityExists = visibleCities.some(c => c.id === savedCity);
        setSelectedCity(cityExists ? savedCity : visibleCities[0].id);
      }
    } catch (error) {
      showError('Ошибка при загрузке списка объектов');
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await client.get('/schedules', {
        params: { schedule_type: SCHEDULE_TYPE, city_id: selectedCity }
      });
      const savedSchedules = response.data;
      const cityUnsavedRows = unsavedRows[selectedCity] || [];
      let allSchedules = [...savedSchedules, ...cityUnsavedRows];
      allSchedules = applyScheduleOrder(allSchedules, selectedCity, SCHEDULE_TYPE);
      setSchedules(allSchedules);
    } catch (error) {
      showError('Ошибка при загрузке графика');
    }
  };

  const handleScheduleUpdate = async (scheduleId, updates) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      await client.put(`/schedules/${scheduleId}`, updates, { signal: controller.signal });
      clearTimeout(timeoutId);
      setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, ...updates } : s));
    } catch (error) {
      if (error.name === 'AbortError') {
        showError('Превышено время ожидания сохранения');
      } else {
        showError('Ошибка при обновлении дат');
      }
      throw error;
    }
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
    saveSelectedCity(cityId);
  };

  const handleViewModeChange = () => {
    const newMode = !showCalendar;
    setShowCalendar(newMode);
    saveViewMode(SCHEDULE_TYPE, newMode ? 'calendar' : 'table');
  };

  const getFilteredSchedules = useCallback(() => {
    let filtered = schedules;
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(s => s.work_name?.toLowerCase().includes(search));
    }
    return filtered;
  }, [schedules, searchText]);

  const saveCell = async (scheduleId, field, value) => {
    try {
      const isNewRow = scheduleId.toString().startsWith('new-');
      
      if (isNewRow) {
        const updatedSchedules = schedules.map(s =>
          s.id === scheduleId ? { ...s, [field]: value } : s
        );
        setSchedules(updatedSchedules);
        
        const cityUnsaved = updatedSchedules.filter(s => 
          s.id.toString().startsWith('new-') && s.city_id === selectedCity
        );
        setUnsavedRows(prev => ({ ...prev, [selectedCity]: cityUnsaved }));
        
        const schedule = updatedSchedules.find(s => s.id === scheduleId);
        const canSave = schedule.work_name && schedule.planned_start_date && schedule.planned_end_date;
        
        if (canSave) {
          const dateValidation = validateDates(schedule.planned_start_date, schedule.planned_end_date);
          if (!dateValidation.valid) {
            showWarning(dateValidation.error);
            return;
          }

          const requestData = {
            schedule_type: SCHEDULE_TYPE,
            city_id: parseInt(selectedCity),
            planned_start_date: schedule.planned_start_date,
            planned_end_date: schedule.planned_end_date,
            work_name: schedule.work_name.trim(),
            ...(schedule.construction_stage && { construction_stage: schedule.construction_stage.trim() }),
            ...(schedule.service && { service: schedule.service.trim() }),
            ...(schedule.responsible_employee && { responsible_employee: schedule.responsible_employee.trim() }),
            ...(schedule.vacancy && { vacancy: schedule.vacancy.trim() }),
            ...(schedule.actual_start_date && { actual_start_date: schedule.actual_start_date }),
            ...(schedule.actual_end_date && { actual_end_date: schedule.actual_end_date })
          };
          
          const response = await client.post('/schedules', requestData);
          setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...response.data, isNew: false } : s));
          setUnsavedRows(prev => {
            const updated = { ...prev };
            updated[selectedCity] = updated[selectedCity]?.filter(row => row.id !== scheduleId) || [];
            return updated;
          });
          showSuccess('Запись успешно создана');
        }
      } else {
        let processedValue = value;
        if (typeof value === 'string') {
          processedValue = value.trim() || null;
        }
        await client.put(`/schedules/${scheduleId}`, { [field]: processedValue });
        setSchedules(prev => prev.map(s => s.id === scheduleId ? { ...s, [field]: processedValue } : s));
      }
    } catch (error) {
      showError('Ошибка при сохранении данных');
      fetchSchedules();
    }
  };

  const createEmptyRow = () => ({
    id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    schedule_type: SCHEDULE_TYPE,
    city_id: selectedCity,
    construction_stage: '',
    work_name: '',
    service: '',
    responsible_employee: '',
    vacancy: '',
    planned_start_date: '',
    planned_end_date: '',
    actual_start_date: null,
    actual_end_date: null,
    isNew: true
  });

  const addNewRow = () => {
    if (!selectedCity) { showInfo('Пожалуйста, выберите город'); return; }
    setSchedules(prev => [...prev, createEmptyRow()]);
    showInfo('Добавлена новая строка');
  };

  const insertRowAt = (index, position) => {
    if (!selectedCity) { showInfo('Пожалуйста, выберите город'); return; }
    const filteredSchedules = getFilteredSchedules();
    const targetSchedule = filteredSchedules[index];
    const realIndex = schedules.findIndex(s => s.id === targetSchedule.id);
    const insertIndex = position === 'above' ? realIndex : realIndex + 1;
    const newSchedules = [...schedules];
    newSchedules.splice(insertIndex, 0, createEmptyRow());
    setSchedules(newSchedules);
    saveScheduleOrder(selectedCity, SCHEDULE_TYPE, newSchedules);
  };

  const fillFromTemplate = async () => {
    if (!selectedCity) { showInfo('Пожалуйста, выберите город'); return; }
    if (schedules.length > 0) {
      if (!window.confirm('В таблице уже есть данные. Заполнение по шаблону добавит строки в конец. Продолжить?')) return;
    }

    setTemplateLoading(true);
    try {
      const batchData = PRE_CONSTRUCTION_TEMPLATE.map(item => ({
        schedule_type: SCHEDULE_TYPE,
        city_id: parseInt(selectedCity),
        construction_stage: item.number || '',
        work_name: item.name,
        planned_start_date: null,
        planned_end_date: null,
      }));

      const batchSize = 50;
      for (let i = 0; i < batchData.length; i += batchSize) {
        await client.post('/schedules/batch', batchData.slice(i, i + batchSize));
      }

      showSuccess(`Шаблон заполнен: ${batchData.length} строк добавлено`);
      await fetchSchedules();
    } catch (error) {
      console.error('Template fill error:', error);
      showError('Ошибка при заполнении шаблона');
    } finally {
      setTemplateLoading(false);
    }
  };

  const deleteAllForCity = async () => {
    if (!selectedCity) { showInfo('Пожалуйста, выберите город'); return; }
    const cityName = cities.find(c => c.id === selectedCity)?.name || 'выбранного объекта';
    const count = schedules.filter(s => !s.id.toString().startsWith('new-')).length;
    const unsavedCount = schedules.filter(s => s.id.toString().startsWith('new-')).length;
    const total = count + unsavedCount;
    if (total === 0) { showInfo('Нет данных для удаления'); return; }

    if (!window.confirm(`Вы собираетесь удалить ВСЕ ${total} строк для объекта "${cityName}".\n\nПродолжить?`)) return;
    if (!window.confirm(`ВНИМАНИЕ! Это действие необратимо.\nБудет удалено ${total} записей.\n\nВы уверены?`)) return;
    const confirmText = window.prompt('Для подтверждения удаления введите "УДАЛИТЬ":');
    if (confirmText !== 'УДАЛИТЬ') { showInfo('Удаление отменено'); return; }

    try {
      const savedIds = schedules.filter(s => !s.id.toString().startsWith('new-')).map(s => s.id);
      for (const id of savedIds) {
        await client.delete(`/schedules/${id}`);
      }
      setSchedules([]);
      setUnsavedRows(prev => ({ ...prev, [selectedCity]: [] }));
      showSuccess(`Удалено ${total} записей для объекта "${cityName}"`);
    } catch (error) {
      showError('Ошибка при удалении');
      fetchSchedules();
    }
  };

  const copyRow = (schedule) => {
    const copy = prepareRowForCopy(schedule, SCHEDULE_TYPE);
    copy.city_id = selectedCity;
    setSchedules(prev => [...prev, copy]);
    showSuccess('Строка скопирована');
  };

  const deleteRow = async (id) => {
    if (window.confirm('Удалить эту строку?')) {
      try {
        if (id.toString().startsWith('new-')) {
          setSchedules(prev => prev.filter(s => s.id !== id));
          setUnsavedRows(prev => {
            const updated = { ...prev };
            updated[selectedCity] = updated[selectedCity]?.filter(row => row.id !== id) || [];
            return updated;
          });
        } else {
          await client.delete(`/schedules/${id}`);
          setSchedules(prev => prev.filter(s => s.id !== id));
        }
        showSuccess('Запись удалена');
      } catch (error) {
        showError('Ошибка при удалении');
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
    saveScheduleOrder(selectedCity, SCHEDULE_TYPE, newSchedules);
  };

  const renderCell = (schedule, field, value) => {
    const isDateField = field.includes('date');
    const hasDateError = dateErrors[`${schedule.id}_${field.includes('actual') ? 'fact' : 'plan'}`];

    if (field === 'construction_stage') {
      return (
        <input
          type="text"
          value={value || ''}
          placeholder="№"
          onChange={(e) => setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, [field]: e.target.value } : s))}
          onBlur={() => saveCell(schedule.id, field, value)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveCell(schedule.id, field, value); }}
          style={{ width: '100%', textAlign: 'center', fontWeight: 500 }}
          disabled={!canEdit}
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
            setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, [field]: e.target.value } : s));
          }}
          onBlur={() => saveCell(schedule.id, field, value)}
          style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4', minHeight: '28px' }}
          rows={1}
          disabled={!canEdit}
          data-auto-resize="true"
        />
      );
    }

    if (isDateField) {
      const isEndDate = field.includes('end');
      const relatedDateField = isEndDate ? field.replace('end', 'start') : null;
      const relatedDate = relatedDateField ? schedule[relatedDateField] : null;
      return (
        <div style={{ position: 'relative' }}>
          <QuickDatePicker
            value={value}
            onChange={(newValue) => setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, [field]: newValue } : s))}
            onSave={(newValue) => saveCell(schedule.id, field, newValue)}
            disabled={!canEdit}
            isEndDate={isEndDate}
            relatedDate={relatedDate}
          />
          {hasDateError && isEndDate && (
            <div style={{ position: 'absolute', bottom: '-18px', left: 0, fontSize: '11px', color: '#dc3545', whiteSpace: 'nowrap' }}>
              {hasDateError}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type="text"
        value={value || ''}
        onChange={(e) => setSchedules(prev => prev.map(s => s.id === schedule.id ? { ...s, [field]: e.target.value } : s))}
        onBlur={() => saveCell(schedule.id, field, value)}
        onKeyDown={(e) => { if (e.key === 'Enter') saveCell(schedule.id, field, value); }}
        style={{ width: '100%' }}
        disabled={!canEdit}
      />
    );
  };

  const ReadinessBar = ({ value }) => {
    if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color = value >= 100 ? '#28a745' : value >= 50 ? '#ffc107' : '#007bff';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--table-stripe)', borderRadius: '4px', overflow: 'hidden', minWidth: '40px' }}>
          <div style={{ width: `${value}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: '12px', fontWeight: 500, minWidth: '35px', textAlign: 'right' }}>{value}%</span>
      </div>
    );
  };

  const DelayBadge = ({ days }) => {
    if (days === null || days === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color = days > 0 ? '#dc3545' : days < 0 ? '#28a745' : '#6c757d';
    const prefix = days > 0 ? '+' : '';
    return (
      <span style={{
        color, fontWeight: 600, fontSize: '13px',
        padding: '2px 8px', borderRadius: '4px',
        backgroundColor: days > 0 ? '#f8d7da' : days < 0 ? '#d4edda' : 'transparent'
      }}>
        {prefix}{days} дн.
      </span>
    );
  };

  const filteredSchedules = getFilteredSchedules();
  const cellBorder = '1px solid var(--border-color)';
  const cellPad = '6px 8px';
  const totalCols = canEdit ? 13 : 12;

  return (
    <div className="container-fluid">
      <h1>График ТЗ до начала строительства</h1>
      
      <div style={{ borderBottom: '2px solid var(--border-color)', marginBottom: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingBottom: '8px' }}>
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => handleCityChange(city.id)}
              style={{
                padding: '8px 16px', border: 'none', borderRadius: '6px',
                backgroundColor: selectedCity === city.id ? '#007bff' : 'var(--table-stripe)',
                color: selectedCity === city.id ? '#fff' : 'var(--text-muted)',
                fontWeight: selectedCity === city.id ? '600' : 'normal',
                fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap',
                boxShadow: selectedCity === city.id ? '0 2px 8px rgba(0, 123, 255, 0.3)' : 'none',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <span>{city.name}</span>
              {city.current_status && <StatusBadge status={city.current_status} />}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <ScheduleToolbar
          schedules={filteredSchedules}
          columns={EXPORT_COLUMNS}
          filename="preconstruction_schedule"
          onAddRow={canEdit ? addNewRow : null}
          onRefresh={fetchSchedules}
          canEdit={canEdit}
          cities={cities}
          selectedCity={selectedCity}
          showCalendar={showCalendar}
          onToggleCalendar={handleViewModeChange}
        />
        
        {canEdit && !showCalendar && (
          <>
            <button
              onClick={fillFromTemplate}
              disabled={templateLoading}
              style={{
                padding: '8px 20px',
                backgroundColor: templateLoading ? '#6c757d' : '#17a2b8',
                color: '#fff', border: 'none', borderRadius: '6px',
                fontWeight: 600, fontSize: '13px',
                cursor: templateLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s', whiteSpace: 'nowrap',
                boxShadow: '0 2px 6px rgba(23, 162, 184, 0.3)',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              {templateLoading ? 'Загрузка...' : 'Заполнить по шаблону'}
            </button>
            {schedules.length > 0 && (
              <button
                onClick={deleteAllForCity}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#dc3545',
                  color: '#fff', border: 'none', borderRadius: '6px',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(220, 53, 69, 0.3)',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                Удалить всё
              </button>
            )}
          </>
        )}
      </div>

      {!showCalendar && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Поиск по наименованию работ..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              padding: '8px 12px', border: '1px solid var(--border-color)',
              borderRadius: '6px', width: '100%', maxWidth: '400px', fontSize: '14px'
            }}
          />
        </div>
      )}

      {showCalendar ? (
        <div className="card-full-width">
          <ModernGanttChart schedules={schedules} cities={cities} selectedView={SCHEDULE_TYPE} onScheduleUpdate={handleScheduleUpdate} />
        </div>
      ) : (
        <>
          <div className="card-full-width" style={{ padding: 0, overflow: 'visible' }}>
            <div style={{ overflowX: 'auto', overflowY: 'visible' }}>
              <table className="table po-table" style={{ marginBottom: 0, borderCollapse: 'collapse', border: cellBorder }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--table-stripe)', zIndex: 10 }}>
                  <tr>
                    <th style={{ width: '45px', border: cellBorder, padding: cellPad, textAlign: 'center' }}>№</th>
                    {canEdit && <th style={{ width: '80px', border: cellBorder, padding: cellPad }}>Действия</th>}
                    <th style={{ width: '240px', border: cellBorder, padding: cellPad, textAlign: 'center' }}>№ п/п</th>
                    <th style={{ minWidth: '350px', border: cellBorder, padding: cellPad }}>Наименование работ</th>
                    <th style={{ minWidth: '120px', border: cellBorder, padding: cellPad }}>План начало</th>
                    <th style={{ minWidth: '120px', border: cellBorder, padding: cellPad }}>План конец</th>
                    <th style={{ width: '110px', border: cellBorder, padding: cellPad }}>Готовность, %</th>
                    <th style={{ minWidth: '120px', border: cellBorder, padding: cellPad }}>Факт начало</th>
                    <th style={{ minWidth: '120px', border: cellBorder, padding: cellPad }}>Факт конец</th>
                    <th style={{ width: '110px', border: cellBorder, padding: cellPad }}>Факт готовн., %</th>
                    <th style={{ width: '130px', border: cellBorder, padding: cellPad }}>Отставание/опережение</th>
                    <th style={{ minWidth: '140px', border: cellBorder, padding: cellPad }}>Исполнитель</th>
                    <th style={{ minWidth: '140px', border: cellBorder, padding: cellPad }}>Ответственный</th>
                    <th style={{ minWidth: '160px', border: cellBorder, padding: cellPad }}>Документы</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchedules.map((schedule, index) => {
                    const isSection = isSectionRow(schedule);
                    const planReadiness = calcReadiness(schedule.planned_start_date, schedule.planned_end_date);
                    const factReadiness = calcReadiness(schedule.actual_start_date, schedule.actual_end_date);
                    const delay = calcDelay(schedule.planned_end_date, schedule.actual_end_date);
                    
                    const rowStyle = {
                      ...(schedule.isNew ? { backgroundColor: '#e8f5e9' } : {}),
                      ...(isSection ? { backgroundColor: 'var(--table-stripe)', fontWeight: 700 } : {}),
                      transition: 'background-color 0.3s'
                    };
                    
                    return (
                      <tr key={schedule.id} style={rowStyle}>
                        <td style={{ textAlign: 'center', border: cellBorder, padding: cellPad, fontSize: '12px', color: 'var(--text-muted)' }}>
                          {schedule.isNew ? '★' : index + 1}
                        </td>
                        {canEdit && (
                          <td style={{ textAlign: 'center', border: cellBorder, padding: cellPad }}>
                            <RowActions
                              onCopy={() => copyRow(schedule)}
                              onDelete={() => deleteRow(schedule.id)}
                              onMoveUp={() => moveRow(index, index - 1)}
                              onMoveDown={() => moveRow(index, index + 1)}
                              onInsertAbove={() => insertRowAt(index, 'above')}
                              onInsertBelow={() => insertRowAt(index, 'below')}
                              canMoveUp={index > 0}
                              canMoveDown={index < filteredSchedules.length - 1}
                            />
                          </td>
                        )}
                        <td style={{ border: cellBorder, padding: cellPad, textAlign: 'center', fontWeight: isSection ? 700 : 400, whiteSpace: 'nowrap' }}>
                          {renderCell(schedule, 'construction_stage', schedule.construction_stage)}
                        </td>
                        <td style={{ border: cellBorder, padding: cellPad, fontWeight: isSection ? 700 : 400 }}>
                          {renderCell(schedule, 'work_name', schedule.work_name)}
                        </td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'planned_start_date', schedule.planned_start_date)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'planned_end_date', schedule.planned_end_date)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}><ReadinessBar value={planReadiness} /></td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'actual_start_date', schedule.actual_start_date)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'actual_end_date', schedule.actual_end_date)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}><ReadinessBar value={factReadiness} /></td>
                        <td style={{ border: cellBorder, padding: cellPad, textAlign: 'center' }}><DelayBadge days={delay} /></td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'service', schedule.service)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'responsible_employee', schedule.responsible_employee)}</td>
                        <td style={{ border: cellBorder, padding: cellPad }}>{renderCell(schedule, 'vacancy', schedule.vacancy)}</td>
                      </tr>
                    );
                  })}
                  {filteredSchedules.length === 0 && (
                    <tr>
                      <td colSpan={totalCols} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
                        <div>Нет данных для отображения</div>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '16px' }}>
                            <button onClick={fillFromTemplate} className="btn btn-primary" disabled={templateLoading}>
                              {templateLoading ? 'Загрузка...' : 'Заполнить по шаблону'}
                            </button>
                            <button onClick={addNewRow} className="btn btn-secondary">
                              + Добавить строку
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  {filteredSchedules.length > 0 && canEdit && (
                    <AddRowButtonCompact onClick={addNewRow} colSpan={totalCols} />
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {!canEdit && (
            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'var(--table-stripe)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '14px' }}>
              <i>Режим просмотра. У вас нет прав для редактирования этого графика.</i>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PreConstructionSchedule;
