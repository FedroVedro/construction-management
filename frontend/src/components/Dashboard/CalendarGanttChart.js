import React, { useEffect, useState } from 'react';

const CalendarGanttChart = ({ schedules, cities, selectedView = null }) => {
  const [processedData, setProcessedData] = useState([]);
  const [decades, setDecades] = useState([]);
  const [viewMode, setViewMode] = useState(selectedView || 'all');
  const [sortBy, setSortBy] = useState('default'); // default, city, stage, department, startDate

  // Названия отделов для разных типов
  const typeNames = {
    document: 'Выдача документации',
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

 


  // Функция для получения названия декады
  const getDecadeName = (decade) => {
    switch(decade) {
      case 1: return 'I';
      case 2: return 'II';
      case 3: return 'III';
      default: return '';
    }
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

    // Создать массив декад
    const decadesArray = [];
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    
    while (current <= maxDate) {
      const year = current.getFullYear();
      const month = current.getMonth();
      const monthName = current.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      
      // Добавляем три декады для каждого месяца
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



  // Проверка, попадает ли период в декаду
  const isPeriodInDecade = (startDate, endDate, year, month, decade) => {
    // Получаем границы декады
    let decadeStart, decadeEnd;
    
    if (decade === 1) {
      decadeStart = new Date(year, month, 1);
      decadeEnd = new Date(year, month, 10);
    } else if (decade === 2) {
      decadeStart = new Date(year, month, 11);
      decadeEnd = new Date(year, month, 20);
    } else {
      decadeStart = new Date(year, month, 21);
      decadeEnd = new Date(year, month + 1, 0); // последний день месяца
    }
    
    // Проверяем пересечение периодов
    return startDate <= decadeEnd && endDate >= decadeStart;
  };

  const getCellContent = (task, year, month, decade) => {
    let backgroundColor = 'transparent';
    let content = '';
    
    // Проверяем плановые даты - окрашиваем ячейку
    if (isPeriodInDecade(task.plannedStart, task.plannedEnd, year, month, decade)) {
      backgroundColor = task.color;
    }
    
    // Проверяем фактические даты - добавляем букву Ф
    if (task.actualStart) {
      if (task.actualEnd) {
        // Если есть обе даты, проверяем период
        if (isPeriodInDecade(task.actualStart, task.actualEnd, year, month, decade)) {
          content = 'Ф';
        }
      } else {
        // Если есть только дата начала и нет даты конца,
        // показываем Ф от даты начала и до конца таблицы
        const decadeStart = new Date(year, month, decade === 1 ? 1 : decade === 2 ? 11 : 21);
        if (task.actualStart <= decadeStart) {
          content = 'Ф';
        }
      }
    }
    
    return { backgroundColor, content };
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
        <h2>Календарный график работ (по декадам)</h2>
        
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
                <option value="document">Выдача документации</option>
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
        <div style={{ marginTop: '15px' }}>
          <h4>Легенда:</h4>
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
          </div>
          <div style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
            I - первая декада (1-10), II - вторая декада (11-20), III - третья декада (21-конец месяца)
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
              <th colSpan="8" style={{ 
                border: '1px solid #ddd', 
                padding: '8px',
                backgroundColor: '#f8f9fa',
                zIndex: 4,
                boxShadow: '2px 0 5px rgba(0,0,0,0.1)', // Добавляем тень для визуального отделения
                whiteSpace: 'nowrap'
              }}>
                Информация о работах
              </th>
              {/* Группируем декады по месяцам */}
              {decades.reduce((acc, decade, index) => {
                if (index === 0 || decade.month !== decades[index - 1].month) {
                  // Считаем количество декад в этом месяце
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
                left: '150px', // Для этапа строительства
                zIndex: 3,
                minWidth: '150px'
              }}>Этап строительства</th>
              <th style={{ 
                border: '1px solid #ddd',
                backgroundColor: '#f8f9fa',
                padding: '8px',
                position: 'sticky',
                left: '300px', // Для наименования работ
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
              {decades.map(decade => (
                <th 
                  key={decade.key}
                  style={{ 
                    border: '1px solid #ddd', 
                    padding: '2px',
                    backgroundColor: '#f8f9fa',
                    width: '40px',
                    fontSize: '11px',
                    textAlign: 'center'
                  }}
                >
                  {getDecadeName(decade.decade)}
                </th>
              ))}
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
                  zIndex: 2
                }}>
                  {task.constructionStage}
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
                  fontSize: '11px'
                }}>
                  {task.actualStart ? formatDate(task.actualStart) : '-'}
                </td>
                <td style={{ 
                  border: '1px solid #ddd', 
                  padding: '4px',
                  backgroundColor: 'white',
                  fontSize: '11px'
                }}>
                  {task.actualEnd ? formatDate(task.actualEnd) : '-'}
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
                        height: '30px',
                        padding: '0',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#000'
                      }}
                    >
                      {cell.content}
                    </td>
                  );
                })}
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