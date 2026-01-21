import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';

const ModernGanttChart = ({ schedules, cities, selectedView = null, onScheduleUpdate }) => {
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState(selectedView || 'all');
  const [timeScale, setTimeScale] = useState('week');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [cpmData, setCpmData] = useState({ nodes: [], criticalStages: [] });
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  
  const sidebarRef = useRef(null);
  const timelineBodyRef = useRef(null);

  // Константы
  const ROW_HEIGHT = 50;
  const HEADER_HEIGHT = 70;
  const TASK_HEIGHT = 36;
  const SIDEBAR_WIDTH = 320;
  const DAY_WIDTH = timeScale === 'day' ? 30 : timeScale === 'week' ? 12 : 4;

  // Цвета
  const typeColors = {
    document: { bg: '#3b82f6', border: '#1d4ed8' },
    hr: { bg: '#8b5cf6', border: '#6d28d9' },
    procurement: { bg: '#f59e0b', border: '#d97706' },
    construction: { bg: '#10b981', border: '#059669' },
    marketing: { bg: '#ec4899', border: '#db2777' }
  };

  const typeNames = {
    document: 'Тех. заказчик',
    hr: 'HR',
    procurement: 'Закупки',
    construction: 'Строительство',
    marketing: 'Маркетинг'
  };

  // Форматирование даты
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatDateShort = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  // Синхронизация скролла
  const handleSidebarScroll = (e) => {
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleTimelineScroll = (e) => {
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.target.scrollTop;
    }
  };

  // Временной диапазон
  const timeRange = useMemo(() => {
    if (tasks.length === 0) return { start: new Date(), end: new Date(), days: 0 };
    
    let minDate = new Date(Math.min(...tasks.map(t => t.plannedStart.getTime())));
    let maxDate = new Date(Math.max(...tasks.map(t => t.plannedEnd.getTime())));
    
    minDate = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);
    
    const days = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
    return { start: minDate, end: maxDate, days };
  }, [tasks]);

  // Заголовки месяцев
  const monthHeaders = useMemo(() => {
    const headers = [];
    if (timeRange.days === 0) return headers;
    
    const current = new Date(timeRange.start);
    while (current <= timeRange.end) {
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const daysInMonth = Math.min(
        monthEnd.getDate() - current.getDate() + 1,
        Math.ceil((timeRange.end - current) / (1000 * 60 * 60 * 24)) + 1
      );
      
      headers.push({
        label: current.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' }),
        width: daysInMonth * DAY_WIDTH,
        startDay: current.getDate()
      });
      
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }
    return headers;
  }, [timeRange, DAY_WIDTH]);

  // CPM алгоритм
  const calculateCPM = useCallback((taskList) => {
    if (taskList.length === 0) return { nodes: [], criticalStages: [] };

    const byStage = {};
    taskList.forEach(task => {
      const stage = task.constructionStage || 'Без этапа';
      if (!byStage[stage]) byStage[stage] = [];
      byStage[stage].push(task);
    });

    const stageOrder = Object.keys(byStage).sort((a, b) => {
      const minA = Math.min(...byStage[a].map(t => t.plannedStart.getTime()));
      const minB = Math.min(...byStage[b].map(t => t.plannedStart.getTime()));
      return minA - minB;
    });

    const nodes = stageOrder.map((stage, idx) => {
      const stageTasks = byStage[stage];
      const start = new Date(Math.min(...stageTasks.map(t => t.plannedStart.getTime())));
      const end = new Date(Math.max(...stageTasks.map(t => t.plannedEnd.getTime())));
      const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      
      return {
        id: idx, stage, duration,
        ES: 0, EF: 0, LS: 0, LF: 0, float: 0, isCritical: false,
        predecessors: idx > 0 ? [idx - 1] : [],
        successors: idx < stageOrder.length - 1 ? [idx + 1] : []
      };
    });

    if (nodes.length === 0) return { nodes: [], criticalStages: [] };

    // Forward Pass
    nodes.forEach(node => {
      node.ES = node.predecessors.length === 0 ? 0 : Math.max(...node.predecessors.map(i => nodes[i].EF));
      node.EF = node.ES + node.duration;
    });

    // Backward Pass
    const projectDuration = Math.max(...nodes.map(n => n.EF));
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      node.LF = node.successors.length === 0 ? projectDuration : Math.min(...node.successors.map(j => nodes[j].LS));
      node.LS = node.LF - node.duration;
    }

    nodes.forEach(node => {
      node.float = node.LS - node.ES;
      node.isCritical = node.float === 0;
    });

    return { nodes, criticalStages: nodes.filter(n => n.isCritical).map(n => n.stage) };
  }, []);

  // Обработка данных
  useEffect(() => {
    if (!schedules || schedules.length === 0) return;

    const processed = schedules
      .filter(s => viewMode === 'all' || s.schedule_type === viewMode)
      .map(schedule => {
        const city = cities.find(c => c.id === schedule.city_id);
        return {
          id: schedule.id,
          cityName: city?.name || 'Неизвестный объект',
          constructionStage: schedule.construction_stage || 'Без этапа',
          workName: schedule.work_name || schedule.vacancy || schedule.sections || '',
          type: schedule.schedule_type,
          plannedStart: new Date(schedule.planned_start_date),
          plannedEnd: new Date(schedule.planned_end_date),
          actualStart: schedule.actual_start_date ? new Date(schedule.actual_start_date) : null,
          actualEnd: schedule.actual_end_date ? new Date(schedule.actual_end_date) : null,
          color: typeColors[schedule.schedule_type] || typeColors.construction
        };
      })
      .sort((a, b) => a.plannedStart - b.plannedStart);

    setTasks(processed);
    setCpmData(calculateCPM(processed));
  }, [schedules, cities, viewMode, calculateCPM]);

  // Позиция задачи
  const getTaskPosition = useCallback((task) => {
    const startOffset = Math.ceil((task.plannedStart - timeRange.start) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((task.plannedEnd - task.plannedStart) / (1000 * 60 * 60 * 24)) + 1;
    return {
      left: startOffset * DAY_WIDTH,
      width: Math.max(duration * DAY_WIDTH, 30)
    };
  }, [timeRange.start, DAY_WIDTH]);

  // Drag handlers
  const handleMouseDown = (e, task, action) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const taskPos = getTaskPosition(task);
    
    if (action === 'move') {
      setDragging({ task, startX, originalStart: task.plannedStart, originalEnd: task.plannedEnd });
    } else {
      setResizing({ task, startX, action, originalStart: task.plannedStart, originalEnd: task.plannedEnd });
    }
  };

  const handleMouseMove = useCallback((e) => {
    const deltaX = dragging ? e.clientX - dragging.startX : resizing ? e.clientX - resizing.startX : 0;
    const daysDelta = Math.round(deltaX / DAY_WIDTH);
    
    if (daysDelta === 0) return;

    if (dragging) {
      const newStart = new Date(dragging.originalStart);
      const newEnd = new Date(dragging.originalEnd);
      newStart.setDate(newStart.getDate() + daysDelta);
      newEnd.setDate(newEnd.getDate() + daysDelta);
      
      setTasks(prev => prev.map(t => 
        t.id === dragging.task.id ? { ...t, plannedStart: newStart, plannedEnd: newEnd } : t
      ));
    }
    
    if (resizing) {
      if (resizing.action === 'resize-end') {
        const newEnd = new Date(resizing.originalEnd);
        newEnd.setDate(newEnd.getDate() + daysDelta);
        if (newEnd > resizing.originalStart) {
          setTasks(prev => prev.map(t => 
            t.id === resizing.task.id ? { ...t, plannedEnd: newEnd } : t
          ));
        }
      } else {
        const newStart = new Date(resizing.originalStart);
        newStart.setDate(newStart.getDate() + daysDelta);
        if (newStart < resizing.originalEnd) {
          setTasks(prev => prev.map(t => 
            t.id === resizing.task.id ? { ...t, plannedStart: newStart } : t
          ));
        }
      }
    }
  }, [dragging, resizing, DAY_WIDTH]);

  const handleMouseUp = useCallback(() => {
    if ((dragging || resizing) && onScheduleUpdate) {
      const task = dragging?.task || resizing?.task;
      const updated = tasks.find(t => t.id === task?.id);
      if (updated) {
        onScheduleUpdate(updated.id, {
          planned_start_date: updated.plannedStart.toISOString(),
          planned_end_date: updated.plannedEnd.toISOString()
        });
      }
      setCpmData(calculateCPM(tasks));
    }
    setDragging(null);
    setResizing(null);
  }, [dragging, resizing, tasks, onScheduleUpdate, calculateCPM]);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  const isCritical = (task) => showCriticalPath && cpmData.criticalStages.includes(task.constructionStage);
  
  // Возвращает объект { delay: число дней задержки, early: число дней раньше срока }
  const getTimingInfo = (task) => {
    const now = new Date();
    let delay = 0;
    let early = 0;
    
    // Проверяем задержку окончания
    if (task.actualEnd && task.actualEnd > task.plannedEnd) {
      delay = Math.ceil((task.actualEnd - task.plannedEnd) / (1000 * 60 * 60 * 24));
    } else if (!task.actualEnd && task.actualStart && now > task.plannedEnd) {
      delay = Math.ceil((now - task.plannedEnd) / (1000 * 60 * 60 * 24));
    }
    
    // Проверяем раннее завершение
    if (task.actualEnd && task.actualEnd < task.plannedEnd) {
      early = Math.ceil((task.plannedEnd - task.actualEnd) / (1000 * 60 * 60 * 24));
    }
    
    // Проверяем раннее начало
    let earlyStart = 0;
    let lateStart = 0;
    if (task.actualStart && task.actualStart < task.plannedStart) {
      earlyStart = Math.ceil((task.plannedStart - task.actualStart) / (1000 * 60 * 60 * 24));
    } else if (task.actualStart && task.actualStart > task.plannedStart) {
      lateStart = Math.ceil((task.actualStart - task.plannedStart) / (1000 * 60 * 60 * 24));
    }
    
    return { delay, early, earlyStart, lateStart };
  };

  const getStageFloat = (stage) => {
    const node = cpmData.nodes.find(n => n.stage === stage);
    return node?.float || 0;
  };

  // Рендер бара
  const renderTaskBar = (task) => {
    const pos = getTaskPosition(task);
    const critical = isCritical(task);
    const timing = getTimingInfo(task);
    const stageFloat = getStageFloat(task.constructionStage);
    const isHovered = hoveredTask === task.id;
    
    // Цвет в зависимости от статуса
    let bgColor = task.color.bg;
    let borderColor = task.color.border;
    
    if (timing.early > 0) {
      // Завершено раньше срока - зелёный
      bgColor = '#22c55e';
      borderColor = '#16a34a';
    } else if (critical && timing.delay > 0) {
      // Критический путь с задержкой - красный
      bgColor = '#ef4444';
      borderColor = '#b91c1c';
    } else if (critical) {
      // Критический путь без задержки - оранжевый
      bgColor = '#f97316';
      borderColor = '#c2410c';
    }

    return (
      <div
        key={task.id}
        style={{
          position: 'absolute',
          left: pos.left,
          width: pos.width,
          top: (ROW_HEIGHT - TASK_HEIGHT) / 2,
          height: TASK_HEIGHT,
          opacity: showCriticalPath && !critical ? 0.35 : 1,
          zIndex: isHovered ? 10 : 1
        }}
        onMouseEnter={() => setHoveredTask(task.id)}
        onMouseLeave={() => setHoveredTask(null)}
      >
        {/* Основной бар */}
        <div
          style={{
            width: '100%',
            height: '100%',
            background: `linear-gradient(180deg, ${bgColor} 0%, ${borderColor} 100%)`,
            borderRadius: '4px',
            border: critical ? '2px solid #fff' : `1px solid ${borderColor}`,
            boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
            cursor: dragging || resizing ? 'grabbing' : 'grab',
            position: 'relative',
            transition: 'box-shadow 0.2s'
          }}
          onMouseDown={(e) => handleMouseDown(e, task, 'move')}
        >
          {/* Содержимое бара */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: '100%',
            padding: '0 6px',
            color: '#fff',
            fontSize: '10px',
            fontWeight: '600',
            overflow: 'hidden'
          }}>
            {/* Дата начала */}
            <span style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {formatDateShort(task.plannedStart)}
            </span>
            
            {/* Название (если есть место) */}
            {pos.width > 150 && (
              <span style={{
                flex: 1,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                padding: '0 4px',
                fontSize: '11px'
              }}>
                {task.workName || task.constructionStage}
              </span>
            )}
            
            {/* Дата окончания */}
            <span style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {formatDateShort(task.plannedEnd)}
            </span>
          </div>

          {/* Маркер статуса (раньше/позже срока) */}
          {(timing.early > 0 || timing.delay > 0 || timing.earlyStart > 0 || timing.lateStart > 0) && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '4px'
            }}>
              {timing.early > 0 && (
                <span style={{
                  background: '#16a34a',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  ✓ +{timing.early}д раньше
                </span>
              )}
              {timing.delay > 0 && (
                <span style={{
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  ⚠ -{timing.delay}д позже
                </span>
              )}
              {timing.earlyStart > 0 && (
                <span style={{
                  background: '#0891b2',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  ▶ +{timing.earlyStart}д раньше
                </span>
              )}
              {timing.lateStart > 0 && (
                <span style={{
                  background: '#d97706',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  ▶ -{timing.lateStart}д позже
                </span>
              )}
            </div>
          )}

          {/* Маркер критического пути */}
          {critical && timing.delay === 0 && timing.early === 0 && (
            <div style={{
              position: 'absolute',
              top: '-10px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#ea580c',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '1px 6px',
              borderRadius: '8px',
              whiteSpace: 'nowrap'
            }}>
              🔥 КП
            </div>
          )}

          {/* Резерв времени */}
          {showCriticalPath && !critical && stageFloat > 0 && timing.early === 0 && (
            <div style={{
              position: 'absolute',
              bottom: '-10px',
              right: '4px',
              background: '#22c55e',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '1px 5px',
              borderRadius: '8px'
            }}>
              +{stageFloat}д резерв
            </div>
          )}
        </div>

        {/* Ручки resize */}
        <div
          style={{
            position: 'absolute', left: 0, top: 0, width: '8px', height: '100%',
            cursor: 'ew-resize', borderRadius: '4px 0 0 4px'
          }}
          onMouseDown={(e) => handleMouseDown(e, task, 'resize-start')}
        />
        <div
          style={{
            position: 'absolute', right: 0, top: 0, width: '8px', height: '100%',
            cursor: 'ew-resize', borderRadius: '0 4px 4px 0'
          }}
          onMouseDown={(e) => handleMouseDown(e, task, 'resize-end')}
        />

        {/* Фактическое выполнение */}
        {task.actualStart && (
          <div style={{
            position: 'absolute',
            left: Math.max(0, Math.ceil((task.actualStart - task.plannedStart) / (1000 * 60 * 60 * 24)) * DAY_WIDTH),
            top: TASK_HEIGHT + 2,
            width: task.actualEnd
              ? Math.ceil((task.actualEnd - task.actualStart) / (1000 * 60 * 60 * 24)) * DAY_WIDTH
              : Math.ceil((new Date() - task.actualStart) / (1000 * 60 * 60 * 24)) * DAY_WIDTH,
            height: '4px',
            background: timing.delay > 0 ? '#ef4444' : timing.early > 0 ? '#16a34a' : '#22c55e',
            borderRadius: '2px'
          }} />
        )}

        {/* Tooltip при наведении */}
        {isHovered && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            background: '#1e293b',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '4px' }}>
              {task.workName || task.constructionStage}
            </div>
            <div style={{ color: '#94a3b8' }}>
              📅 План: {formatDate(task.plannedStart)} — {formatDate(task.plannedEnd)}
            </div>
            {task.actualStart && (
              <div style={{ color: timing.delay > 0 ? '#fca5a5' : '#86efac', marginTop: '2px' }}>
                ✓ Факт: {formatDate(task.actualStart)} — {task.actualEnd ? formatDate(task.actualEnd) : 'в работе'}
              </div>
            )}
            {timing.early > 0 && (
              <div style={{ color: '#86efac', marginTop: '2px' }}>🎉 Завершено на {timing.early} дн. раньше!</div>
            )}
            {timing.delay > 0 && (
              <div style={{ color: '#fca5a5', marginTop: '2px' }}>⚠️ Опоздание на {timing.delay} дн.</div>
            )}
            {timing.earlyStart > 0 && (
              <div style={{ color: '#67e8f9', marginTop: '2px' }}>▶ Начато на {timing.earlyStart} дн. раньше</div>
            )}
            {timing.lateStart > 0 && (
              <div style={{ color: '#fcd34d', marginTop: '2px' }}>▶ Начато на {timing.lateStart} дн. позже</div>
            )}
            {critical && <div style={{ color: '#fdba74', marginTop: '2px' }}>🔥 Критический путь</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Заголовок */}
      <div style={{ 
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#1e293b' }}>
          📊 Диаграмма Ганта
        </h2>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {!selectedView && (
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <option value="all">Все отделы</option>
              <option value="document">Тех. заказчик</option>
              <option value="hr">HR</option>
              <option value="procurement">Закупки</option>
              <option value="construction">Строительство</option>
              <option value="marketing">Маркетинг</option>
            </select>
          )}

          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '3px' }}>
            {[
              { key: 'day', label: 'День' },
              { key: 'week', label: 'Неделя' },
              { key: 'month', label: 'Месяц' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeScale(key)}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  background: timeScale === key ? '#fff' : 'transparent',
                  boxShadow: timeScale === key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: timeScale === key ? '600' : '500',
                  color: timeScale === key ? '#1e293b' : '#64748b'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: showCriticalPath ? '#f97316' : '#3b82f6',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {showCriticalPath ? '🔥 Скрыть КП' : '⚡ Критический путь'}
          </button>
        </div>
      </div>

      {/* Информация о КП */}
      {showCriticalPath && cpmData.nodes.length > 0 && (
        <div style={{
          background: '#fff7ed',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid #fed7aa',
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>🔥</span>
            <span style={{ fontWeight: '600', color: '#c2410c' }}>Критический путь</span>
          </div>
          <div>
            <span style={{ color: '#78716c', fontSize: '12px' }}>Длительность: </span>
            <strong>{Math.max(...cpmData.nodes.map(n => n.EF))} дней</strong>
          </div>
          <div>
            <span style={{ color: '#78716c', fontSize: '12px' }}>Критических этапов: </span>
            <strong style={{ color: '#ea580c' }}>{cpmData.criticalStages.length}</strong>
            <span style={{ color: '#a8a29e' }}> / {cpmData.nodes.length}</span>
          </div>
          <div>
            <span style={{ color: '#78716c', fontSize: '12px' }}>С резервом: </span>
            <strong style={{ color: '#16a34a' }}>{cpmData.nodes.filter(n => n.float > 0).length}</strong>
          </div>
        </div>
      )}

      {/* Диаграмма */}
      <div style={{
        display: 'flex',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Сайдбар */}
        <div style={{ width: SIDEBAR_WIDTH, flexShrink: 0, borderRight: '1px solid #e2e8f0' }}>
          {/* Заголовок сайдбара */}
          <div style={{
            height: HEADER_HEIGHT,
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontWeight: '600',
            color: '#475569',
            fontSize: '13px'
          }}>
            Задачи ({tasks.length})
          </div>
          
          {/* Список задач */}
          <div 
            ref={sidebarRef}
            onScroll={handleSidebarScroll}
            style={{ 
              height: `calc(100vh - 400px)`,
              minHeight: '300px',
              maxHeight: '600px',
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  height: ROW_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  borderBottom: '1px solid #f1f5f9',
                  background: hoveredTask === task.id ? '#f8fafc' : '#fff',
                  cursor: 'pointer'
                }}
                onMouseEnter={() => setHoveredTask(task.id)}
                onMouseLeave={() => setHoveredTask(null)}
              >
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: isCritical(task) ? '#f97316' : task.color.bg,
                  marginRight: '10px',
                  flexShrink: 0,
                  border: isCritical(task) ? '2px solid #fff' : 'none',
                  boxShadow: isCritical(task) ? '0 0 0 2px #f97316' : 'none'
                }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {task.workName || task.constructionStage}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#64748b',
                    display: 'flex',
                    gap: '6px',
                    marginTop: '2px'
                  }}>
                    <span>{typeNames[task.type]}</span>
                    <span>•</span>
                    <span>{formatDateShort(task.plannedStart)} - {formatDateShort(task.plannedEnd)}</span>
                  </div>
                </div>
                {isCritical(task) && <span style={{ fontSize: '12px' }}>🔥</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Таймлайн */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {/* Заголовок таймлайна */}
          <div style={{
            height: HEADER_HEIGHT,
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            overflowX: 'auto',
            overflowY: 'hidden'
          }}>
            <div style={{ display: 'flex', minWidth: timeRange.days * DAY_WIDTH }}>
              {monthHeaders.map((month, i) => (
                <div
                  key={i}
                  style={{
                    width: month.width,
                    flexShrink: 0,
                    height: HEADER_HEIGHT,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRight: '1px solid #e2e8f0',
                    fontWeight: '600',
                    fontSize: '12px',
                    color: '#475569'
                  }}
                >
                  {month.label}
                </div>
              ))}
            </div>
          </div>

          {/* Область задач */}
          <div 
            ref={timelineBodyRef}
            onScroll={handleTimelineScroll}
            style={{ 
              height: `calc(100vh - 400px)`,
              minHeight: '300px',
              maxHeight: '600px',
              overflowY: 'auto',
              overflowX: 'auto'
            }}
          >
            <div style={{ 
              position: 'relative',
              minWidth: timeRange.days * DAY_WIDTH,
              minHeight: tasks.length * ROW_HEIGHT
            }}>
              {/* Сетка */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `repeating-linear-gradient(90deg, #f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent ${DAY_WIDTH * 7}px)`,
                pointerEvents: 'none'
              }} />

              {/* Линия сегодня */}
              {(() => {
                const today = new Date();
                if (today >= timeRange.start && today <= timeRange.end) {
                  const offset = Math.ceil((today - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                  return (
                    <div style={{
                      position: 'absolute',
                      left: offset,
                      top: 0,
                      bottom: 0,
                      width: '2px',
                      background: '#ef4444',
                      zIndex: 5
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#ef4444',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '9px',
                        fontWeight: '600'
                      }}>
                        Сегодня
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Строки задач */}
              {tasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    height: ROW_HEIGHT,
                    position: 'relative',
                    borderBottom: '1px solid #f1f5f9',
                    background: hoveredTask === task.id ? 'rgba(59, 130, 246, 0.03)' : 'transparent'
                  }}
                >
                  {renderTaskBar(task)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Легенда */}
      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '12px',
        background: '#f8fafc',
        borderRadius: '6px',
        fontSize: '12px'
      }}>
        <span style={{ fontWeight: '600', color: '#475569' }}>Легенда:</span>
        {Object.entries(typeColors).map(([type, colors]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '20px', height: '10px', borderRadius: '2px',
              background: `linear-gradient(180deg, ${colors.bg} 0%, ${colors.border} 100%)`
            }} />
            <span style={{ color: '#64748b' }}>{typeNames[type]}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '10px', borderRadius: '2px', background: '#22c55e' }} />
          <span style={{ color: '#64748b' }}>Раньше срока</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '20px', height: '10px', borderRadius: '2px', background: '#ef4444' }} />
          <span style={{ color: '#64748b' }}>Задержка</span>
        </div>
        {showCriticalPath && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '10px', borderRadius: '2px', background: '#f97316' }} />
            <span style={{ color: '#64748b' }}>Критический путь</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
        💡 Перетаскивайте бары для изменения дат. Тяните за края для изменения длительности.
      </div>
    </div>
  );
};

export default ModernGanttChart;
