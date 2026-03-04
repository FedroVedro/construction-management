import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import client from '../../api/client';
import { formatDate as formatDateUtil } from '../../utils/dateParser';
import { useTheme } from '../../context/ThemeContext';

const ModernGanttChart = ({ schedules, cities, selectedView = null, onScheduleUpdate }) => {
  const { isDark } = useTheme();
  const [tasks, setTasks] = useState([]);
  const [viewMode, setViewMode] = useState(selectedView || 'all');
  const [timeScale, setTimeScale] = useState('week');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [cpmData, setCpmData] = useState({ nodes: [], edges: [], criticalStages: [], criticalTaskIds: [] });
  // eslint-disable-next-line no-unused-vars
  const [dependencies, setDependencies] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const [sortBy, setSortBy] = useState('stage'); // date, stage, type
  const [syncCount, setSyncCount] = useState(0); // Счётчик активных операций синхронизации
  const isSyncing = syncCount > 0; // Индикатор синхронизации (вычисляемое значение)
  const [yearFilter, setYearFilter] = useState('all'); // Фильтр по году
  const [startYear, setStartYear] = useState(null); // Начальный год диапазона
  const [endYear, setEndYear] = useState(null); // Конечный год диапазона
  const [stageFilter, setStageFilter] = useState(''); // Фильтр по этапу строительства
  const [stages, setStages] = useState([]); // Список этапов строительства
  
  const sidebarRef = useRef(null);
  const timelineBodyRef = useRef(null);
  const timelineHeaderRef = useRef(null);
  const rafRef = useRef(null); // Для requestAnimationFrame
  const pendingUpdateRef = useRef(null); // Для хранения отложенного обновления

  // Константы
  const ROW_HEIGHT = 56;
  const HEADER_HEIGHT = 70;
  const TASK_HEIGHT = 40;
  const SIDEBAR_WIDTH = 340;
  const DAY_WIDTH = timeScale === 'day' ? 30 : timeScale === 'week' ? 12 : 4;

  // Цвета (мягкие пастельные оттенки)
  const typeColors = {
    document: { bg: '#7b9eb8', border: '#5a7d96' },
    hr: { bg: '#a99bc4', border: '#8677a3' },
    procurement: { bg: '#d4b896', border: '#b89b73' },
    construction: { bg: '#8bc49a', border: '#69a378' },
    marketing: { bg: '#d4a0b8', border: '#b87d9a' },
    preconstruction: { bg: '#7baeb8', border: '#5a8d96' }
  };

  const typeNames = {
    document: 'Тех. заказчик',
    hr: 'HR',
    procurement: 'Закупки',
    construction: 'Строительство',
    marketing: 'Маркетинг',
    preconstruction: 'График ТЗ'
  };

  // Форматирование даты
  // Используем утилиту форматирования дат (DD/MM/YYYY)
  const formatDate = (date) => {
    if (!date) return '';
    return formatDateUtil(date);
  };

  const formatDateShort = (date) => {
    if (!date) return '';
    const formatted = formatDateUtil(date);
    // Возвращаем только DD/MM (без года)
    return formatted.substring(0, 5);
  };

  // Синхронизация скролла
  const handleSidebarScroll = (e) => {
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollTop = e.target.scrollTop;
    }
  };

  const handleTimelineScroll = (e) => {
    // Синхронизация вертикального скролла с sidebar
    if (sidebarRef.current) {
      sidebarRef.current.scrollTop = e.target.scrollTop;
    }
    // Синхронизация горизонтального скролла с заголовком таймлайна
    if (timelineHeaderRef.current) {
      timelineHeaderRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  const handleTimelineHeaderScroll = (e) => {
    // Синхронизация горизонтального скролла с областью задач
    if (timelineBodyRef.current) {
      timelineBodyRef.current.scrollLeft = e.target.scrollLeft;
    }
  };

  // Загрузка этапов строительства
  useEffect(() => {
    const fetchStages = async () => {
      try {
        const response = await client.get('/construction-stages?active_only=true');
        // Сортируем по order_index для правильного порядка
        const sortedStages = response.data.sort((a, b) => a.order_index - b.order_index);
        setStages(sortedStages);
      } catch (error) {
        console.error('Error fetching stages:', error);
      }
    };
    fetchStages();
  }, []);

  // Границы диапазона годов (мин/макс из данных с запасом)
  const yearRangeLimits = useMemo(() => {
    if (tasks.length === 0) return { min: 2018, max: 2035 };
    const years = new Set();
    tasks.forEach(task => {
      if (task.plannedStart) years.add(task.plannedStart.getFullYear());
      if (task.plannedEnd) years.add(task.plannedEnd.getFullYear());
      if (task.actualStart) years.add(task.actualStart.getFullYear());
      if (task.actualEnd) years.add(task.actualEnd.getFullYear());
    });
    const yearsArray = Array.from(years);
    if (yearsArray.length === 0) return { min: 2018, max: 2035 };
    
    const minYear = Math.min(...yearsArray);
    const maxYear = Math.max(...yearsArray);
    return {
      min: Math.max(2018, minYear - 2), // С запасом -2 года
      max: Math.min(2035, maxYear + 2)  // С запасом +2 года
    };
  }, [tasks]);

  // Доступные годы из задач (для выпадающего списка)
  const availableYears = useMemo(() => {
    if (tasks.length === 0) return [];
    const years = new Set();
    tasks.forEach(task => {
      if (task.plannedStart) years.add(task.plannedStart.getFullYear());
      if (task.plannedEnd) years.add(task.plannedEnd.getFullYear());
      if (task.actualStart) years.add(task.actualStart.getFullYear());
      if (task.actualEnd) years.add(task.actualEnd.getFullYear());
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [tasks]);

  // Находим самую раннюю и самую позднюю даты из всех задач
  const earliestDate = useMemo(() => {
    if (tasks.length === 0) return null;
    const dates = [];
    tasks.forEach(task => {
      if (task.plannedStart) dates.push(task.plannedStart);
      if (task.actualStart) dates.push(task.actualStart);
    });
    return dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
  }, [tasks]);

  const latestDate = useMemo(() => {
    if (tasks.length === 0) return null;
    const dates = [];
    tasks.forEach(task => {
      if (task.plannedEnd) dates.push(task.plannedEnd);
      if (task.actualEnd) dates.push(task.actualEnd);
    });
    return dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
  }, [tasks]);

  // Инициализация диапазона годов на основе данных
  useEffect(() => {
    if (availableYears.length > 0) {
      const minYearVal = availableYears[0];
      const maxYearVal = availableYears[availableYears.length - 1];
      
      // Устанавливаем только если еще не установлены
      if (startYear === null) {
        setStartYear(minYearVal);
      }
      if (endYear === null) {
        setEndYear(maxYearVal);
      }
    }
  }, [availableYears, startYear, endYear]);

  // Используем вычисленные значения или дефолтные
  const activeStartYear = startYear ?? 2022;
  const activeEndYear = endYear ?? 2028;

  // Фильтруем задачи по году или диапазону и по этапу строительства
  const filteredTasks = useMemo(() => {
    let filtered = tasks.filter(task => {
      const taskStartYear = task.plannedStart?.getFullYear();
      const taskEndYear = task.plannedEnd?.getFullYear();
      const actualStartYear = task.actualStart?.getFullYear();
      const actualEndYear = task.actualEnd?.getFullYear();
      
      // Если выбран конкретный год
      if (yearFilter !== 'all') {
        const year = parseInt(yearFilter);
        return taskStartYear === year || taskEndYear === year || 
               actualStartYear === year || actualEndYear === year ||
               (taskStartYear && taskEndYear && taskStartYear <= year && taskEndYear >= year);
      }
      
      // Если выбран диапазон (yearFilter === 'all')
      const hasOverlap = (taskStart, taskEnd) => {
        if (!taskStart || !taskEnd) return false;
        return taskEnd >= activeStartYear && taskStart <= activeEndYear;
      };
      
      return hasOverlap(taskStartYear, taskEndYear) || 
             hasOverlap(actualStartYear, actualEndYear) ||
             (taskStartYear >= activeStartYear && taskStartYear <= activeEndYear) ||
             (taskEndYear >= activeStartYear && taskEndYear <= activeEndYear);
    });
    
    // Фильтр по этапу строительства
    if (stageFilter) {
      filtered = filtered.filter(task => task.constructionStage === stageFilter);
    }
    
    return filtered;
  }, [tasks, yearFilter, activeStartYear, activeEndYear, stageFilter]);

  // Временной диапазон
  const timeRange = useMemo(() => {
    let minDate, maxDate;
    
    // Если фильтр по конкретному году активен
    if (yearFilter !== 'all') {
      const year = parseInt(yearFilter);
      // СТРОГО ограничиваем год - не выходим за его пределы
      minDate = new Date(year, 0, 1);
      maxDate = new Date(year, 11, 31);
    } else {
      // Если показываем диапазон годов через слайдеры
      // Всегда используем месяц самой ранней задачи для начала диапазона
      if (earliestDate) {
        minDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
      } else {
        minDate = new Date(activeStartYear, 0, 1);
      }
      
      // Всегда используем месяц самой поздней задачи для конца диапазона
      if (latestDate) {
        maxDate = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0);
      } else {
        maxDate = new Date(activeEndYear, 11, 31);
      }
    }
    
    // Добавляем небольшой запас для лучшей визуализации
    const bufferedMin = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1);
    const bufferedMax = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0);
    
    const finalMin = bufferedMin;
    const finalMax = bufferedMax;
    
    const days = Math.ceil((finalMax - finalMin) / (1000 * 60 * 60 * 24));
    return { start: finalMin, end: finalMax, days };
  }, [yearFilter, activeStartYear, activeEndYear, earliestDate, latestDate]);

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

  // Локальный CPM алгоритм (fallback) - должен быть определён ДО fetchDependencyGraph
  const calculateCPMLocal = useCallback((taskList) => {
    if (taskList.length === 0) return { nodes: [], edges: [], criticalStages: [], criticalTaskIds: [] };

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
        successors: idx < stageOrder.length - 1 ? [idx + 1] : [],
        taskIds: stageTasks.map(t => t.id)
      };
    });

    if (nodes.length === 0) return { nodes: [], edges: [], criticalStages: [], criticalTaskIds: [] };

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

    const criticalStages = nodes.filter(n => n.isCritical).map(n => n.stage);
    const criticalTaskIds = nodes.filter(n => n.isCritical).flatMap(n => n.taskIds || []);

    return { nodes, edges: [], criticalStages, criticalTaskIds };
  }, []);

  // Загрузка зависимостей и расчёт критического пути с сервера
  const fetchDependencyGraph = useCallback(async () => {
    try {
      const response = await client.get('/dependencies/dependency-graph');
      const { nodes, edges, critical_path } = response.data;
      
      setDependencies(edges);
      
      // Преобразуем данные для отображения
      const criticalStages = new Set();
      nodes.forEach(node => {
        if (critical_path.includes(node.id)) {
          criticalStages.add(node.stage);
        }
      });
      
      return {
        nodes,
        edges,
        criticalStages: Array.from(criticalStages),
        criticalTaskIds: critical_path
      };
    } catch (error) {
      console.error('Ошибка загрузки графа зависимостей:', error);
      // Fallback на локальный расчёт
      return calculateCPMLocal(tasksRef.current);
    }
  }, [calculateCPMLocal]);

  // Функция сортировки
  const sortTasks = useCallback((taskList, sortType, stagesList = []) => {
    const sorted = [...taskList];
    switch (sortType) {
      case 'date':
        return sorted.sort((a, b) => a.plannedStart - b.plannedStart);
      case 'date-desc':
        return sorted.sort((a, b) => b.plannedStart - a.plannedStart);
      case 'stage':
        // Сортировка по порядку этапов (order_index)
        return sorted.sort((a, b) => {
          const stageA = stagesList.find(s => s.name === a.constructionStage);
          const stageB = stagesList.find(s => s.name === b.constructionStage);
          const orderA = stageA ? stageA.order_index : 999;
          const orderB = stageB ? stageB.order_index : 999;
          return orderA - orderB;
        });
      case 'type':
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return sorted;
    }
  }, []);

  // Обработка данных
  useEffect(() => {
    if (!schedules || schedules.length === 0) return;

    // БАГ-ФИХ: Не обновляем tasks если идёт перетаскивание или сохранение
    // Это предотвращает потерю изменений при обновлении schedules извне
    if (dragging || resizing || isSyncing) {
      return;
    }

    const processed = schedules
      .filter(s => viewMode === 'all' || s.schedule_type === viewMode)
      .filter(s => s.planned_start_date && s.planned_end_date)
      .map(schedule => {
        const city = cities.find(c => c.id === schedule.city_id);
        const plannedStart = new Date(schedule.planned_start_date);
        const plannedEnd = new Date(schedule.planned_end_date);
        if (isNaN(plannedStart.getTime()) || isNaN(plannedEnd.getTime())) return null;
        return {
          id: schedule.id,
          cityName: city?.name || 'Неизвестный объект',
          constructionStage: schedule.construction_stage || 'Без этапа',
          workName: schedule.work_name || schedule.vacancy || schedule.sections || '',
          type: schedule.schedule_type,
          plannedStart,
          plannedEnd,
          actualStart: schedule.actual_start_date ? new Date(schedule.actual_start_date) : null,
          actualEnd: schedule.actual_end_date ? new Date(schedule.actual_end_date) : null,
          color: typeColors[schedule.schedule_type] || typeColors.construction
        };
      }).filter(Boolean);

    setTasks(sortTasks(processed, sortBy, stages));
  }, [schedules, cities, viewMode, sortBy, sortTasks, dragging, resizing, isSyncing, stages]);

  // Загрузка критического пути при включении режима
  // Используем ref для проверки наличия tasks, чтобы избежать бесконечных вызовов
  useEffect(() => {
    if (showCriticalPath && tasksRef.current.length > 0) {
      fetchDependencyGraph().then(data => {
        setCpmData(data);
      });
    } else if (!showCriticalPath) {
      setCpmData({ nodes: [], edges: [], criticalStages: [], criticalTaskIds: [] });
    }
  }, [showCriticalPath, fetchDependencyGraph]);

  // Позиция плановых дат (для фонового отображения)
  const getPlannedPosition = useCallback((task) => {
    const startOffset = Math.ceil((task.plannedStart - timeRange.start) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((task.plannedEnd - task.plannedStart) / (1000 * 60 * 60 * 24)) + 1;
    return {
      left: startOffset * DAY_WIDTH,
      width: Math.max(duration * DAY_WIDTH, 30)
    };
  }, [timeRange.start, DAY_WIDTH]);

  // Позиция фактических дат (основной бар, который можно двигать)
  const getTaskPosition = useCallback((task) => {
    // Используем фактические даты если есть, иначе плановые
    const start = task.actualStart || task.plannedStart;
    const end = task.actualEnd || task.plannedEnd;
    
    const startOffset = Math.ceil((start - timeRange.start) / (1000 * 60 * 60 * 24));
    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return {
      left: startOffset * DAY_WIDTH,
      width: Math.max(duration * DAY_WIDTH, 30)
    };
  }, [timeRange.start, DAY_WIDTH]);

  // Drag handlers - используем ref для хранения состояния перетаскивания
  const dragStateRef = useRef(null);
  const resizeStateRef = useRef(null);
  const originalTaskRef = useRef(null); // Сохраняем оригинальную задачу
  const tasksRef = useRef(tasks); // Ref для доступа к tasks без пересоздания callback
  
  // Обновляем ref при изменении tasks
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  
  const handleMouseDown = (e, task, action) => {
    if (!onScheduleUpdate) return; // Read-only для директора
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    
    // БАГ-ФИХ: Сохраняем полную копию задачи для отката
    originalTaskRef.current = { ...task };
    
    // Используем фактические даты если есть, иначе плановые
    const currentStart = task.actualStart || task.plannedStart;
    const currentEnd = task.actualEnd || task.plannedEnd;
    
    // Сохраняем timestamp оригинальных дат чтобы избежать мутации
    const originalStartTime = currentStart.getTime();
    const originalEndTime = currentEnd.getTime();
    
    // БАГ-ФИХ: Сохраняем был ли у задачи actualStart/actualEnd до перемещения
    const hadActualDates = !!(task.actualStart && task.actualEnd);
    
    if (action === 'move') {
      const state = { 
        taskId: task.id, 
        startX, 
        originalStartTime,
        originalEndTime,
        hadActualDates,
        lastDaysDelta: 0
      };
      dragStateRef.current = state;
      setDragging(state);
    } else {
      const state = { 
        taskId: task.id, 
        startX, 
        action, 
        originalStartTime,
        originalEndTime,
        hadActualDates,
        lastDaysDelta: 0
      };
      resizeStateRef.current = state;
      setResizing(state);
    }
  };

  const handleMouseMove = useCallback((e) => {
    const dragState = dragStateRef.current;
    const resizeState = resizeStateRef.current;
    
    if (!dragState && !resizeState) return;
    
    const currentX = e.clientX;
    const state = dragState || resizeState;
    
    // Рассчитываем смещение в днях от начала перетаскивания
    const totalDeltaX = currentX - state.startX;
    const daysDelta = Math.round(totalDeltaX / DAY_WIDTH);
    
    // Обновляем только если смещение в днях изменилось
    if (daysDelta === state.lastDaysDelta) return;
    state.lastDaysDelta = daysDelta;

    // Сохраняем данные для обновления
    pendingUpdateRef.current = { dragState, resizeState, daysDelta };
    
    // Используем requestAnimationFrame для плавного обновления
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const pending = pendingUpdateRef.current;
        if (!pending) return;
        
        const { dragState: ds, resizeState: rs, daysDelta: delta } = pending;
        
        if (ds) {
          const newStart = new Date(ds.originalStartTime + delta * 24 * 60 * 60 * 1000);
          const newEnd = new Date(ds.originalEndTime + delta * 24 * 60 * 60 * 1000);
          
          // БАГ-ФИХ: Обновляем ФАКТИЧЕСКИЕ даты (создаём их если не было)
          setTasks(prev => prev.map(t => 
            t.id === ds.taskId ? { 
              ...t, 
              actualStart: newStart, 
              actualEnd: newEnd 
            } : t
          ));
        }
        
        if (rs) {
          if (rs.action === 'resize-end') {
            const newEnd = new Date(rs.originalEndTime + delta * 24 * 60 * 60 * 1000);
            const originalStart = new Date(rs.originalStartTime);
            
            if (newEnd > originalStart) {
              // БАГ-ФИХ: При resize создаём обе даты если их не было
              setTasks(prev => prev.map(t => {
                if (t.id === rs.taskId) {
                  return {
                    ...t,
                    actualStart: t.actualStart || originalStart,
                    actualEnd: newEnd
                  };
                }
                return t;
              }));
            }
          } else {
            const newStart = new Date(rs.originalStartTime + delta * 24 * 60 * 60 * 1000);
            const originalEnd = new Date(rs.originalEndTime);
            
            if (newStart < originalEnd) {
              // БАГ-ФИХ: При resize создаём обе даты если их не было
              setTasks(prev => prev.map(t => {
                if (t.id === rs.taskId) {
                  return {
                    ...t,
                    actualStart: newStart,
                    actualEnd: t.actualEnd || originalEnd
                  };
                }
                return t;
              }));
            }
          }
        }
      });
    }
  }, [DAY_WIDTH]);

  const handleMouseUp = useCallback(() => {
    const dragState = dragStateRef.current;
    const resizeState = resizeStateRef.current;
    const originalTask = originalTaskRef.current;
    
    // Очищаем refs и state СРАЗУ (до сохранения)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingUpdateRef.current = null;
    dragStateRef.current = null;
    resizeStateRef.current = null;
    originalTaskRef.current = null;
    setDragging(null);
    setResizing(null);
    
    // Если не было перетаскивания - выходим
    if (!dragState && !resizeState) return;
    
    const taskId = dragState?.taskId || resizeState?.taskId;
    
    // Используем ref для доступа к текущим tasks (без зависимости в useCallback)
    const currentTasks = tasksRef.current;
    const updated = currentTasks.find(t => t.id === taskId);
    
    // Проверяем что задача существует и даты валидны
    if (!updated || !updated.actualStart || !updated.actualEnd) {
      console.warn('Задача не найдена или даты невалидны');
      return;
    }
    
    // Формируем данные для сохранения
    const saveData = {
      actual_start_date: updated.actualStart.toISOString(),
      actual_end_date: updated.actualEnd.toISOString()
    };
    
    // КРИТИЧЕСКИЙ БАГ-ФИХ: Убираем setTimeout - вызываем сохранение сразу
    // Используем счётчик вместо boolean для поддержки множественных операций
    (async () => {
      // Увеличиваем счётчик активных операций
      setSyncCount(prev => prev + 1);
      
      try {
        if (onScheduleUpdate) {
          // БАГ-ФИХ: Добавляем таймаут для запроса (10 секунд)
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут сохранения')), 10000)
          );
          
          await Promise.race([
            onScheduleUpdate(updated.id, saveData),
            timeoutPromise
          ]);
        }
      } catch (error) {
        console.error('Ошибка сохранения:', error);
        
        // Откатываем изменения при ошибке
        if (originalTask) {
          setTasks(prev => prev.map(t => 
            t.id === taskId ? originalTask : t
          ));
        }
      } finally {
        // БАГ-ФИХ: Уменьшаем счётчик активных операций
        setSyncCount(prev => Math.max(0, prev - 1));
      }
      
      // Обновляем критический путь в фоне (после завершения сохранения)
      if (showCriticalPath) {
        fetchDependencyGraph()
          .then(data => setCpmData(data))
          .catch(err => console.error('Ошибка обновления КП:', err));
      }
    })();
  }, [onScheduleUpdate, showCriticalPath, fetchDependencyGraph]);

  useEffect(() => {
    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        // БАГ-ФИХ: Очищаем все таймеры и анимации при размонтировании
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      };
    }
    
    // КРИТИЧЕСКИЙ БАГ-ФИХ: Сбрасываем счётчик при размонтировании компонента
    return () => {
      setSyncCount(0);
    };
  }, [dragging, resizing, handleMouseMove, handleMouseUp]);

  const isCritical = (task) => {
    if (!showCriticalPath) return false;
    // Проверяем по ID задачи (если есть данные с сервера) или по этапу (fallback)
    if (cpmData.criticalTaskIds && cpmData.criticalTaskIds.length > 0) {
      return cpmData.criticalTaskIds.includes(task.id);
    }
    return cpmData.criticalStages.includes(task.constructionStage);
  };
  
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
    const plannedPos = getPlannedPosition(task);
    const actualPos = getTaskPosition(task);
    const critical = isCritical(task);
    const timing = getTimingInfo(task);
    const stageFloat = getStageFloat(task.constructionStage);
    const isHovered = hoveredTask === task.id;
    
    // Есть ли фактические даты
    const hasActualDates = task.actualStart && task.actualEnd;
    
    // Цвет всегда соответствует отделу
    let bgColor = task.color.bg;
    let borderColor = task.color.border;
    
    if (critical) {
      // Критический путь - оранжевый
      bgColor = '#f97316';
      borderColor = '#c2410c';
    }
    
    // Определяем статус "в срок"
    const isOnTime = hasActualDates && timing.delay === 0 && timing.early === 0;

    // Позиция для отображения (фактические или плановые)
    const pos = hasActualDates ? actualPos : plannedPos;

    return (
      <div
        key={task.id}
        style={{
          position: 'absolute',
          left: Math.min(plannedPos.left, pos.left),
          width: Math.max(plannedPos.left + plannedPos.width, pos.left + pos.width) - Math.min(plannedPos.left, pos.left),
          top: (ROW_HEIGHT - TASK_HEIGHT) / 2,
          height: TASK_HEIGHT,
          opacity: showCriticalPath && !critical ? 0.35 : 1,
          zIndex: isHovered ? 10 : 1
        }}
        onMouseEnter={() => setHoveredTask(task.id)}
        onMouseLeave={() => setHoveredTask(null)}
      >
        {/* Плановые даты - серая полоска в фоне */}
        <div
          style={{
            position: 'absolute',
            left: plannedPos.left - Math.min(plannedPos.left, pos.left),
            width: plannedPos.width,
            height: '100%',
            background: 'repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 4px, #f1f5f9 4px, #f1f5f9 8px)',
            borderRadius: '4px',
            border: '1px dashed #94a3b8',
            opacity: hasActualDates ? 0.6 : 0,
            transition: dragging || resizing ? 'none' : 'opacity 0.3s ease'
          }}
        />
        
        {/* Фактические даты - основной бар */}
        <div
          style={{
            position: 'absolute',
            left: pos.left - Math.min(plannedPos.left, pos.left),
            width: pos.width,
            height: '100%',
            background: `linear-gradient(180deg, ${bgColor} 0%, ${borderColor} 100%)`,
            borderRadius: '4px',
            border: critical ? '2px solid #fff' : `1px solid ${borderColor}`,
            boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
            cursor: onScheduleUpdate ? (dragging || resizing ? 'grabbing' : 'grab') : 'default',
            transition: dragging || resizing ? 'none' : 'box-shadow 0.2s ease, opacity 0.2s ease',
            willChange: dragging || resizing ? 'transform' : 'auto'
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
            {/* Дата начала (фактическая или плановая) */}
            <span style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {formatDateShort(hasActualDates ? task.actualStart : task.plannedStart)}
            </span>
            
            {/* Этап строительства и название */}
            {pos.width > 80 && (
              <div style={{
                flex: 1,
                textAlign: 'center',
                overflow: 'hidden',
                padding: '0 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1px'
              }}>
                {/* Этап строительства - компактный бейдж */}
                <span style={{
                  fontSize: '8px',
                  fontWeight: '700',
                  background: 'rgba(255,255,255,0.25)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  textTransform: 'uppercase',
                  letterSpacing: '0.3px'
                }}>
                  {task.constructionStage}
                </span>
                {/* Название работы (если ширина позволяет) */}
                {pos.width > 160 && task.workName && (
                  <span style={{
                    fontSize: '10px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    opacity: 0.9
                  }}>
                    {hasActualDates ? task.workName : '📋 План'}
                  </span>
                )}
                {/* Только для плана без названия */}
                {pos.width > 160 && !task.workName && !hasActualDates && (
                  <span style={{ fontSize: '10px', opacity: 0.8 }}>📋 План</span>
                )}
              </div>
            )}
            
            {/* Дата окончания (фактическая или плановая) */}
            <span style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '2px 4px', 
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}>
              {formatDateShort(hasActualDates ? task.actualEnd : task.plannedEnd)}
            </span>
          </div>

          {/* Маркер статуса */}
          {hasActualDates && (timing.early > 0 || timing.delay > 0 || timing.earlyStart > 0 || timing.lateStart > 0 || isOnTime) && (
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: '4px'
            }}>
              {isOnTime && (
                <span style={{
                  background: '#8bc49a',
                  color: '#fff',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '2px 6px',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap'
                }}>
                  ✓ В срок
                </span>
              )}
              {timing.early > 0 && (
                <span style={{
                  background: '#7ab5ad',
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
              background: '#8bc49a',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 'bold',
              padding: '1px 5px',
              borderRadius: '8px'
            }}>
              +{stageFloat}д резерв
            </div>
          )}

          {/* Ручки resize - только при редактировании */}
          {onScheduleUpdate && (
            <>
              <div
                style={{
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  width: '8px', 
                  height: '100%',
                  cursor: 'ew-resize', 
                  borderRadius: '4px 0 0 4px',
                  zIndex: 10
                }}
                onMouseDown={(e) => handleMouseDown(e, task, 'resize-start')}
              />
              <div
                style={{
                  position: 'absolute', 
                  right: 0, 
                  top: 0, 
                  width: '8px', 
                  height: '100%',
                  cursor: 'ew-resize', 
                  borderRadius: '0 4px 4px 0',
                  zIndex: 10
                }}
                onMouseDown={(e) => handleMouseDown(e, task, 'resize-end')}
              />
            </>
          )}
        </div>

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
            background: timing.delay > 0 ? '#d4a0a0' : '#8bc49a',
            borderRadius: '2px'
          }} />
        )}

        {/* Tooltip при наведении */}
        {/* Tooltip - показывается снизу чтобы не перекрывать заголовок */}
        {isHovered && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            background: '#1e293b',
            color: '#fff',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            minWidth: '220px'
          }}>
            {/* Этап строительства - выделенный заголовок */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '6px',
              paddingBottom: '6px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{
                background: task.color.bg,
                color: task.color.border,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '700'
              }}>
                {typeNames[task.type]}
              </span>
              <span style={{ fontWeight: '600', color: '#e2e8f0' }}>
                {task.constructionStage}
              </span>
            </div>
            
            {/* Название работы */}
            {task.workName && (
              <div style={{ fontWeight: '500', marginBottom: '6px', color: '#fff' }}>
                📋 {task.workName}
              </div>
            )}
            
            {/* Объект */}
            <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>
              🏙️ {task.cityName}
            </div>
            
            {/* Даты */}
            <div style={{ color: '#94a3b8' }}>
              📅 План: {formatDate(task.plannedStart)} — {formatDate(task.plannedEnd)}
            </div>
            {task.actualStart && (
              <div style={{ color: timing.delay > 0 ? '#fca5a5' : '#86efac', marginTop: '2px' }}>
                ✓ Факт: {formatDate(task.actualStart)} — {task.actualEnd ? formatDate(task.actualEnd) : 'в работе'}
              </div>
            )}
            
            {/* Статусы */}
            {(timing.early > 0 || timing.delay > 0 || timing.earlyStart > 0 || timing.lateStart > 0 || critical) && (
              <div style={{ 
                marginTop: '6px', 
                paddingTop: '6px', 
                borderTop: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                {timing.early > 0 && (
                  <div style={{ color: '#86efac' }}>🎉 Завершено на {timing.early} дн. раньше!</div>
                )}
                {timing.delay > 0 && (
                  <div style={{ color: '#fca5a5' }}>⚠️ Опоздание на {timing.delay} дн.</div>
                )}
                {timing.earlyStart > 0 && (
                  <div style={{ color: '#67e8f9' }}>▶ Начато на {timing.earlyStart} дн. раньше</div>
                )}
                {timing.lateStart > 0 && (
                  <div style={{ color: '#fcd34d' }}>▶ Начато на {timing.lateStart} дн. позже</div>
                )}
                {critical && <div style={{ color: '#fdba74' }}>🔥 Критический путь</div>}
              </div>
            )}
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

          {/* Сортировка */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                fontSize: '13px',
                color: '#1e293b',
                cursor: 'pointer'
              }}
            >
              <option value="date">📅 По дате (сначала ранние)</option>
              <option value="date-desc">📅 По дате (сначала поздние)</option>
              <option value="stage">🏗️ По этапу</option>
              <option value="type">📁 По отделу</option>
              <option value="city">🏙️ По объекту</option>
              <option value="duration">⏱️ По длительности</option>
            </select>
          </div>

          {/* Фильтр по году */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 16px',
            background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#e2e8f0'}`
          }}>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#e2e8f0'}`,
                background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff',
                fontSize: '13px',
                color: isDark ? '#e2e8f0' : '#1e293b',
                cursor: 'pointer',
                minWidth: '120px'
              }}
            >
              <option value="all">📅 Все годы</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

          </div>

          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              background: showCriticalPath ? '#d4a080' : '#7b9eb8',
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

      {/* Панель фильтров - годы и этапы */}
      <div style={{
        display: 'flex',
        gap: '24px',
        marginBottom: '16px',
        padding: '16px 20px',
        background: '#f8fafc',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>

        {/* Слайдер диапазона годов */}
        {yearFilter === 'all' && availableYears.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '6px',
            minWidth: 220
          }}>
            <div style={{ 
              fontSize: 11, 
              fontWeight: 600, 
              color: isDark ? '#94a3b8' : '#64748b', 
              textAlign: 'center' 
            }}>
              {activeStartYear} — {activeEndYear}
            </div>
            
            {/* Начальный год */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ 
                fontSize: 9, 
                color: isDark ? '#64748b' : '#94a3b8', 
                textAlign: 'left' 
              }}>
                Начало: {activeStartYear}
              </label>
              <input
                type="range"
                min={yearRangeLimits.min}
                max={yearRangeLimits.max}
                value={activeStartYear}
                onChange={(e) => {
                  const next = Math.min(parseInt(e.target.value, 10), activeEndYear);
                  setStartYear(next);
                }}
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 999,
                  appearance: 'none',
                  background: `linear-gradient(to right, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'} 0%, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'} ${((activeStartYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} ${((activeStartYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} 100%)`,
                  cursor: 'pointer'
                }}
              />
            </div>
            
            {/* Конечный год */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ 
                fontSize: 9, 
                color: isDark ? '#64748b' : '#94a3b8', 
                textAlign: 'left' 
              }}>
                Конец: {activeEndYear}
              </label>
              <input
                type="range"
                min={yearRangeLimits.min}
                max={yearRangeLimits.max}
                value={activeEndYear}
                onChange={(e) => {
                  const next = Math.max(parseInt(e.target.value, 10), activeStartYear);
                  setEndYear(next);
                }}
                style={{
                  width: '100%',
                  height: 4,
                  borderRadius: 999,
                  appearance: 'none',
                  background: `linear-gradient(to right, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'} 0%, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.3)'} ${((activeEndYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} ${((activeEndYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} 100%)`,
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        )}

        {/* Фильтр по этапу строительства */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '250px' }}>
          <span style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap'
          }}>
            🏗️ Этап:
          </span>
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: stageFilter ? '#eff6ff' : '#fff',
              fontSize: '13px',
              color: '#1e293b',
              cursor: 'pointer',
              flex: 1,
              maxWidth: '350px',
              fontWeight: stageFilter ? '500' : 'normal'
            }}
          >
            <option value="">Все этапы</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.name}>
                {stage.order_index + 1}. {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Счётчик и сброс */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ 
            fontSize: '12px', 
            color: '#64748b',
            background: '#e2e8f0',
            padding: '4px 10px',
            borderRadius: '12px'
          }}>
            Показано: <strong style={{ color: '#1e293b' }}>{filteredTasks.length}</strong> / {tasks.length}
          </span>
          
          {(stageFilter || (startYear !== null && endYear !== null && availableYears.length > 0 && (activeStartYear !== availableYears[0] || activeEndYear !== availableYears[availableYears.length - 1]))) && (
            <button
              onClick={() => {
                setStageFilter('');
                if (availableYears.length > 0) {
                  setStartYear(availableYears[0]);
                  setEndYear(availableYears[availableYears.length - 1]);
                }
              }}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '6px',
                background: '#fee2e2',
                color: '#dc2626',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              ✕ Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Стили для слайдеров */}
      <style>{`
        .year-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          background: #fff;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .year-range-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
          box-shadow: 0 3px 8px rgba(59, 130, 246, 0.4);
        }
        .year-range-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #fff;
          border: 2px solid #3b82f6;
          border-radius: 50%;
          cursor: pointer;
          pointer-events: auto;
          box-shadow: 0 2px 6px rgba(59, 130, 246, 0.3);
        }
        .year-range-slider::-webkit-slider-runnable-track {
          height: 6px;
          background: transparent;
        }
        .year-range-slider::-moz-range-track {
          height: 6px;
          background: transparent;
        }
      `}</style>

      {/* Информация о КП */}
      {showCriticalPath && (cpmData.criticalTaskIds?.length > 0 || cpmData.criticalStages?.length > 0) && (
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
          {cpmData.nodes?.length > 0 && (
            <div>
              <span style={{ color: '#78716c', fontSize: '12px' }}>Длительность: </span>
              <strong>{Math.max(...cpmData.nodes.map(n => n.EF || 0))} дней</strong>
            </div>
          )}
          <div>
            <span style={{ color: '#78716c', fontSize: '12px' }}>Критических задач: </span>
            <strong style={{ color: '#ea580c' }}>
              {cpmData.criticalTaskIds?.length || cpmData.criticalStages?.length || 0}
            </strong>
            <span style={{ color: '#a8a29e' }}> / {filteredTasks.length}</span>
          </div>
          {cpmData.nodes?.length > 0 && (
            <div>
              <span style={{ color: '#78716c', fontSize: '12px' }}>С резервом: </span>
              <strong style={{ color: '#16a34a' }}>{cpmData.nodes.filter(n => n.float > 0).length}</strong>
            </div>
          )}
          <div style={{ 
            marginLeft: 'auto', 
            fontSize: '12px', 
            color: '#78716c',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <a href="/dependency-manager" style={{ color: '#ea580c', textDecoration: 'none' }}>
              🔗 Настроить связи
            </a>
          </div>
        </div>
      )}

      {/* Диаграмма */}
      <div style={{
        display: 'flex',
        background: '#fff',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        position: 'relative'
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
            fontSize: '13px',
            position: 'relative',
            zIndex: 50
          }}>
            Задачи ({filteredTasks.length})
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
                  {/* Этап строительства - всегда показываем */}
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: task.color.border,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{
                      background: task.color.bg,
                      padding: '1px 5px',
                      borderRadius: '4px',
                      fontSize: '9px'
                    }}>
                      {typeNames[task.type]}
                    </span>
                    <span style={{ color: '#64748b' }}>•</span>
                    <span>{task.constructionStage}</span>
                  </div>
                  {/* Название работы */}
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {task.workName || '—'}
                  </div>
                  {/* Даты */}
                  <div style={{
                    fontSize: '9px',
                    color: '#64748b',
                    display: 'flex',
                    gap: '4px',
                    marginTop: '1px'
                  }}>
                    {task.actualStart ? (
                      <span style={{ color: '#8bc49a' }}>
                        ✓ {formatDateShort(task.actualStart)} - {formatDateShort(task.actualEnd || task.plannedEnd)}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>
                        📋 {formatDateShort(task.plannedStart)} - {formatDateShort(task.plannedEnd)}
                      </span>
                    )}
                  </div>
                </div>
                {isCritical(task) && <span style={{ fontSize: '12px' }}>🔥</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Таймлайн */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Заголовок таймлайна */}
          <div 
            ref={timelineHeaderRef}
            onScroll={handleTimelineHeaderScroll}
            style={{
              height: HEADER_HEIGHT,
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              overflowX: 'auto',
              overflowY: 'hidden',
              position: 'relative',
              zIndex: 50
            }}
          >
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

              {/* SVG слой для отрисовки связей */}
              {showCriticalPath && cpmData.edges && cpmData.edges.length > 0 && (
                <svg 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    zIndex: 2
                  }}
                >
                  <defs>
                    {/* Фильтр тени для критических стрелок */}
                    <filter id="arrow-shadow" x="-50%" y="-50%" width="200%" height="200%">
                      <feDropShadow dx="2" dy="2" stdDeviation="2" floodColor="#DC2626" floodOpacity="0.4"/>
                    </filter>
                    {/* Фильтр свечения для критического пути */}
                    <filter id="critical-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    
                    {/* Цвета для типов связей */}
                    {/* FS - Finish-to-Start: синий (обычный) / красный (критический) */}
                    {/* SS - Start-to-Start: зелёный */}
                    {/* FF - Finish-to-Finish: оранжевый */}
                    {/* SF - Start-to-Finish: фиолетовый */}
                    
                    {/* Стрелки для каждого типа связи */}
                    <marker id="arrow-FS" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 10 5 L 0 10 L 3 5 Z" fill="#3B82F6" />
                    </marker>
                    <marker id="arrow-SS" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 10 5 L 0 10 L 3 5 Z" fill="#10B981" />
                    </marker>
                    <marker id="arrow-FF" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 10 5 L 0 10 L 3 5 Z" fill="#F59E0B" />
                    </marker>
                    <marker id="arrow-SF" markerWidth="12" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 10 5 L 0 10 L 3 5 Z" fill="#8B5CF6" />
                    </marker>
                    {/* Критическая стрелка - яркий красный */}
                    <marker id="arrow-critical" markerWidth="14" markerHeight="12" refX="12" refY="6" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M 0 0 L 12 6 L 0 12 L 4 6 Z" fill="#DC2626" />
                    </marker>
                  </defs>
                  {cpmData.edges.map(edge => {
                    const sourceTask = tasks.find(t => t.id === edge.source);
                    const targetTask = tasks.find(t => t.id === edge.target);
                    
                    if (!sourceTask || !targetTask) return null;
                    
                    const sourceIndex = tasks.indexOf(sourceTask);
                    const targetIndex = tasks.indexOf(targetTask);
                    
                    if (sourceIndex === -1 || targetIndex === -1) return null;
                    
                    // Используем фактические даты если есть, иначе плановые
                    const sourceEnd = sourceTask.actualEnd || sourceTask.plannedEnd;
                    const sourceStart = sourceTask.actualStart || sourceTask.plannedStart;
                    const targetStart = targetTask.actualStart || targetTask.plannedStart;
                    const targetEnd = targetTask.actualEnd || targetTask.plannedEnd;
                    
                    // Определяем точки подключения в зависимости от типа связи
                    let sourceX, targetX;
                    const linkType = edge.link_type || 'FS';
                    
                    switch (linkType) {
                      case 'SS': // Start-to-Start
                        sourceX = Math.ceil((sourceStart - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        targetX = Math.ceil((targetStart - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        break;
                      case 'FF': // Finish-to-Finish
                        sourceX = Math.ceil((sourceEnd - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        targetX = Math.ceil((targetEnd - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        break;
                      case 'SF': // Start-to-Finish
                        sourceX = Math.ceil((sourceStart - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        targetX = Math.ceil((targetEnd - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        break;
                      default: // FS - Finish-to-Start
                        sourceX = Math.ceil((sourceEnd - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                        targetX = Math.ceil((targetStart - timeRange.start) / (1000 * 60 * 60 * 24)) * DAY_WIDTH;
                    }
                    
                    const sourceY = sourceIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    const targetY = targetIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                    
                    // Проверка на критический путь
                    const isCriticalLink = cpmData.criticalTaskIds?.includes(edge.source) && 
                                          cpmData.criticalTaskIds?.includes(edge.target);
                    
                    // Цвета для типов связей
                    const linkColors = {
                      FS: { color: '#3B82F6', name: 'Конец → Начало' },
                      SS: { color: '#10B981', name: 'Начало → Начало' },
                      FF: { color: '#F59E0B', name: 'Конец → Конец' },
                      SF: { color: '#8B5CF6', name: 'Начало → Конец' }
                    };
                    
                    const linkColor = isCriticalLink ? '#DC2626' : linkColors[linkType]?.color || '#3B82F6';
                    const arrowId = isCriticalLink ? 'arrow-critical' : `arrow-${linkType}`;
                    
                    // Улучшенное формирование пути
                    const dx = targetX - sourceX;
                    const dy = targetY - sourceY;
                    const isGoingBack = dx < 0;
                    
                    let pathD;
                    const startOffset = linkType === 'SS' || linkType === 'SF' ? -4 : 4;
                    const endOffset = linkType === 'FF' || linkType === 'SF' ? 4 : -14;
                    
                    if (isGoingBack || Math.abs(dx) < 30) {
                      // Если цель левее источника или очень близко - обходим
                      const offsetY = dy >= 0 ? 25 : -25;
                      const bendX = Math.max(sourceX, targetX) + 30;
                      pathD = `M ${sourceX + startOffset} ${sourceY} 
                               L ${bendX} ${sourceY}
                               Q ${bendX + 10} ${sourceY}, ${bendX + 10} ${sourceY + offsetY * 0.5}
                               L ${bendX + 10} ${targetY - offsetY * 0.5}
                               Q ${bendX + 10} ${targetY}, ${bendX} ${targetY}
                               L ${targetX + endOffset} ${targetY}`;
                    } else if (Math.abs(dy) < 5) {
                      // Горизонтальная линия с небольшим изгибом
                      pathD = `M ${sourceX + startOffset} ${sourceY} 
                               C ${sourceX + dx * 0.3} ${sourceY - 15}, 
                                 ${sourceX + dx * 0.7} ${targetY - 15}, 
                                 ${targetX + endOffset} ${targetY}`;
                    } else {
                      // Красивая кривая Безье
                      const ctrlOffset = Math.min(Math.abs(dx) * 0.4, 80);
                      pathD = `M ${sourceX + startOffset} ${sourceY} 
                               C ${sourceX + ctrlOffset} ${sourceY}, 
                                 ${targetX - ctrlOffset} ${targetY}, 
                                 ${targetX + endOffset} ${targetY}`;
                    }
                    
                    return (
                      <g key={edge.id}>
                        {/* Фоновое свечение для критического пути */}
                        {isCriticalLink && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#DC2626"
                            strokeWidth={12}
                            strokeLinecap="round"
                            opacity={0.15}
                          />
                        )}
                        {/* Белая обводка для контраста */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke="white"
                          strokeWidth={isCriticalLink ? 6 : 4}
                          strokeLinecap="round"
                        />
                        {/* Основная линия */}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={linkColor}
                          strokeWidth={isCriticalLink ? 4 : 2.5}
                          strokeLinecap="round"
                          strokeDasharray={linkType !== 'FS' ? '8,4' : 'none'}
                          markerEnd={`url(#${arrowId})`}
                          style={{
                            filter: isCriticalLink ? 'url(#critical-glow)' : 'none'
                          }}
                        />
                        {/* Точка начала связи */}
                        <circle
                          cx={sourceX + startOffset}
                          cy={sourceY}
                          r={isCriticalLink ? 5 : 4}
                          fill={linkColor}
                          stroke="white"
                          strokeWidth={2}
                        />
                        {/* Метка типа связи */}
                        <g>
                          <rect
                            x={(sourceX + targetX) / 2 - 22}
                            y={(sourceY + targetY) / 2 - 11}
                            width={44}
                            height={22}
                            rx={6}
                            fill="white"
                            stroke={linkColor}
                            strokeWidth={isCriticalLink ? 2 : 1.5}
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
                          />
                          <text
                            x={(sourceX + targetX) / 2}
                            y={(sourceY + targetY) / 2 + 5}
                            textAnchor="middle"
                            fontSize="12"
                            fill={linkColor}
                            fontWeight="700"
                          >
                            {linkType}{edge.lag_days > 0 && `+${edge.lag_days}`}
                          </text>
                        </g>
                        {/* Индикатор критического пути */}
                        {isCriticalLink && (
                          <g>
                            <circle
                              cx={(sourceX + targetX) / 2}
                              cy={(sourceY + targetY) / 2 - 18}
                              r={8}
                              fill="#DC2626"
                            />
                            <text
                              x={(sourceX + targetX) / 2}
                              y={(sourceY + targetY) / 2 - 14}
                              textAnchor="middle"
                              fontSize="10"
                              fill="white"
                              fontWeight="700"
                            >
                              !
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

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
                      background: '#c4a08b',
                      zIndex: 5
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: '4px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#c4a08b',
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
              {filteredTasks.map((task, index) => (
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
        padding: '16px',
        background: '#f8fafc',
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        {/* Отделы */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ fontWeight: '600', color: '#475569' }}>Отделы:</span>
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
            <div style={{ 
              width: '20px', height: '10px', borderRadius: '2px', 
              background: 'repeating-linear-gradient(45deg, #e2e8f0, #e2e8f0 2px, #f1f5f9 2px, #f1f5f9 4px)',
              border: '1px dashed #94a3b8'
            }} />
            <span style={{ color: '#64748b' }}>План (фон)</span>
          </div>
        </div>
        
        {/* Типы связей */}
        {showCriticalPath && (
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            flexWrap: 'wrap', 
            paddingTop: '12px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <span style={{ fontWeight: '600', color: '#475569' }}>Связи задач:</span>
            
            {/* Критический путь */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '4px 10px',
              background: '#FEE2E2',
              borderRadius: '6px',
              border: '1px solid #DC2626'
            }}>
              <svg width="28" height="12" viewBox="0 0 28 12">
                <circle cx="4" cy="6" r="3" fill="#DC2626" stroke="white" strokeWidth="1"/>
                <path d="M 7 6 Q 14 2, 20 6" stroke="#DC2626" strokeWidth="3" fill="none"/>
                <path d="M 18 3 L 24 6 L 18 9 L 20 6 Z" fill="#DC2626"/>
              </svg>
              <span style={{ color: '#DC2626', fontWeight: '600' }}>🔥 КРИТИЧЕСКИЙ ПУТЬ</span>
            </div>
            
            {/* FS - Finish to Start */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="28" height="12" viewBox="0 0 28 12">
                <circle cx="4" cy="6" r="2.5" fill="#3B82F6" stroke="white" strokeWidth="1"/>
                <path d="M 6 6 Q 14 3, 20 6" stroke="#3B82F6" strokeWidth="2" fill="none"/>
                <path d="M 18 3 L 24 6 L 18 9 L 20 6 Z" fill="#3B82F6"/>
              </svg>
              <span style={{ color: '#3B82F6', fontWeight: '600' }}>FS</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Конец→Начало</span>
            </div>
            
            {/* SS - Start to Start */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="28" height="12" viewBox="0 0 28 12">
                <circle cx="4" cy="6" r="2.5" fill="#10B981" stroke="white" strokeWidth="1"/>
                <path d="M 6 6 Q 14 3, 20 6" stroke="#10B981" strokeWidth="2" fill="none" strokeDasharray="4,2"/>
                <path d="M 18 3 L 24 6 L 18 9 L 20 6 Z" fill="#10B981"/>
              </svg>
              <span style={{ color: '#10B981', fontWeight: '600' }}>SS</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Начало→Начало</span>
            </div>
            
            {/* FF - Finish to Finish */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="28" height="12" viewBox="0 0 28 12">
                <circle cx="4" cy="6" r="2.5" fill="#F59E0B" stroke="white" strokeWidth="1"/>
                <path d="M 6 6 Q 14 3, 20 6" stroke="#F59E0B" strokeWidth="2" fill="none" strokeDasharray="4,2"/>
                <path d="M 18 3 L 24 6 L 18 9 L 20 6 Z" fill="#F59E0B"/>
              </svg>
              <span style={{ color: '#F59E0B', fontWeight: '600' }}>FF</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Конец→Конец</span>
            </div>
            
            {/* SF - Start to Finish */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="28" height="12" viewBox="0 0 28 12">
                <circle cx="4" cy="6" r="2.5" fill="#8B5CF6" stroke="white" strokeWidth="1"/>
                <path d="M 6 6 Q 14 3, 20 6" stroke="#8B5CF6" strokeWidth="2" fill="none" strokeDasharray="4,2"/>
                <path d="M 18 3 L 24 6 L 18 9 L 20 6 Z" fill="#8B5CF6"/>
              </svg>
              <span style={{ color: '#8B5CF6', fontWeight: '600' }}>SF</span>
              <span style={{ color: '#64748b', fontSize: '11px' }}>Начало→Конец</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ 
        marginTop: '12px', 
        padding: '10px 14px',
        fontSize: '12px', 
        color: '#64748b',
        background: '#f1f5f9',
        borderRadius: '6px',
        borderLeft: '4px solid #3B82F6',
        position: 'relative'
      }}>
        💡 <strong>Подсказка:</strong> Перетаскивайте бары для изменения фактических дат. 
        Штриховка — плановые даты. Стрелки показывают зависимости между задачами. 
        <span style={{ color: '#DC2626', fontWeight: '600' }}>Красные связи</span> — критический путь проекта.
        
        {/* Ненавязчивый индикатор синхронизации */}
        {isSyncing && (
          <div style={{
            position: 'absolute',
            top: '50%',
            right: '14px',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '20px',
            fontSize: '11px',
            color: '#3B82F6',
            fontWeight: '600',
            animation: 'fadeIn 0.2s ease-in'
          }}>
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #3B82F6',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            Сохранение...
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-50%) scale(0.9); }
          to { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ModernGanttChart;
