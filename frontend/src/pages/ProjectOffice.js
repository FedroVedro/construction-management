import React, { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { saveScheduleOrder, applyScheduleOrder } from '../utils/scheduleOrderStorage';

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
  const [editingCell, setEditingCell] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [searchText, setSearchText] = useState('');
  const [expandedComments, setExpandedComments] = useState({});
  const [workNames, setWorkNames] = useState([]);
  const [activeWorkNameTaskId, setActiveWorkNameTaskId] = useState(null);

  useEffect(() => {
    fetchCities();
    fetchWorkNames();
  }, []);

  useEffect(() => {
    if (selectedCity) {
      fetchTasks();
    }
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const res = await client.get('/cities');
      setCities(res.data);
      if (res.data.length) setSelectedCity(res.data[0].id);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await client.get('/project-office', { params: { city_id: selectedCity } });
      const ordered = applyScheduleOrder(res.data, selectedCity, 'project_office');
      setTasks(ordered);
      // Обновить список Наименований работ из текущих задач
      mergeWorkNamesFromTasks(ordered);
    } catch (e) {
      console.error(e);
    }
  };

  // Автовысота для всех textarea комментариев после загрузки/обновления задач
  useEffect(() => {
    const adjust = () => {
      const areas = document.querySelectorAll('textarea[data-auto-resize="true"]');
      areas.forEach((el) => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      });
    };
    // Дать DOM обновиться
    const id = setTimeout(adjust, 0);
    return () => clearTimeout(id);
  }, [tasks, expandedComments]);

  const fetchWorkNames = async () => {
    try {
      const res = await client.get('/schedules', { params: { schedule_type: 'procurement' } });
      const res2 = await client.get('/schedules', { params: { schedule_type: 'construction' } });
      const res3 = await client.get('/schedules', { params: { schedule_type: 'document' } });
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
      const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'ru'));
      setWorkNames(sorted);
    } catch (e) {
      console.error('Error fetching work names', e);
    }
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
      (t.task || '').toLowerCase().includes(q) ||
      (t.responsible || '').toLowerCase().includes(q) ||
      (t.participants || '').toLowerCase().includes(q) ||
      (t.comments || '').toLowerCase().includes(q)
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
    if (!selectedCity) return;
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
  };

  const saveCell = async (taskId, field, value) => {
    const isNew = taskId.toString().startsWith('new-');
    if (isNew) {
      const updated = tasks.map(t => t.id === taskId ? { ...t, [field]: value } : t);
      setTasks(updated);

      const row = updated.find(t => t.id === taskId);
      // создаем запись, когда заполнена хотя бы "Задача"
      const minimalReady = row.task && String(row.task).trim().length > 0;
      if (minimalReady) {
        // подготовить полезную нагрузку: пустые строки -> null, удалить id
        const payload = { ...row };
        delete payload.id;
        Object.keys(payload).forEach((k) => {
          if (payload[k] === '') payload[k] = null;
          // статус пустой строкой недопустим — уберем поле
          if (k === 'status' && (payload[k] === '' || payload[k] == null)) {
            delete payload[k];
          }
        });
        try {
          const res = await client.post('/project-office', payload);
          setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
        } catch (e) {
          console.error(e);
          alert(e?.response?.data?.detail || 'Ошибка сохранения');
          fetchTasks();
        }
      }
      return;
    }

    // existing row
    const processed = (typeof value === 'string') ? (value.trim() === '' ? null : value.trim()) : value;
    try {
      await client.put(`/project-office/${taskId}`, { [field]: processed });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, [field]: processed } : t));
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.detail || 'Ошибка сохранения');
      fetchTasks();
    }
  };

  // inline inputs – no click-to-edit logic required

  const onKeyDown = (e, taskId, field) => {
    if (e.key === 'Enter') {
      // Для однострочных инпутов сохраним по Enter
      // Текстовые области обрабатываются отдельным хендлером
      saveCell(taskId, field, tasks.find(t => t.id === taskId)?.[field] ?? '');
    }
    if (e.key === 'Escape') {
      setEditingCell(null);
      setTempValue('');
    }
  };

  const onTextareaKeyDown = (e) => {
    // Не очищать значение и не триггерить сохранение по Enter
    if (e.key === 'Enter') {
      // Разрешаем перевод строки. Блокируем всплытие на общий onKeyDown
      e.stopPropagation();
    }
  };

  const removeRow = async (id) => {
    if (!window.confirm('Удалить строку?')) return;
    if (id.toString().startsWith('new-')) {
      setTasks(prev => prev.filter(t => t.id !== id));
      return;
    }
    try {
      await client.delete(`/project-office/${id}`);
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const renderEditable = (task, field, type = 'text') => {
    const isDate = ['set_date', 'completion_date'].includes(field); // 'due_date' теперь текстовое поле
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
      const isActive = activeWorkNameTaskId === task.id;
      return (
        <div style={{ position: 'relative' }}>
          <textarea
            value={task.work_name || ''}
            placeholder="Наименование работ"
            onFocus={() => setActiveWorkNameTaskId(task.id)}
            onChange={(e) => {
              const el = e.target;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, work_name: e.target.value } : t));
            }}
            onBlur={() => {
              // Даем шанс выбрать пункт через onMouseDown
              setTimeout(() => setActiveWorkNameTaskId(prev => (prev === task.id ? null : prev)), 100);
              saveCell(task.id, 'work_name', task.work_name || '');
            }}
            onKeyDown={onTextareaKeyDown}
            style={{ width: '100%', resize: 'none', overflow: 'hidden', lineHeight: '1.4' }}
            rows={6}
          />
          {isActive && suggestions.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 20, background: '#fff', border: '1px solid #e5e7eb', boxShadow: '0 6px 16px rgba(0,0,0,0.08)', borderRadius: 6, marginTop: 4, maxHeight: 220, overflowY: 'auto', width: '100%' }}>
              {suggestions.map(name => (
                <div
                  key={name}
                  style={{ padding: '6px 10px', cursor: 'pointer' }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, work_name: name } : t));
                    saveCell(task.id, 'work_name', name);
                    setActiveWorkNameTaskId(null);
                  }}
                >{name}</div>
              ))}
            </div>
          )}
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
      }
    } catch (e) {
      console.error(e);
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
        <span style={{ color: '#6c757d' }}>управление задачами по объектам</span>
      </div>

      <div className="po-toolbar" style={{ display: 'flex', borderBottom: '2px solid #dee2e6', marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="Поиск: задача, ответственный, участники, комментарии"
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
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10, boxShadow: 'inset 0 -1px 0 #e9ecef' }}>
            <tr>
              <th style={{ minWidth: '140px' }}>Дата постановки</th>
              <th style={{ minWidth: '140px' }}>Постановщик</th>
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
              <tr key={t.id} className={t.is_done ? 'po-row-done' : ''} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fbfbfb' }}>
                <td>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-sm" title="Вверх" onClick={() => moveRow(tasks.indexOf(t), tasks.indexOf(t) - 1)} disabled={tasks.indexOf(t) === 0} style={{ padding: '2px 6px' }}>↑</button>
                    <button className="btn btn-sm" title="Вниз" onClick={() => moveRow(tasks.indexOf(t), tasks.indexOf(t) + 1)} disabled={tasks.indexOf(t) === tasks.length - 1} style={{ padding: '2px 6px' }}>↓</button>
                    {renderEditable(t, 'set_date')}
                  </div>
                </td>
                <td>{renderEditable(t, 'initiator')}</td>
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
                <td colSpan={14} style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                  Нет данных. Измените критерии поиска или нажмите «Добавить строку».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectOffice;



