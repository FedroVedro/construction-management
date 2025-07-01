import React, { useEffect, useState } from 'react';

const CalendarGanttChart = ({ schedules, cities, selectedView = null }) => {
  const [processedData, setProcessedData] = useState([]);
  const [months, setMonths] = useState([]);
  const [viewMode, setViewMode] = useState(selectedView || 'all');
  const [sortBy, setSortBy] = useState('default'); // default, city, stage, department, startDate

  // Названия отделов для разных типов
  const typeNames = {
    document: 'Документация',
    hr: 'HR',
    procurement: 'Закупки',
    construction: 'Строительство'
  };

  // Цвета для разных типов отделов
  const typeColors = {
    document: '#3498db',
    hr: '#2ecc71', 
    procurement: '#f39c12',
    construction: '#e74c3c'
  };

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

    // Создать массив месяцев
    const monthsArray = [];
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    
    while (current <= maxDate) {
      monthsArray.push({
        year: current.getFullYear(),
        month: current.getMonth(),
        name: current.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
        days: new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
      });
      current.setMonth(current.getMonth() + 1);
    }
    
    setMonths(monthsArray);

    // Обработать данные для отображения
    const processed = schedules
      .filter(s => viewMode === 'all' || s.schedule_type === viewMode)
      .map(schedule => {
        const cityName = cities.find(c => c.id === schedule.city_id)?.name || 'Неизвестный объект';
        
        // Получаем наименование работ в зависимости от типа
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
        default:
          return 0;
      }
    });
    
    setProcessedData(sorted);
  }, [schedules, cities, viewMode, sortBy]);

  const getDayKey = (year, month, day) => `${year}-${month}-${day}`;

  const isDateInRange = (date, start, end) => {
    return date >= start && date <= end;
  };

  const getCellContent = (task, year, month, day) => {
    const currentDate = new Date(year, month, day);
    const dayKey = getDayKey(year, month, day);
    
    let content = null;
    let backgroundColor = 'transparent';
    let isActual = false;

    // Проверяем плановые даты
    if (isDateInRange(currentDate, task.plannedStart, task.plannedEnd)) {
      backgroundColor = task.color + '40'; // Прозрачность 40%
    }

    // Проверяем фактические даты
    if (task.actualStart && task.actualEnd && isDateInRange(currentDate, task.actualStart, task.actualEnd)) {
      backgroundColor = task.color;
      isActual = true;
    } else if (task.actualStart && !task.actualEnd && currentDate >= task.actualStart) {
      // Если есть только дата начала
      backgroundColor = task.color + '80'; // Прозрачность 80%
      isActual = true;
    }

    return {
      backgroundColor,
      content: isActual ? 'Ф' : ''
    };
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('ru-RU', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2>Календарный график работ</h2>
        
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '10px' }}>
          {/* Фильтр по типам */}
          {!selectedView && (
            <div>
              <label style={{ marginRight: '10px' }}>Показать:</label>
              <select 
                value={viewMode} 
                onChange={(e) => setViewMode(e.target.value)}
                style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option value="all">Все отделы</option>
                <option value="document">Документация</option>
                <option value="hr">HR</option>
                <option value="procurement">Закупки</option>
                <option value="construction">Строительство</option>
              </select>
            </div>
          )}

          {/* Сортировка */}
          <div>
            <label style={{ marginRight: '10px' }}>Сортировать по:</label>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ddd' }}
            >
              <option value="default">По умолчанию</option>
              <option value="city">Объекту строительства</option>
              <option value="stage">Этапу строительства</option>
              <option value="department">Отделу</option>
              <option value="startDate">Дате начала</option>
            </select>
          </div>
        </div>

        {/* Легенда */}
        <div style={{ marginTop: '15px', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ 
              width: '20px', 
              height: '20px', 
              backgroundColor: '#ccc',
              border: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 'bold'
            }}>Ф</div>
            <span>Фактическое выполнение</span>
          </div>
          <div style={{ marginLeft: '20px', fontStyle: 'italic', color: '#666' }}>
            Светлые ячейки - плановые даты, яркие ячейки - фактические даты
          </div>
        </div>
      </div>

      {/* Таблица с календарной сеткой */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          borderCollapse: 'collapse', 
          fontSize: '12px',
          minWidth: '100%'
        }}>
          <thead>
            {/* Строка с месяцами */}
            <tr>
              <th colSpan="7" style={{ 
                border: '1px solid #ddd', 
                padding: '8px',
                backgroundColor: '#f8f9fa',
                position: 'sticky',
                left: 0,
                zIndex: 3
              }}>
                Информация о работах
              </th>
              {months.map((month, idx) => (
                <th 
                  key={idx} 
                  colSpan={month.days}
                  style={{ 
                    border: '1px solid #ddd', 
                    padding: '4px',
                    backgroundColor: '#f8f9fa',
                    textAlign: 'center'
                  }}
                >
                  {month.name}
                </th>
              ))}
            </tr>
            {/* Строка с заголовками колонок и днями */}
            <tr>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                position: 'sticky',
                left: 0,
                zIndex: 2,
                minWidth: '150px'
              }}>Объект</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                minWidth: '150px'
              }}>Этап строительства</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
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
              {months.map(month => 
                Array.from({ length: month.days }, (_, i) => i + 1).map(day => (
                  <th 
                    key={`${month.year}-${month.month}-${day}`}
                    style={{ 
                      border: '1px solid #ddd', 
                      padding: '2px',
                      backgroundColor: '#f8f9fa',
                      width: '25px',
                      fontSize: '10px',
                      textAlign: 'center'
                    }}
                  >
                    {day}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {processedData.map(task => (
              <tr key={task.id}>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '4px',
                  backgroundColor: 'white',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1
                }}>
                  {task.cityName}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '4px',
                  backgroundColor: 'white'
                }}>
                  {task.constructionStage}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '4px',
                  backgroundColor: 'white',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '200px'
                }}>
                  {task.workName}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '4px',
                  backgroundColor: 'white',
                  fontWeight: 'bold',
                  color: task.color
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
                  fontSize: '11px'
                }}>
                  {task.actualStart ? formatDate(task.actualStart) : '-'}
                </td>
                {months.map(month => 
                  Array.from({ length: month.days }, (_, i) => i + 1).map(day => {
                    const cell = getCellContent(task, month.year, month.month, day);
                    return (
                      <td 
                        key={`${month.year}-${month.month}-${day}`}
                        style={{ 
                          border: '1px solid #ddd',
                          backgroundColor: cell.backgroundColor,
                          width: '25px',
                          height: '25px',
                          padding: '0',
                          textAlign: 'center',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}
                      >
                        {cell.content}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
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