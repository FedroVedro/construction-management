import React, { useEffect, useState, useRef, useCallback } from 'react';

const CalendarGanttChart = ({ schedules, cities, selectedView = null }) => {
  // Состояния
  const [tableDimensions, setTableDimensions] = useState({ width: 0, height: 0 });
  const svgRef = useRef(null);
  const [processedData, setProcessedData] = useState([]);
  const [decades, setDecades] = useState([]);
  const [viewMode, setViewMode] = useState(selectedView || 'all');
  const [sortBy, setSortBy] = useState('startDate');
  const [showCriticalPath, setShowCriticalPath] = useState(false);
  const [criticalPathData, setCriticalPathData] = useState([]);
  const [delayInfo, setDelayInfo] = useState(null);
  const tableRef = useRef(null);
  const [arrowPaths, setArrowPaths] = useState([]);

  // Критические этапы
  const criticalStages = [
    'Подготовительные работы',
    'Разработка котлована', 
    'Устройство бетонной подготовки и монолитных фундаментных плит',
    'Фундамент',
    'Вертикальная оклеечная гидроизоляция стен подвала и монолитной плиты',
    'Монтаж сборных ж/б конструкций',
    'Перебазировка и монтаж башенных кранов',
    'Каменная кладка',
    'Устройство кровли',
    'Монтаж оконных конструкций',
    'Штукатурные работы',
    'Устройство стяжки пола',
    'Отделочные работы',
    'Монтаж дверей',
    'Монтаж лифтового оборудования',
    'Пуск тепла',
    'Получение ЗОС и РНВ'
  ];

  // Названия отделов для разных типов
  const typeNames = {
    document: 'Выдача документации',
    hr: 'HR',
    procurement: 'Закупки',
    construction: 'Строительство'
  };

  // Цвета для разных типов отделов
  const typeColors = {
    document: '#6B9BD1',
    hr: '#6BC788', 
    procurement: '#D4A76A',
    construction: '#D97B7B'
  };

  // Функции-хелперы
  const getDecadeName = (decade) => {
    switch(decade) {
      case 1: return 'I';
      case 2: return 'II';
      case 3: return 'III';
      default: return '';
    }
  };

  const isPeriodInDecade = (startDate, endDate, year, month, decade) => {
    let decadeStart, decadeEnd;
    
    if (decade === 1) {
      decadeStart = new Date(year, month, 1);
      decadeEnd = new Date(year, month, 10);
    } else if (decade === 2) {
      decadeStart = new Date(year, month, 11);
      decadeEnd = new Date(year, month, 20);
    } else {
      decadeStart = new Date(year, month, 21);
      decadeEnd = new Date(year, month + 1, 0);
    }
    
    return startDate <= decadeEnd && endDate >= decadeStart;
  };

  const getCellContent = (task, year, month, decade) => {
    let backgroundColor = 'transparent';
    let content = '';
    let opacity = 1;
    
    // Если включен режим критического пути
    if (showCriticalPath) {
      const isCritical = criticalStages.includes(task.constructionStage);
      opacity = isCritical ? 1 : 0.3;
      
      if (isCritical && isPeriodInDecade(task.plannedStart, task.plannedEnd, year, month, decade)) {
        // Проверяем задержку
        const hasDelay = task.actualEnd && task.actualEnd > task.plannedEnd;
        backgroundColor = hasDelay ? '#ff6b6b' : task.color;
      } else if (isPeriodInDecade(task.plannedStart, task.plannedEnd, year, month, decade)) {
        backgroundColor = task.color;
      }
    } else {
      // Обычный режим
      if (isPeriodInDecade(task.plannedStart, task.plannedEnd, year, month, decade)) {
        backgroundColor = task.color;
      }
    }
    
    // Проверяем фактические даты
    if (task.actualStart) {
      if (task.actualEnd) {
        if (isPeriodInDecade(task.actualStart, task.actualEnd, year, month, decade)) {
          content = 'Ф';
        }
      } else {
        const decadeStart = new Date(year, month, decade === 1 ? 1 : decade === 2 ? 11 : 21);
        if (task.actualStart <= decadeStart) {
          content = 'Ф';
        }
      }
    }
    
    return { backgroundColor, content, opacity };
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  const formatPrice = (value) => {
    if (!value || value === '') return '-';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    return num.toLocaleString('ru-RU') + ' руб';
  };

  const isCriticalStage = (stageName) => {
    return criticalStages.includes(stageName);
  };

  // Функции с useCallback
  const updateTableDimensions = useCallback(() => {
    if (tableRef.current) {
      const table = tableRef.current;
      setTableDimensions({
        width: table.scrollWidth,
        height: table.scrollHeight
      });
    }
  }, []);

  const calculateArrows = useCallback(() => {
    if (!showCriticalPath || !tableRef.current || criticalPathData.length < 2) {
      setArrowPaths([]);
      return;
    }

    const paths = [];
    const table = tableRef.current;
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    
    // Находим позиции критических этапов
    const positions = [];
    criticalPathData.forEach(stage => {
      const rowIndex = processedData.findIndex(d => d.id === stage.id);
      if (rowIndex >= 0 && rows[rowIndex]) {
        const row = rows[rowIndex];
        
        // Находим центр периода работ
        let startDecade = null;
        let endDecade = null;
        
        decades.forEach((decade, idx) => {
          if (isPeriodInDecade(stage.plannedStart, stage.plannedEnd, decade.year, decade.month, decade.decade)) {
            if (startDecade === null) startDecade = idx;
            endDecade = idx;
          }
        });
        
        if (startDecade !== null && endDecade !== null) {
          const cells = row.querySelectorAll('td');
          const startCell = cells[8 + startDecade]; // 8 - количество информационных колонок
          const endCell = cells[8 + endDecade];
          
          if (startCell && endCell) {
            // Используем offsetLeft/offsetTop для позиций относительно таблицы
            const rowOffsetTop = row.offsetTop;
            const startCellOffsetLeft = startCell.offsetLeft;
            const endCellOffsetLeft = endCell.offsetLeft + endCell.offsetWidth;
            
            positions.push({
              stage: stage.constructionStage,
              x: (startCellOffsetLeft + endCellOffsetLeft) / 2,
              y: rowOffsetTop + row.offsetHeight / 2,
              delay: stage.actualEnd && stage.plannedEnd ? 
                Math.floor((stage.actualEnd - stage.plannedEnd) / (1000 * 60 * 60 * 24)) : 0
            });
          }
        }
      }
    });

    // Создаем пути для стрелок
    for (let i = 0; i < positions.length - 1; i++) {
      const start = positions[i];
      const end = positions[i + 1];
      
      if (start && end) {
        // Кривая Безье для плавной стрелки
        const controlX = (start.x + end.x) / 2;
        const controlY1 = start.y + 50;
        const controlY2 = end.y - 50;
        
        paths.push({
          d: `M ${start.x} ${start.y} C ${controlX} ${controlY1}, ${controlX} ${controlY2}, ${end.x} ${end.y}`,
          delay: start.delay > 0,
          fromStage: start.stage,
          toStage: end.stage
        });
      }
    }
    
    setArrowPaths(paths);
  }, [showCriticalPath, criticalPathData, processedData, decades, isPeriodInDecade]);

  // useEffect для анализа критического пути
  useEffect(() => {
    if (showCriticalPath && processedData.length > 0) {
      const criticalData = processedData.filter(item => 
        criticalStages.includes(item.constructionStage)
      );

      // Сортируем по порядку критических этапов
      const sortedCriticalData = criticalData.sort((a, b) => {
        const indexA = criticalStages.indexOf(a.constructionStage);
        const indexB = criticalStages.indexOf(b.constructionStage);
        return indexA - indexB;
      });

      setCriticalPathData(sortedCriticalData);

      // Анализируем задержки
      let maxDelay = 0;
      let delayingStage = null;
      let cumulativeDelay = 0;

      sortedCriticalData.forEach((stage, index) => {
        if (stage.actualEnd && stage.plannedEnd) {
          const delay = Math.floor((stage.actualEnd - stage.plannedEnd) / (1000 * 60 * 60 * 24));
          if (delay > 0) {
            cumulativeDelay += delay;
            if (delay > maxDelay) {
              maxDelay = delay;
              delayingStage = stage;
            }
          }
        }
      });

      if (delayingStage) {
        setDelayInfo({
          stage: delayingStage,
          delay: maxDelay,
          totalDelay: cumulativeDelay
        });
      } else {
        setDelayInfo(null);
      }
    }
  }, [showCriticalPath, processedData]);

  // useEffect для обновления стрелок
  useEffect(() => {
    if (showCriticalPath) {
      // Небольшая задержка для того, чтобы таблица успела отрендериться
      setTimeout(() => {
        updateTableDimensions();
        calculateArrows();
      }, 100);
    }
  }, [showCriticalPath, criticalPathData, decades, processedData, updateTableDimensions, calculateArrows]);

  // useEffect для обработки данных
  useEffect(() => {
    if (schedules.length === 0) return;

    // Найти минимальную и максимальную даты
    let minDate = new Date();
    let maxDate = new Date();
    
    schedules.forEach(schedule => {
      const plannedStart = new Date(schedule.planned_start_date);
      const plannedEnd = new Date(schedule.planned_end_date);
      
      if (plannedStart < minDate) minDate = plannedStart;
      if (plannedEnd > maxDate) maxDate = plannedEnd;
      
      if (schedule.actual_start_date) {
        const actualStart = new Date(schedule.actual_start_date);
        if (actualStart < minDate) minDate = actualStart;
      }
      
      if (schedule.actual_end_date) {
        const actualEnd = new Date(schedule.actual_end_date);
        if (actualEnd > maxDate) maxDate = actualEnd;
      }
    });

    // Добавить буфер в 1 месяц с каждой стороны
    minDate.setMonth(minDate.getMonth() - 1);
    maxDate.setMonth(maxDate.getMonth() + 1);

    // Создать массив декад
    const decadesArray = [];
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    
    while (current <= maxDate) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthName = current.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      
      for (let decade = 1; decade <= 3; decade++) {
        decadesArray.push({
          year,
          month,
          decade,
          monthName,
          key: `${year}-${month}-${decade}`
        });
      }
      
      current.setMonth(current.getMonth() + 1);
    }
    
    setDecades(decadesArray);

    // Обработать данные для отображения
    const processed = schedules
      .filter(s => viewMode === 'all' || s.schedule_type === viewMode)
      .map(schedule => {
        const cityName = cities.find(c => c.id === schedule.city_id)?.name || 'Неизвестный объект';
        
        let workName = '';
        if (schedule.schedule_type === 'document') {
          workName = schedule.sections || '';
        } else if (schedule.schedule_type === 'hr') {
          workName = schedule.vacancy || '';
        } else if (schedule.schedule_type === 'procurement') {
          workName = schedule.work_name || '';
        } else if (schedule.schedule_type === 'construction') {
          workName = schedule.work_name || '';
        }
        
        return {
          id: schedule.id,
          cityName: cityName,
          constructionStage: schedule.construction_stage,
          workName: workName,
          department: typeNames[schedule.schedule_type],
          type: schedule.schedule_type,
          plannedStart: new Date(schedule.planned_start_date),
          plannedEnd: new Date(schedule.planned_end_date),
          actualStart: schedule.actual_start_date ? new Date(schedule.actual_start_date) : null,
          actualEnd: schedule.actual_end_date ? new Date(schedule.actual_end_date) : null,
          costPlan: schedule.cost_plan,
          costFact: schedule.cost_fact,
          color: typeColors[schedule.schedule_type] || '#95a5a6'
        };
      });
    
    // Применяем сортировку
    const sorted = [...processed].sort((a, b) => {
      switch (sortBy) {
        case 'city':
          return a.cityName.localeCompare(b.cityName);
        case 'stage':
          return a.constructionStage.localeCompare(b.constructionStage);
        case 'department':
          return a.department.localeCompare(b.department);
        case 'startDate':
          return a.plannedStart - b.plannedStart;
        case 'endDate':
          return a.plannedEnd - b.plannedEnd;
        case 'actualStartDate':
          if (!a.actualStart && !b.actualStart) return 0;
          if (!a.actualStart) return 1;
          if (!b.actualStart) return -1;
          return a.actualStart - b.actualStart;
        case 'actualEndDate':
          if (!a.actualEnd && !b.actualEnd) return 0;
          if (!a.actualEnd) return 1;
          if (!b.actualEnd) return -1;
          return a.actualEnd - b.actualEnd;
        default:
          return a.plannedStart - b.plannedStart;
      }
    });
    
    setProcessedData(sorted);
  }, [schedules, cities, viewMode, sortBy]);

  // useEffect для ResizeObserver
  useEffect(() => {
    updateTableDimensions();
      
    const resizeObserver = new ResizeObserver(() => {
      updateTableDimensions();
    });
      
    if (tableRef.current) {
      resizeObserver.observe(tableRef.current);
    }
      
    return () => {
      if (tableRef.current) {
        resizeObserver.unobserve(tableRef.current);
      }
    };
  }, [processedData, decades, updateTableDimensions]);

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>Календарный график работ (по декадам)</h2>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
          {!selectedView && (
            <div>
              <label style={{ marginRight: '10px' }}>Показать:</label>
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value)}
                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">Все отделы</option>
                <option value="document">Выдача документации</option>
                <option value="hr">HR</option>
                <option value="procurement">Закупки</option>
                <option value="construction">Строительство</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ marginRight: '10px' }}>Сортировать по:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="startDate">Дате начала (план)</option>
              <option value="endDate">Дате окончания (план)</option>
              <option value="actualStartDate">Дате начала (факт)</option>
              <option value="actualEndDate">Дате окончания (факт)</option>
              <option value="city">Объекту строительства</option>
              <option value="stage">Этапу строительства</option>
              <option value="department">Отделу</option>
            </select>
          </div>

          {/* Кнопка критического пути */}
          <button
            onClick={() => setShowCriticalPath(!showCriticalPath)}
            style={{
              padding: '8px 20px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: showCriticalPath ? '#ff6b6b' : '#007bff',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: 'bold',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              transition: 'all 0.3s'
            }}
          >
            <span style={{ fontSize: '20px' }}>⚡</span>
            {showCriticalPath ? 'Скрыть критический путь' : 'Показать критический путь'}
          </button>
        </div>

        {/* Информация о задержках */}
        {showCriticalPath && delayInfo && (
          <div style={{
            marginTop: '15px',
            padding: '15px',
            backgroundColor: '#ffe0e0',
            borderRadius: '8px',
            border: '2px solid #ff6b6b',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 'bold', color: '#d32f2f' }}>
                Критическая задержка обнаружена!
              </div>
              <div style={{ marginTop: '5px' }}>
                Этап "<strong>{delayInfo.stage.constructionStage}</strong>" задерживается на <strong>{delayInfo.delay} дней</strong>.
                {delayInfo.totalDelay > delayInfo.delay && (
                  <span> Общая накопленная задержка: <strong>{delayInfo.totalDelay} дней</strong>.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Легенда */}
        <div style={{ marginTop: '15px' }}>
          <h4>Отделы:</h4>
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
            {Object.entries(typeColors).map(([type, color]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ 
                  width: '30px', 
                  height: '20px', 
                  backgroundColor: color,
                  border: '1px solid #ddd' 
                }}></div>
                <span>{typeNames[type]} (план)</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ 
                width: '30px', 
                height: '20px', 
                backgroundColor: '#f8f9fa',
                border: '1px solid #ddd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>Ф</div>
              <span>Фактическое выполнение</span>
            </div>
            {showCriticalPath && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ 
                    width: '30px', 
                    height: '20px', 
                    backgroundColor: '#ff6b6b',
                    border: '1px solid #ddd'
                  }}></div>
                  <span>Критический путь с задержкой</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ color: '#ff6b6b', fontSize: '24px' }}>→</span>
                  <span>Связь критических этапов</span>
                </div>
              </>
            )}
          </div>
          <div style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
            I - первая декада (1-10), II - вторая декада (11-20), III - третья декада (21-конец месяца)
          </div>
        </div>
      </div>

      {/* Таблица с календарной сеткой */}
      <div style={{ position: 'relative', overflowX: 'auto', overflowY: 'visible' }}>
        {/* SVG для стрелок */}
        {showCriticalPath && arrowPaths.length > 0 && (
          <svg 
            ref={svgRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: tableDimensions.width || '100%',
              height: tableDimensions.height || '100%',
              pointerEvents: 'none',
              zIndex: 5,
              overflow: 'visible'
            }}
            viewBox={`0 0 ${tableDimensions.width} ${tableDimensions.height}`}
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#ff6b6b"
                />
              </marker>
              <marker
                id="arrowhead-normal"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 10 3.5, 0 7"
                  fill="#4CAF50"
                />
              </marker>
            </defs>
            {arrowPaths.map((path, index) => (
              <g key={index}>
                <path
                  d={path.d}
                  stroke={path.delay ? '#ff6b6b' : '#4CAF50'}
                  strokeWidth="3"
                  fill="none"
                  markerEnd={path.delay ? 'url(#arrowhead)' : 'url(#arrowhead-normal)'}
                  style={{
                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                  }}
                />
                {/* Добавляем анимацию для задержанных путей */}
                {path.delay && (
                  <circle r="4" fill="#ff6b6b">
                    <animateMotion dur="2s" repeatCount="indefinite">
                      <mpath href={`#path-${index}`} />
                    </animateMotion>
                  </circle>
                )}
                <path
                  id={`path-${index}`}
                  d={path.d}
                  stroke="none"
                  fill="none"
                />
              </g>
            ))}
          </svg>
        )}

        <table 
          ref={tableRef}
          style={{ 
            borderCollapse: 'collapse', 
            fontSize: '12px',
            minWidth: '100%',
            tableLayout: 'fixed',
            position: 'relative'
          }}
        >
          <thead>
            {/* Строка с месяцами */}
            <tr>
              <th colSpan="10" style={{ 
                border: '1px solid #ddd', 
                padding: '8px',
                backgroundColor: '#f8f9fa',
                zIndex: 4,
                boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
                whiteSpace: 'nowrap'
              }}>
                Информация о работах
              </th>
              {decades.reduce((acc, decade, index) => {
                if (index === 0 || decade.month !== decades[index - 1].month) {
                  const monthDecades = decades.filter(d => 
                    d.year === decade.year && d.month === decade.month
                  );
                  acc.push({
                    monthName: decade.monthName,
                    colspan: monthDecades.length
                  });
                }
                return acc;
              }, []).map((month, idx) => (
                <th 
                  key={idx} 
                  colSpan={month.colspan}
                  style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center'
                  }}
                >
                  {month.monthName}
                </th>
              ))}
            </tr>
            {/* Строка с заголовками колонок и декадами */}
            <tr>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                position: 'sticky',
                left: 0,
                zIndex: 3,
                minWidth: '150px'
              }}>Объект</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                position: 'sticky',
                left: '150px',
                zIndex: 3,
                minWidth: '150px'
              }}>
                Этап строительства
                {showCriticalPath && <span style={{ color: '#ff6b6b', marginLeft: '5px' }}>⚡</span>}
              </th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                position: 'sticky',
                left: '300px',
                zIndex: 3,
                minWidth: '200px'
              }}>Наименование работ</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '100px'
              }}>Отдел</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '90px'
              }}>План начало</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '90px'
              }}>План конец</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '90px'
              }}>Факт начало</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '90px'
              }}>Факт конец</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '120px'
              }}>Стоимость план</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '120px'
              }}>Стоимость факт</th>
              {decades.map(decade => (
                <th 
                  key={decade.key}
                  style={{ 
                    border: '1px solid #ddd', 
                    padding: '2px',
                    backgroundColor: '#f8f9fa',
                    width: '40px',
                    minWidth: '20px',
                    maxWidth: '20px',
                    fontSize: '11px',
                    textAlign: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {getDecadeName(decade.decade)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map(task => {
              const isCritical = showCriticalPath && isCriticalStage(task.constructionStage);
              const rowOpacity = showCriticalPath ? (isCritical ? 1 : 0.3) : 1;
              const hasDelay = task.actualEnd && task.plannedEnd && task.actualEnd > task.plannedEnd;
              
              return (
                <tr 
                  key={task.id}
                  style={{
                    opacity: rowOpacity,
                    backgroundColor: isCritical && hasDelay ? '#ffe0e0' : 'transparent',
                    transition: 'opacity 0.3s'
                  }}
                >
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    position: 'sticky',
                    left: 0,
                    zIndex: 2
                  }}>
                    {task.cityName}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    position: 'sticky',
                    left: '150px',
                    zIndex: 2,
                    fontWeight: isCritical ? 'bold' : 'normal'
                  }}>
                    {isCritical && <span style={{ color: '#ff6b6b', marginRight: '5px' }}>⚡</span>}
                    {task.constructionStage}
                    {isCritical && hasDelay && (
                      <span style={{ 
                        color: '#ff6b6b', 
                        fontSize: '10px', 
                        marginLeft: '5px',
                        fontWeight: 'bold'
                      }}>
                        (+{Math.floor((task.actualEnd - task.plannedEnd) / (1000 * 60 * 60 * 24))}д)
                      </span>
                    )}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    position: 'sticky',
                    left: '300px',
                    zIndex: 2,
                    whiteSpace: 'pre-wrap',
                    maxWidth: '200px'
                  }}>
                    {task.workName}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontWeight: 'bold'
                  }}>
                    {task.department}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px'
                  }}>
                    {formatDate(task.plannedStart)}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px'
                  }}>
                    {formatDate(task.plannedEnd)}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px',
                    color: hasDelay ? '#ff6b6b' : 'inherit',
                    fontWeight: hasDelay ? 'bold' : 'normal'
                  }}>
                    {task.actualStart ? formatDate(task.actualStart) : '-'}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px',
                    color: hasDelay ? '#ff6b6b' : 'inherit',
                    fontWeight: hasDelay ? 'bold' : 'normal'
                  }}>
                    {task.actualEnd ? formatDate(task.actualEnd) : '-'}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px',
                    textAlign: 'right'
                  }}>
                    {formatPrice(task.costPlan)}
                  </td>
                  <td style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: 'white',
                    fontSize: '11px',
                    textAlign: 'right'
                  }}>
                    {formatPrice(task.costFact)}
                  </td>
                  {decades.map(decade => {
                    const cell = getCellContent(task, decade.year, decade.month, decade.decade);
                    return (
                      <td 
                        key={decade.key}
                        style={{ 
                          border: '1px solid #ddd',
                          backgroundColor: cell.backgroundColor,
                          width: '40px',
                          minWidth: '20px',
                          maxWidth: '20px',
                          height: '30px',
                          padding: '0',
                          textAlign: 'center',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#000',
                          overflow: 'hidden',
                          position: 'relative',
                          opacity: cell.opacity
                        }}
                      >
                        {cell.content}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {processedData.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6c757d' 
        }}>
          Нет данных для отображения
        </div>
      )}
    </div>
  );
};

export default CalendarGanttChart;