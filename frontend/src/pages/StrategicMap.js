import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

// Константы для типов вех и их цветов
const MILESTONE_TYPES = {
  'РНС': { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', label: 'РНС' },
  'Продажа': { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', label: 'Продажа' },
  'Строительство': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', label: 'Строит.' },
  'Проектирование': { color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', label: 'Проект.' },
  'Согласование': { color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)', label: 'Соглас.' },
  'Завершение': { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.2)', label: 'Заверш.' },
  'Подготовка': { color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.15)', label: 'Подгот.' },
};

const StrategicMap = () => {
  const { showSuccess, showError } = useToast();
  const { isDark } = useTheme();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editAreaValue, setEditAreaValue] = useState('');
  const [selectedMilestoneType, setSelectedMilestoneType] = useState('');
  const [searchText, setSearchText] = useState('');
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' | 'table'
  const [yearFilter, setYearFilter] = useState('all');
  const [quickFillType, setQuickFillType] = useState(null); // 'РНС', 'Продажа' etc.
  const [updatingCells, setUpdatingCells] = useState(new Set()); // Набор `${projectId}-${dateStr}`
  const [hoveredRow, setHoveredRow] = useState(null);
  
  const tableRef = useRef(null);

  // Генерация месяцев для временной шкалы (с 2022 по 2028)
  const months = useMemo(() => {
    const result = [];
    for (let year = 2022; year <= 2028; year++) {
      for (let month = 0; month < 12; month++) {
        result.push(new Date(year, month, 1));
      }
    }
    return result;
  }, []);

  // Фильтруем месяцы по году
  const filteredMonths = useMemo(() => {
    if (yearFilter === 'all') return months;
    const year = parseInt(yearFilter);
    return months.filter(m => m.getFullYear() === year);
  }, [months, yearFilter]);

  // Группировка месяцев по кварталам
  const quarters = useMemo(() => {
    const grouped = {};
    filteredMonths.forEach(date => {
      const year = date.getFullYear();
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      const key = `${quarter} кв. ${year}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(date);
    });
    return grouped;
  }, [filteredMonths]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Сначала пытаемся синхронизировать проекты из объектов строительства
      // Если синхронизация не удалась, просто продолжаем загрузку данных
      try {
        await client.post('/strategic-map/sync-from-cities');
      } catch (syncError) {
        console.warn('Синхронизация проектов не удалась, продолжаем загрузку:', syncError);
        // Не показываем ошибку пользователю, просто продолжаем
      }
      
      // Затем загружаем проекты
      const projectsRes = await client.get('/strategic-map/projects');
      setProjects(projectsRes.data);
    } catch (e) {
      console.error(e);
      showError('Ошибка при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  // Вспомогательная функция для форматирования даты без сдвига часового пояса
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Получить веху для проекта на конкретный месяц
  const getMilestone = useCallback((project, date) => {
    if (!project.milestones) return null;
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return project.milestones.find(m => {
      const mDate = new Date(m.month_date);
      const mYearMonth = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
      return mYearMonth === yearMonth;
    });
  }, []);

  // Форматирование месяца
  const formatMonth = (date) => {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return months[date.getMonth()];
  };

  // Обработка клика по ячейке для редактирования
  const handleCellClick = async (projectId, date) => {
    const dateStr = formatDateLocal(date);
    const cellKey = `${projectId}-${dateStr}`;
    
    if (updatingCells.has(cellKey)) return;

    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const milestone = getMilestone(project, date);

    if (quickFillType) {
      // Режим быстрого заполнения
      setUpdatingCells(prev => new Set(prev).add(cellKey));
      try {
        const newValue = milestone?.milestone_type === quickFillType ? null : (milestone?.value || '');
        const newType = milestone?.milestone_type === quickFillType ? null : quickFillType;
        const newAreaValue = milestone?.area_value || null;
        
        await client.put(
          `/strategic-map/projects/${projectId}/milestone?month_date=${dateStr}`,
          {
            value: newValue,
            milestone_type: newType,
            area_value: newAreaValue,
            is_key_milestone: ['РНС', 'Завершение'].includes(newType)
          }
        );
        
        // Оптимистичное обновление локального состояния
        setProjects(prev => prev.map(p => {
          if (p.id === projectId) {
            const otherMilestones = (p.milestones || []).filter(m => {
              const mDate = new Date(m.month_date);
              return formatDateLocal(mDate) !== dateStr;
            });
            
            if (newType) {
              return {
                ...p,
                milestones: [...otherMilestones, {
                  month_date: dateStr,
                  milestone_type: newType,
                  value: newValue,
                  area_value: newAreaValue,
                  is_key_milestone: ['РНС', 'Завершение'].includes(newType)
                }]
              };
            }
            return { ...p, milestones: otherMilestones };
          }
          return p;
        }));
      } catch (e) {
        console.error(e);
        showError('Ошибка при обновлении');
        fetchData(); 
      } finally {
        setUpdatingCells(prev => {
          const next = new Set(prev);
          next.delete(cellKey);
          return next;
        });
      }
      return;
    }

    setEditingCell({ projectId, date: dateStr, displayDate: date });
    setEditValue(milestone?.value || '');
    setSelectedMilestoneType(milestone?.milestone_type || '');
    setEditAreaValue(milestone?.area_value || '');
  };

  // Закрытие модального окна редактирования
  const closeEditModal = () => {
    setEditingCell(null);
    setEditValue('');
    setEditAreaValue('');
    setSelectedMilestoneType('');
  };

  // Сохранение редактирования ячейки
  const saveCellEdit = async () => {
    if (!editingCell) return;
    
    try {
      await client.put(
        `/strategic-map/projects/${editingCell.projectId}/milestone?month_date=${editingCell.date}`,
        {
          value: editValue || null,
          milestone_type: selectedMilestoneType || null,
          area_value: editAreaValue ? parseFloat(editAreaValue) : null,
          is_key_milestone: ['РНС', 'Завершение'].includes(selectedMilestoneType)
        }
      );
      await fetchData();
      showSuccess('Сохранено');
    } catch (e) {
      console.error(e);
      showError('Ошибка сохранения');
    }
    closeEditModal();
  };


  // Удаление проекта
  const deleteProject = async (projectId) => {
    const project = projects.find(p => p.id === projectId);
    const message = project?.city_id 
      ? 'Внимание! Проект привязан к объекту строительства и будет автоматически восстановлен при следующей синхронизации. Удалить проект?'
      : 'Удалить проект?';
    
    if (!window.confirm(message)) return;
    try {
      await client.delete(`/strategic-map/projects/${projectId}`);
      await fetchData();
      showSuccess('Проект удалён');
    } catch (e) {
      console.error(e);
      showError('Ошибка удаления');
    }
  };

  // Фильтрация проектов
  const filteredProjects = useMemo(() => {
    if (!searchText.trim()) return projects;
    const q = searchText.toLowerCase();
    
    // Сначала находим все подходящие проекты (не метрики)
    const matchingProjectIds = new Set(
      projects
        .filter(p => !p.parent_id && p.name.toLowerCase().includes(q))
        .map(p => p.id)
    );

    return projects.filter(p => {
      // Показываем если:
      // 1. Само имя совпадает
      // 2. Это метрика и её родитель совпадает
      // 3. Группа совпадает
      return (
        p.name.toLowerCase().includes(q) ||
        (p.parent_id && matchingProjectIds.has(p.parent_id)) ||
        (p.parent_group && p.parent_group.toLowerCase().includes(q))
      );
    });
  }, [projects, searchText]);

  // Получить уникальные годы для фильтра
  const availableYears = useMemo(() => {
    const years = new Set();
    for (let y = 2022; y <= 2028; y++) years.add(y);
    return Array.from(years);
  }, []);

  // Стили
  const containerStyle = {
    padding: '0 40px',
    paddingBottom: 40,
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    flexWrap: 'wrap',
    gap: 16
  };

  const titleStyle = {
    fontSize: 28,
    fontWeight: 700,
    background: isDark 
      ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
      : 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    margin: 0
  };

  const toolbarStyle = {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 20,
    padding: '16px 20px',
    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 0.9)',
    borderRadius: 12,
    border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.5)' : 'rgba(203, 213, 225, 0.8)'}`,
    backdropFilter: 'blur(8px)'
  };

  const tableContainerStyle = {
    overflow: 'auto',
    background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)'}`,
    boxShadow: isDark 
      ? '0 4px 24px rgba(0, 0, 0, 0.3)' 
      : '0 4px 24px rgba(0, 0, 0, 0.08)',
  };

  const cellStyle = (isHeader = false, isFixed = false, fixedLeft = 0, isFixedVertical = false) => {
    let topValue = 'auto';
    if (isFixedVertical && isHeader) {
      if (isFixedVertical === 'top2') topValue = 38;
      else if (isFixedVertical === 'top3') topValue = 76;
      else topValue = 0;
    }
    
    return {
      padding: isHeader ? '10px 8px' : '6px 4px',
      fontSize: isHeader ? 11 : 12,
      fontWeight: isHeader ? 600 : 400,
      textAlign: 'center',
      whiteSpace: 'nowrap',
      borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
      borderBottom: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
      background: isFixed || isFixedVertical
        ? (isDark ? '#1e293b' : '#f8fafc')
        : (isDark ? 'rgba(15, 23, 42, 0.1)' : 'transparent'),
      position: (isFixed || isFixedVertical) ? 'sticky' : 'static',
      left: isFixed ? fixedLeft : 'auto',
      top: topValue,
      zIndex: isFixed && isFixedVertical ? 30 : (isFixed ? 20 : (isFixedVertical ? 10 : 1)),
      minWidth: isFixed ? (fixedLeft === 0 ? 50 : (fixedLeft === 50 ? 200 : 100)) : 50,
      maxWidth: isFixed ? (fixedLeft === 0 ? 60 : (fixedLeft === 50 ? 250 : 200)) : 60,
    };
  };

  const getMilestoneCellStyle = (milestone) => {
    if (!milestone || !milestone.value) return {};
    
    const type = MILESTONE_TYPES[milestone.milestone_type] || { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.1)' };
    
    return {
      background: type.bgColor,
      color: type.color,
      fontWeight: 600,
      borderRadius: 4,
      cursor: 'pointer',
      transition: 'all 0.15s ease'
    };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="loading-spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Мастер-карта стратегического развития</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            Планирование и контроль этапов строительных проектов
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={toolbarStyle}>
        <input
          type="text"
          placeholder="🔍 Поиск проекта..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="form-control"
          style={{ minWidth: 240, maxWidth: 300 }}
        />
        
        <select 
          value={yearFilter} 
          onChange={(e) => setYearFilter(e.target.value)}
          className="form-control"
          style={{ minWidth: 120 }}
        >
          <option value="all">Все годы</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: 4, background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)', borderRadius: 8, padding: 4 }}>
          <button
            onClick={() => setViewMode('timeline')}
            className={`btn btn-sm ${viewMode === 'timeline' ? 'btn-primary' : ''}`}
            style={{ 
              background: viewMode === 'timeline' ? undefined : 'transparent',
              border: 'none',
              padding: '6px 12px'
            }}
          >
            📅 Таймлайн
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : ''}`}
            style={{ 
              background: viewMode === 'table' ? undefined : 'transparent',
              border: 'none',
              padding: '6px 12px'
            }}
          >
            📊 Таблица
          </button>
        </div>

        <div style={{ height: 24, width: 1, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', margin: '0 4px' }} />

        {/* Быстрое заполнение */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Быстрый ввод:</span>
          <div style={{ display: 'flex', gap: 4, padding: 2, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)', borderRadius: 6 }}>
            {Object.keys(MILESTONE_TYPES).map(type => (
              <button
                key={type}
                onClick={() => setQuickFillType(quickFillType === type ? null : type)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: MILESTONE_TYPES[type].color,
                  border: quickFillType === type 
                    ? `3px solid ${isDark ? '#fff' : '#000'}` 
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
                  cursor: 'pointer',
                  opacity: quickFillType === type ? 1 : 0.5,
                  transition: 'all 0.2s',
                  position: 'relative',
                  boxShadow: quickFillType === type 
                    ? `0 0 10px ${MILESTONE_TYPES[type].color}` 
                    : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={`Режим быстрой расстановки: ${type}`}
              >
                {quickFillType === type && (
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 'bold', textShadow: '0 0 2px #000' }}>✓</span>
                )}
              </button>
            ))}
            {quickFillType && (
              <button 
                onClick={() => setQuickFillType(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, padding: '0 4px' }}
                title="Отключить быстрый ввод"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }} />
      </div>

      {/* Легенда типов вех */}
      <div style={{ 
        display: 'flex', 
        gap: 16, 
        marginBottom: 16, 
        padding: '12px 16px',
        background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(248, 250, 252, 0.8)',
        borderRadius: 8,
        flexWrap: 'wrap'
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 12 }}>Легенда:</span>
        {Object.entries(MILESTONE_TYPES).map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ 
              width: 12, 
              height: 12, 
              borderRadius: 3, 
              background: val.bgColor, 
              border: `2px solid ${val.color}` 
            }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{key}</span>
          </div>
        ))}
      </div>

      {/* Main Table */}
      <div style={{ ...tableContainerStyle, maxHeight: 'calc(100vh - 350px)' }} ref={tableRef}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
          <thead>
            {/* Кварталы */}
            <tr>
              <th style={{ 
                ...cellStyle(true, true, 0, 'top'), 
                minWidth: 50,
              }}>
                №
              </th>
              <th style={{ 
                ...cellStyle(true, true, 50, 'top'), 
                minWidth: 200,
              }}>
                Проект
              </th>
              <th style={{ ...cellStyle(true, true, 250, 'top'), minWidth: 120 }}>Текущий статус</th>
              <th style={{ ...cellStyle(true, true, 370, 'top'), minWidth: 100 }}>Кол-во секций</th>
              <th style={{ ...cellStyle(true, true, 470, 'top'), minWidth: 150 }}>Продаваемая площадь (М2)</th>
              <th style={{ ...cellStyle(true, true, 620, 'top'), minWidth: 120 }}>Срок реализации (мес)</th>
              {Object.entries(quarters).map(([quarter, monthsInQuarter]) => (
                <th 
                  key={quarter} 
                  colSpan={monthsInQuarter.length}
                  style={{ 
                    ...cellStyle(true, false, 0, 'top'),
                    background: isDark ? 'rgba(51, 65, 85, 0.95)' : 'rgba(226, 232, 240, 0.98)',
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {quarter}
                </th>
              ))}
              <th style={{ ...cellStyle(true, false, 0, 'top'), minWidth: 40 }}>⚡</th>
            </tr>
            
            {/* Месяцы - первая строка (статусы) */}
            <tr>
              <th style={{ 
                ...cellStyle(true, true, 0, 'top2'),
                fontSize: 9,
                color: 'var(--text-muted)'
              }}>
                №
              </th>
              <th style={{ 
                ...cellStyle(true, true, 50, 'top2'),
                fontSize: 9,
                color: 'var(--text-muted)'
              }}>
                название объекта
              </th>
              <th style={{ ...cellStyle(true, true, 250, 'top2'), fontSize: 9 }}>статус</th>
              <th style={{ ...cellStyle(true, true, 370, 'top2'), fontSize: 9 }}>секций</th>
              <th style={{ ...cellStyle(true, true, 470, 'top2'), fontSize: 9 }}>площадь м²</th>
              <th style={{ ...cellStyle(true, true, 620, 'top2'), fontSize: 9 }}>срок мес.</th>
              {filteredMonths.map((date, idx) => (
                <th 
                  key={idx} 
                  style={{ 
                    ...cellStyle(true, false, 0, 'top2'),
                    fontSize: 8,
                    padding: '2px',
                    color: date.getMonth() === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: date.getMonth() === 0 ? 700 : 400,
                    background: date.getMonth() === 0 
                      ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)')
                      : (isDark ? '#1e293b' : '#f8fafc')
                  }}
                >
                  {formatMonth(date)}
                  {date.getMonth() === 0 && <div style={{ fontSize: 7 }}>{date.getFullYear()}</div>}
                </th>
              ))}
              <th style={{ ...cellStyle(true, false, 0, 'top2') }}></th>
            </tr>
            
            {/* Месяцы - вторая строка (м2) */}
            <tr>
              <th style={{ 
                ...cellStyle(true, true, 0, 'top3'),
                fontSize: 9,
                color: 'var(--text-muted)',
                borderTop: 'none'
              }}>
              </th>
              <th style={{ 
                ...cellStyle(true, true, 50, 'top3'),
                fontSize: 9,
                color: 'var(--text-muted)',
                borderTop: 'none'
              }}>
              </th>
              <th style={{ ...cellStyle(true, true, 250, 'top3'), fontSize: 9, borderTop: 'none' }}></th>
              <th style={{ ...cellStyle(true, true, 370, 'top3'), fontSize: 9, borderTop: 'none' }}></th>
              <th style={{ ...cellStyle(true, true, 470, 'top3'), fontSize: 9, borderTop: 'none' }}></th>
              <th style={{ ...cellStyle(true, true, 620, 'top3'), fontSize: 9, borderTop: 'none' }}></th>
              {filteredMonths.map((date, idx) => (
                <th 
                  key={idx} 
                  style={{ 
                    ...cellStyle(true, false, 0, 'top3'),
                    fontSize: 8,
                    padding: '2px',
                    color: 'var(--text-muted)',
                    fontWeight: 400,
                    background: date.getMonth() === 0 
                      ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)')
                      : (isDark ? '#1e293b' : '#f8fafc'),
                    borderTop: 'none'
                  }}
                >
                  м²
                </th>
              ))}
              <th style={{ ...cellStyle(true, false, 0, 'top3'), borderTop: 'none' }}></th>
            </tr>
          </thead>
          
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={6 + filteredMonths.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchText ? 'Проекты не найдены' : 'Проекты автоматически загружаются из объектов строительства...'}
                </td>
              </tr>
            ) : (
              filteredProjects.map((project, rowIdx) => (
                <tr 
                  key={project.id}
                  onMouseEnter={() => setHoveredRow(project.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ 
                    background: project.id === hoveredRow
                      ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)')
                      : project.is_subtotal 
                        ? (isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)')
                        : project.is_total
                          ? (isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)')
                          : 'transparent',
                    transition: 'background 0.1s'
                  }}
                >
                  {/* № */}
                  <td style={{ 
                    ...cellStyle(false, true, 0),
                    fontSize: 11,
                    fontWeight: project.is_subtotal || project.is_total ? 700 : 400
                  }}>
                    {rowIdx + 1}
                  </td>
                  
                  {/* Название проекта */}
                  <td style={{ 
                    ...cellStyle(false, true, 50),
                    textAlign: 'left',
                    paddingLeft: project.name.startsWith('  ') ? 24 : 12,
                    fontWeight: project.is_subtotal || project.is_total ? 700 : 500,
                    fontSize: project.is_subtotal ? 14 : 13,
                    color: project.is_subtotal 
                      ? '#3b82f6' 
                      : project.is_total 
                        ? '#22c55e'
                        : 'var(--text-primary)',
                    borderLeft: project.is_subtotal ? '4px solid #3b82f6' : 'none'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {project.city_id && !project.name.startsWith('  ') && (
                        <span style={{ 
                          width: 8, 
                          height: 8, 
                          borderRadius: '50%', 
                          background: '#22c55e',
                          flexShrink: 0
                        }} title="Привязан к объекту" />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.name.trim()}</span>
                    </div>
                  </td>
                  
                  {/* Текущий статус */}
                  <td style={{ ...cellStyle(false, true, 250), fontSize: 11 }}>
                    {project.current_status || '—'}
                  </td>
                  
                  {/* Кол-во секций */}
                  <td style={{ ...cellStyle(false, true, 370), fontSize: 11 }}>
                    {project.sections_count || '—'}
                  </td>
                  
                  {/* Продаваемая площадь (М2) */}
                  <td style={{ ...cellStyle(false, true, 470), fontSize: 11 }}>
                    {project.sellable_area ? project.sellable_area.toLocaleString('ru-RU') : '—'}
                  </td>
                  
                  {/* Срок реализации (мес) */}
                  <td style={{ ...cellStyle(false, true, 620), fontSize: 11 }}>
                    {project.construction_duration || '—'}
                  </td>
                  
                  {/* Месяцы */}
                  {filteredMonths.map((date, idx) => {
                    const milestone = getMilestone(project, date);
                    const dateStr = formatDateLocal(date);
                    const cellKey = `${project.id}-${dateStr}`;
                    const isUpdating = updatingCells.has(cellKey);
                    const isEditing = editingCell?.projectId === project.id && editingCell?.date === dateStr;
                    const cellMilestoneStyle = getMilestoneCellStyle(milestone);
                    
                    return (
                      <td 
                        key={idx}
                        style={{ 
                          ...cellStyle(),
                          ...cellMilestoneStyle,
                          cursor: project.is_subtotal || project.is_total || isUpdating ? 'default' : 'pointer',
                          position: 'relative',
                          padding: 2,
                          transition: 'background 0.2s',
                          opacity: isUpdating ? 0.6 : 1
                        }}
                        onClick={() => !project.is_subtotal && !project.is_total && handleCellClick(project.id, date)}
                      >
                        {isUpdating && (
                          <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 5
                          }}>
                            <div className="loading-spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                          </div>
                        )}
                        {isEditing ? (
                          <div style={{ 
                            position: 'absolute', 
                            top: '100%', 
                            left: '50%', 
                            transform: 'translateX(-50%)',
                            zIndex: 1000,
                            background: isDark ? '#1e293b' : '#fff',
                            padding: 12,
                            borderRadius: 8,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                            minWidth: 220,
                            border: `1px solid ${isDark ? '#475569' : '#e2e8f0'}`
                          }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                              {project.name.trim()} - {formatMonth(date)} {date.getFullYear()}
                            </div>
                            <select
                              value={selectedMilestoneType}
                              onChange={(e) => setSelectedMilestoneType(e.target.value)}
                              className="form-control"
                              style={{ marginBottom: 8, fontSize: 12, height: 32 }}
                            >
                              <option value="">— Статус (РНВ, стр-во, ПФ, РНС) —</option>
                              {Object.keys(MILESTONE_TYPES).map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              value={editAreaValue}
                              onChange={(e) => setEditAreaValue(e.target.value)}
                              placeholder="Площадь (м²)"
                              className="form-control"
                              style={{ marginBottom: 8, fontSize: 12, height: 32 }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCellEdit();
                                if (e.key === 'Escape') closeEditModal();
                              }}
                            />
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              placeholder="Комментарий (опционально)"
                              className="form-control"
                              style={{ marginBottom: 12, fontSize: 12, height: 32 }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveCellEdit();
                                if (e.key === 'Escape') closeEditModal();
                              }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button onClick={saveCellEdit} className="btn btn-primary btn-sm" style={{ flex: 2, height: 32 }}>
                                Сохранить
                              </button>
                              <button onClick={closeEditModal} className="btn btn-secondary btn-sm" style={{ flex: 1, height: 32 }}>
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ 
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            minHeight: 32,
                            justifyContent: 'center',
                            padding: '2px 1px'
                          }}>
                            {/* Первая строка - статус */}
                            <div style={{ 
                              fontSize: 9, 
                              fontWeight: milestone?.milestone_type ? 600 : 400,
                              color: milestone?.milestone_type ? (MILESTONE_TYPES[milestone.milestone_type]?.color || 'var(--text-primary)') : 'var(--text-muted)',
                              lineHeight: 1.2
                            }}>
                              {milestone?.milestone_type || ''}
                            </div>
                            {/* Вторая строка - м2 */}
                            <div style={{ 
                              fontSize: 8, 
                              fontWeight: milestone?.area_value ? 500 : 400,
                              color: milestone?.area_value ? 'var(--text-primary)' : 'var(--text-muted)',
                              lineHeight: 1.2
                            }}>
                              {milestone?.area_value ? `${milestone.area_value.toLocaleString('ru-RU')} м²` : ''}
                            </div>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  
                  {/* Действия */}
                  <td style={{ ...cellStyle() }}>
                    {!project.is_subtotal && !project.is_total && (
                      <button 
                        onClick={() => deleteProject(project.id)}
                        className="btn btn-sm"
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: '#ef4444',
                          padding: 4,
                          cursor: 'pointer',
                          opacity: 0.5
                        }}
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.5}
                        title="Удалить строку"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default StrategicMap;
