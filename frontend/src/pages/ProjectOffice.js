import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';
import { saveSelectedCity, getSelectedCity } from '../utils/userPreferences';

const STATUS_COLORS = {
  'Отложено': '#007bff',
  'В работе': '#ffc107',
  'Не актуально': '#dc3545',
  'Выполнено': '#28a745'
};

const ProjectOffice = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [workNames, setWorkNames] = useState([]);
  const [workNamePopup, setWorkNamePopup] = useState(null);
  const [schedulesData, setSchedulesData] = useState([]);
  const [stages, setStages] = useState([]);
  const { showSuccess, showError, showInfo } = useToast();

  useEffect(() => {
    fetchCities();
    fetchWorkNames();
    fetchStages();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchSchedulesData();
    }
  }, [selectedCity]);

  useEffect(() => {
    if (selectedCity) {
      fetchTasks();
    }
  }, [selectedCity]);

  useEffect(() => {
    if (schedulesData.length > 0 && tasks.length > 0) {
      setTasks(prev => prev.map(task => {
        if (task.work_name && !task.construction_stage) {
          const constructionStage = findConstructionStage(task.work_name);
          return { ...task, construction_stage: constructionStage };
        }
        return task;
      }));
    }
  }, [schedulesData, tasks.length]);

  const fetchCities = async () => {
    try {
      const res = await client.get('/cities');
      setCities(res.data);
      if (res.data.length) {
        const savedCity = getSelectedCity();
        const cityExists = res.data.some(c => c.id === savedCity);
        setSelectedCity(cityExists ? savedCity : res.data[0].id);
      }
    } catch (e) {
      console.error(e);
      showError('Ошибка при загрузке объектов');
    }
  };

  const handleCityChange = (cityId) => {
    setSelectedCity(cityId);
    saveSelectedCity(cityId);
  };

  const fetchTasks = async () => {
    try {
      const res = await client.get('/project-office', { params: { city_id: selectedCity } });
      const ordered = applyScheduleOrder(res.data, selectedCity, 'project_office');
      setTasks(ordered);
      mergeWorkNamesFromTasks(ordered);
      await fetchSchedulesData();
    } catch (e) {
      console.error(e);
      showError('Ошибка при загрузке задач');
    }
  };

  useEffect(() => {
    const adjust = () => {
      const areas = document.querySelectorAll('textarea[data-auto-resize="true"]');
      areas.forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    };
    const id = setTimeout(adjust, 0);
    return () => clearTimeout(id);
  }, [tasks, expandedComments]);

  const fetchSchedulesData = async () => {
    try {
      const res = await client.get('/schedules', { params: { schedule_type: 'procurement', city_id: selectedCity } });
      const res2 = await client.get('/schedules', { params: { schedule_type: 'construction', city_id: selectedCity } });
      const res3 = await client.get('/schedules', { params: { schedule_type: 'document', city_id: selectedCity } });
      const res4 = await client.get('/schedules', { params: { schedule_type: 'hr', city_id: selectedCity } });
      
      const allSchedules = [
        ...(res.data || []),
        ...(res2.data || []),
        ...(res3.data || []),
        ...(res4.data || [])
      ];
      setSchedulesData(allSchedules);
    } catch (e) {
      console.error('Error fetching schedules data', e);
    }
  };

  const fetchWorkNames = async () => {
    try {
      const res = await client.get('/schedules', { params: { schedule_type: 'procurement' } });
      const res2 = await client.get('/schedules', { params: { schedule_type: 'construction' } });
      const res3 = await client.get('/schedules', { params: { schedule_type: 'document' } });
      const res4 = await client.get('/schedules', { params: { schedule_type: 'hr' } });
      const names = new Set();
      const addName = (val) => {
        if (typeof val !== 'string') return;
        const v = val.trim();
        if (!v) return;
        names.add(v);
      };
      (res.data || []).forEach(s => { addName(s.work_name); addName(s.sections); });
      (res2.data || []).forEach(s => { addName(s.work_name); addName(s.sections); });
      (res3.data || []).forEach(s => { addName(s.work_name); addName(s.sections); });
      (res4.data || []).forEach(s => { addName(s.work_name); addName(s.vacancy); });
      const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
      setWorkNames(sorted);
    } catch (e) {
      console.error('Error fetching work names', e);
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

  const findConstructionStage = (workName) => {
    if (!workName || !workName.trim() || !schedulesData.length) return null;
    
    const trimmedWorkName = workName.trim().toLowerCase();
    
    // Сначала ищем точное совпадение
    for (const schedule of schedulesData) {
      const scheduleWorkName = (schedule.work_name || '').trim().toLowerCase();
      const scheduleSections = (schedule.sections || '').trim().toLowerCase();
      
      if (scheduleWorkName === trimmedWorkName || scheduleSections === trimmedWorkName) {
        return schedule.construction_stage || null;
      }
    }
    
    // Если точного совпадения нет, ищем по вхождению (work_name содержит искомую строку)
    for (const schedule of schedulesData) {
      const scheduleWorkName = (schedule.work_name || '').trim().toLowerCase();
      const scheduleSections = (schedule.sections || '').trim().toLowerCase();
      
      if ((scheduleWorkName && scheduleWorkName.includes(trimmedWorkName)) ||
          (scheduleSections && scheduleSections.includes(trimmedWorkName)) ||
          (scheduleWorkName && trimmedWorkName.includes(scheduleWorkName)) ||
          (scheduleSections && trimmedWorkName.includes(scheduleSections))) {
        return schedule.construction_stage || null;
      }
    }
    
    return null;
  };

  const getStageNumber = (constructionStage) => {
    if (!constructionStage || !stages.length) return '';
    
    const stageIndex = stages.findIndex(stage => 
      stage.name === constructionStage
    );
    
    return stageIndex >= 0 ? `${stageIndex + 1}.` : '';
  };

  const mergeWorkNamesFromTasks = (list) => {
    if (!Array.isArray(list)) return;
    const names = new Set(workNames);
    list.forEach(t => {
      if (t && typeof t.work_name === 'string' && t.work_name.trim()) {
        names.add(t.work_name.trim());
      }
    });
    setWorkNames(Array.from(names).sort((a, b) => a.localeCompare(b, 'ru')));
  };

  const filteredTasks = useMemo(() => {
    const q = (searchText || '').toLowerCase().trim();
    if (!q) return tasks;
    return tasks.filter(t => (
      (t.work_name || '').toLowerCase().includes(q) ||
      (t.task || '').toLowerCase().includes(q) ||
      (t.responsible || '').toLowerCase().includes(q) ||
      (t.participants || '').toLowerCase().includes(q) ||
      (t.comments || '').toLowerCase().includes(q) ||
      (t.initiator || '').toLowerCase().includes(q) ||
      (t.delay_reason || '').toLowerCase().includes(q) ||
      (t.result || '').toLowerCase().includes(q) ||
      (t.construction_stage || '').toLowerCase().includes(q)
    ));
  }, [tasks, searchText]);

  const getStatusCellStyle = (status) => {
    if (!status) return {};
    const color = STATUS_COLORS[status];
    if (!color) return {};
    return {
      backgroundColor: `${color}22`,
      borderLeft: `3px solid ${color}`
    };
  };

  const addRow = () => {
    if (!selectedCity) {
      showInfo('Пожалуйста, выберите объект');
      return;
    }
    setTasks(prev => ([...prev, {
      id: `new-${Date.now()}`,
      city_id: selectedCity,
      set_date: '',
      initiator: '',
      task: '',
      responsible: '',
      participants: '',
      due_date: '',
      status: '',
      completion_date: '',
      delay_reason: '',
      comments: '',
      is_done: false,
      result: '',
      text_color: ''
    }]));
    showInfo('Добавлена новая строка');
  };

  const saveCell = async (taskId, field, value, additionalData = {}) => {
    const isNew = taskId.toString().startsWith('new-');
    if (isNew) {
      const updated = tasks.map(t => t.id === taskId ? { ...t, [field]: value, ...additionalData } : t);
      setTasks(updated);

      const row = updated.find(t => t.id === taskId);
      const minimalReady = row.task && String(row.task).trim().length > 0;
      if (minimalReady) {
        const payload = { ...row };
        delete payload.id;
        delete payload.isNew;
        
        // Убедимся что city_id это число
        payload.city_id = parseInt(payload.city_id);
        
        Object.keys(payload).forEach((k) => {
          // Пустые строки преобразуем в null
          if (payload[k] === '') payload[k] = null;
          // Удаляем пустой статус полностью (чтобы не было ошибки валидации)
          if (k === 'status' && (payload[k] === '' || payload[k] == null)) {
            delete payload[k];
          }
        });
        
        try {
          const res = await client.post('/project-office', payload);
          setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
          showSuccess('Задача создана');
        } catch (e) {
          console.error('Error creating task:', e);
          const errorMsg = e?.response?.data?.detail;
          if (typeof errorMsg === 'string') {
            showError(errorMsg);
          } else if (Array.isArray(errorMsg)) {
            showError(errorMsg.map(err => err.msg || err).join(', '));
          } else {
            showError('Ошибка сохранения');
          }
          fetchTasks();
        }
      }
      return;
    }

    let processed = value;
    if (typeof value === 'string') {
      processed = value.trim() === '' ? null : value.trim();
    }
    
    // Формируем данные для обновления
    const updatePayload = { ...additionalData };
    
    // Для статуса: если пустая строка или null - не отправляем вообще (оставляем как есть на сервере)
    // или отправляем null для очистки
    if (field === 'status') {
      if (processed === null || processed === '') {
        updatePayload[field] = null;
      } else {
        updatePayload[field] = processed;
      }
    } else {
      updatePayload[field] = processed;
    }
    
    // Обрабатываем additionalData для construction_stage
    if (additionalData.construction_stage !== undefined) {
      updatePayload.construction_stage = additionalData.construction_stage;
    }
    
    try {
      await client.put(`/project-office/${taskId}`, updatePayload);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: processed, ...additionalData } : t));
    } catch (e) {
      console.error('Error updating task:', e);
      const errorMsg = e?.response?.data?.detail;
      if (typeof errorMsg === 'string') {
        showError(errorMsg);
      } else if (Array.isArray(errorMsg)) {
        showError(errorMsg.map(err => err.msg || err).join(', '));
      } else {
        showError('Ошибка сохранения');
      }
      fetchTasks();
    }
  };

  const onKeyDown = (e, taskId, field) => {
    if (e.key === 'Enter') {
      saveCell(taskId, field, tasks.find(t => t.id === taskId)?.[field] ?? '');
    }
  };

  const onTextareaKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
    }
  };

  const removeRow = async (id) => {
    if (!window.confirm('Удалить строку?')) return;
    if (id.toString().startsWith('new-')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      showSuccess('Строка удалена');
      return;
    }
    try {
      await client.delete(`/project-office/${id}`);
      showSuccess('Задача удалена');
      fetchTasks();
    } catch (e) {
      console.error(e);
      showError('Ошибка при удалении');
    }
  };

  const renderEditable = (task, field, type = 'text') => {
    const isDate = ['set_date', 'completion_date'].includes(field);
    const valueForInput = (() => {
      const val = task[field];
      if (isDate && val) return new Date(val).toISOString().split('T')[0];
      return val ?? '';
    })();

    if (field === 'status') {
      return (
        <select
          value={task.status || ''}
          onChange={(e) => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: e.target.value } : t))}
          onBlur={() => saveCell(task.id, 'status', task.status || '')}
          style={{ width: '100%', color: task.status ? STATUS_COLORS[task.status] : undefined, fontWeight: 600, background: 'transparent' }}
        >
          <option value="">—</option>
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      );
    }

    if (field === 'is_done') {
      return (
        <input type="checkbox" checked={!!task.is_done} onChange={() => toggleDone(task)} />
      );
    }

    if (field === 'work_name') {
      const query = (task.work_name || '').toLowerCase();
      const suggestions = (query.length >= 2
        ? workNames.filter(name => name.toLowerCase().includes(query))
        : workNames
      );
      const openPopupFromTarget = (el) => {
        if (!el || !el.getBoundingClientRect) return;
        const rect = el.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const up = spaceBelow < 240;
        setWorkNamePopup({ taskId: task.id, suggestions, rect, up });
      };

      return (
        <div style={{ position: 'relative' }}>
          <textarea
            value={task.work_name || ''}
            placeholder="Наименование работ"
            onFocus={(e) => { openPopupFromTarget(e.target); }}
            onChange={(e) => {
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
              const newWorkName = e.target.value;
              
              const constructionStage = findConstructionStage(newWorkName);
              
              setTasks(prev => prev.map(t => t.id === task.id ? { 
                ...t, 
                work_name: newWorkName,
                construction_stage: constructionStage
              } : t));
              
              const q = (newWorkName || '').toLowerCase();
              const sugg = (q.length >= 2 ? workNames.filter(name => name.toLowerCase().includes(q)) : workNames);
              const rect = el.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom;
              const up = spaceBelow < 240;
              setWorkNamePopup({ taskId: task.id, suggestions: sugg, rect, up });
            }}
            onBlur={() => {
              const currentTask = tasks.find(t => t.id === task.id);
              const constructionStage = findConstructionStage(currentTask?.work_name || '');
              saveCell(task.id, 'work_name', currentTask?.work_name || '', 
                constructionStage ? { construction_stage: constructionStage } : {}
              );
              setTimeout(() => setWorkNamePopup(prev => (prev && prev.taskId === task.id ? null : prev)), 120);
            }}
            onKeyDown={onTextareaKeyDown}
            style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
            rows={6}
          />
        </div>
      );
    }

    if (field === 'comments') {
      const isExpanded = !!expandedComments[task.id];
      const textValue = task.comments || '';
      const needsToggle = textValue.length > 120 || (textValue.match(/\n/g)?.length || 0) >= 6;
      return (
        <div>
          <textarea
            value={textValue}
            placeholder="Комментарии"
            onChange={(e) => {
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, comments: e.target.value } : t));
            }}
            onBlur={() => saveCell(task.id, 'comments', task.comments || '')}
            onKeyDown={onTextareaKeyDown}
            data-auto-resize={isExpanded ? 'true' : 'false'}
            style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4', maxHeight: isExpanded ? 'none' : '120px' }}
            rows={isExpanded ? 1 : 6}
          />
          {needsToggle && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setExpandedComments(prev => ({ ...prev, [task.id]: !isExpanded }))}
              style={{ marginTop: 4, padding: '2px 6px' }}
            >
              {isExpanded ? 'Свернуть' : 'Показать полностью'}
            </button>
          )}
        </div>
      );
    }

    if (field === 'delay_reason' || field === 'task') {
      const currentValue = field === 'delay_reason' ? (task.delay_reason || '') : (task.task || '');
      return (
        <textarea
          value={currentValue}
          placeholder={field === 'task' ? 'Задача' : 'Причина переноса срока'}
          onChange={(e) => {
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, [field]: e.target.value } : t));
          }}
          onBlur={() => saveCell(task.id, field, task[field] || '')}
          onKeyDown={onTextareaKeyDown}
          data-auto-resize="true"
          style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
          rows={6}
        />
      );
    }

    if (field === 'due_date') {
      return (
        <textarea
          value={task.due_date || ''}
          placeholder="Срок"
          onChange={(e) => {
            const el = e.target;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, due_date: e.target.value } : t));
          }}
          onBlur={() => saveCell(task.id, 'due_date', task.due_date || '')}
          onKeyDown={onTextareaKeyDown}
          data-auto-resize="true"
          style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
          rows={6}
        />
      );
    }

    return (
      <input
        type={isDate ? 'date' : type}
        value={valueForInput}
        placeholder={
          field === 'initiator' ? 'Постановщик' :
          field === 'responsible' ? 'Ответственный' :
          field === 'participants' ? 'Участники' :
          field === 'result' ? 'Результат работы' : ''
        }
        onChange={(e) => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, [field]: e.target.value } : t))}
        onBlur={() => saveCell(task.id, field, task[field] ?? '')}
        onKeyDown={(e) => onKeyDown(e, task.id, field)}
        style={{ width: '100%' }}
      />
    );
  };

  const toggleDone = async (task) => {
    const newVal = !task.is_done;
    try {
      if (task.id.toString().startsWith('new-')) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newVal } : t));
      } else {
        await client.put(`/project-office/${task.id}`, { is_done: newVal });
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newVal } : t));
        showSuccess(newVal ? 'Задача отмечена как выполненная' : 'Отметка снята');
      }
    } catch (e) {
      console.error(e);
      showError('Ошибка при обновлении');
    }
  };

  const moveRow = (fromIndex, toIndex) => {
    const list = [...tasks];
    if (toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    setTasks(list);
    saveScheduleOrder(selectedCity, 'project_office', list);
  };

  return (
    <div className="container-fluid">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 style={{ marginBottom: 0 }}>Проектный офис</h1>
        <span style={{ color: 'var(--text-muted)' }}>управление задачами по объектам</span>
      </div>

      <div className="po-toolbar" style={{ display: 'flex', borderBottom: '2px solid var(--border-color)', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cities.map(city => (
            <button
              key={city.id}
              onClick={() => handleCityChange(city.id)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderBottom: selectedCity === city.id ? '2px solid #007bff' : 'none',
                backgroundColor: selectedCity === city.id ? 'var(--table-stripe)' : 'transparent',
                color: selectedCity === city.id ? '#007bff' : 'var(--text-muted)',
                fontWeight: selectedCity === city.id ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            >
              {city.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="🔍 Поиск: задача, ответственный, участники, комментарии, этап"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="form-control"
            style={{ minWidth: 320 }}
          />
          <button onClick={addRow} className="btn btn-primary">+ Добавить строку</button>
        </div>
      </div>

      <div className="card-full-width po-card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="table po-table" style={{ marginBottom: 0 }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--table-stripe)', zIndex: 10, boxShadow: 'inset 0 -1px 0 var(--border-color)' }}>
            <tr>
              <th style={{ minWidth: '140px' }}>Дата постановки</th>
              <th style={{ minWidth: '140px' }}>Постановщик</th>
              <th style={{ minWidth: '200px' }}>Этап строительства</th>
              <th style={{ minWidth: '260px' }}>Наименование работ</th>
              <th style={{ minWidth: '260px' }}>Задача</th>
              <th style={{ minWidth: '160px' }}>Ответственный</th>
              <th style={{ minWidth: '200px' }}>Участники</th>
              <th style={{ minWidth: '140px' }}>Срок</th>
              <th style={{ minWidth: '140px' }}>Статус</th>
              <th style={{ minWidth: '140px' }}>Дата выполнения</th>
              <th style={{ minWidth: '180px' }}>Причина переноса срока</th>
              <th style={{ minWidth: '360px' }}>Комментарии</th>
              <th style={{ minWidth: '220px' }}>Результат работы</th>
              <th style={{ width: '80px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((t, idx) => (
              <tr key={t.id} className={t.is_done ? 'po-row-done' : ''} style={{ background: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--table-stripe)' }}>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-sm" title="Вверх" onClick={() => moveRow(tasks.indexOf(t), tasks.indexOf(t) - 1)} disabled={tasks.indexOf(t) === 0} style={{ padding: '2px 6px' }}>↑</button>
                    <button className="btn btn-sm" title="Вниз" onClick={() => moveRow(tasks.indexOf(t), tasks.indexOf(t) + 1)} disabled={tasks.indexOf(t) === tasks.length - 1} style={{ padding: '2px 6px' }}>↓</button>
                    {renderEditable(t, 'set_date')}
                  </div>
                </td>
                <td>{renderEditable(t, 'initiator')}</td>
                <td>
                  <StageCell 
                    task={t}
                    stages={stages}
                    getStageNumber={getStageNumber}
                    onSave={(value) => saveCell(t.id, 'construction_stage', value)}
                    onChange={(value) => setTasks(prev => prev.map(task => 
                      task.id === t.id ? { ...task, construction_stage: value } : task
                    ))}
                  />
                </td>
                <td>{renderEditable(t, 'work_name')}</td>
                <td>{renderEditable(t, 'task')}</td>
                <td>{renderEditable(t, 'responsible')}</td>
                <td>{renderEditable(t, 'participants')}</td>
                <td>{renderEditable(t, 'due_date')}</td>
                <td style={getStatusCellStyle(t.status)}>{renderEditable(t, 'status')}</td>
                <td>{renderEditable(t, 'completion_date')}</td>
                <td>{renderEditable(t, 'delay_reason')}</td>
                <td>{renderEditable(t, 'comments')}</td>
                <td>{renderEditable(t, 'result')}</td>
                <td>
                  <button className="btn btn-outline-danger btn-sm" title="Удалить строку" onClick={() => removeRow(t.id)}>✕</button>
                </td>
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={14} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                  Нет данных. Измените критерии поиска или нажмите «Добавить строку».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {workNamePopup && workNamePopup.suggestions && workNamePopup.suggestions.length > 0 && (
        <div
          style={{
            position: 'fixed',
            left: workNamePopup.rect.left,
            width: workNamePopup.rect.width,
            top: workNamePopup.up ? undefined : (workNamePopup.rect.bottom + 4),
            bottom: workNamePopup.up ? (window.innerHeight - workNamePopup.rect.top + 4) : undefined,
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 6px 16px rgba(0,0,0,0.08)',
            borderRadius: 6,
            maxHeight: 220,
            overflowY: 'auto'
          }}
        >
          {workNamePopup.suggestions.map(name => (
            <div
              key={name}
              style={{ padding: '6px 10px', cursor: 'pointer', color: 'var(--text-primary)' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const id = workNamePopup.taskId;
                const constructionStage = findConstructionStage(name);
                setTasks(prev => prev.map(t => t.id === id ? { 
                  ...t, 
                  work_name: name,
                  construction_stage: constructionStage
                } : t));
                // Сохраняем и work_name и construction_stage
                saveCell(id, 'work_name', name, 
                  constructionStage ? { construction_stage: constructionStage } : {}
                );
                setWorkNamePopup(null);
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--table-hover)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >{name}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// Компонент для редактирования этапа строительства
const StageCell = ({ task, stages, getStageNumber, onSave, onChange }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputValue, setInputValue] = useState(task.construction_stage || '');
  const containerRef = React.useRef(null);

  React.useEffect(() => {
    setInputValue(task.construction_stage || '');
  }, [task.construction_stage]);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const filteredStages = stages.filter(s => 
    s.name.toLowerCase().includes((inputValue || '').toLowerCase())
  );

  const handleSelect = (stageName) => {
    setInputValue(stageName);
    onChange(stageName);
    onSave(stageName);
    setShowDropdown(false);
  };

  const displayValue = task.construction_stage 
    ? `${getStageNumber(task.construction_stage)} ${task.construction_stage}` 
    : '';

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input 
        type="text" 
        value={showDropdown ? inputValue : displayValue}
        onFocus={() => {
          setInputValue(task.construction_stage || '');
          setShowDropdown(true);
        }}
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowDropdown(true);
        }}
        onBlur={() => {
          // Даём время на клик по выпадающему списку
          setTimeout(() => {
            if (inputValue !== task.construction_stage) {
              onChange(inputValue);
              onSave(inputValue);
            }
          }, 150);
        }}
        style={{ 
          width: '100%', 
          background: task.construction_stage ? '#e8f5e8' : 'var(--table-stripe)',
          border: task.construction_stage ? '1px solid #28a745' : '1px solid var(--border-color)',
          color: task.construction_stage ? '#155724' : 'var(--text-primary)'
        }} 
        placeholder="Этап строительства"
      />
      {showDropdown && filteredStages.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: 200,
          overflowY: 'auto'
        }}>
          {filteredStages.map((stage, idx) => (
            <div
              key={stage.id}
              style={{ 
                padding: '8px 12px', 
                cursor: 'pointer',
                borderBottom: idx < filteredStages.length - 1 ? '1px solid var(--border-color)' : 'none'
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(stage.name);
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--table-hover)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontWeight: 600, marginRight: 8 }}>{idx + 1}.</span>
              {stage.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectOffice;
