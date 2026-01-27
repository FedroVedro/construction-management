// Утилиты для работы с графиками
import * as XLSX from 'xlsx';
import { formatDate } from './dateParser';

/**
 * Форматирование даты для input[type="date"]
 */
export const formatDateForInput = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Форматирование даты для отображения в формате DD/MM/YYYY
 */
export const formatDateDisplay = (date) => {
  return formatDate(date);
};

/**
 * Быстрые даты
 */
export const getQuickDates = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  const next3Months = new Date(today);
  next3Months.setMonth(next3Months.getMonth() + 3);
  
  // Конец текущего квартала
  const currentQuarter = Math.floor(today.getMonth() / 3);
  const endOfQuarter = new Date(today.getFullYear(), (currentQuarter + 1) * 3, 0);
  
  return {
    today: formatDateForInput(today),
    tomorrow: formatDateForInput(tomorrow),
    nextWeek: formatDateForInput(nextWeek),
    nextMonth: formatDateForInput(nextMonth),
    next3Months: formatDateForInput(next3Months),
    endOfQuarter: formatDateForInput(endOfQuarter)
  };
};

/**
 * Валидация дат
 */
export const validateDates = (startDate, endDate) => {
  if (!startDate || !endDate) return { valid: true, error: null };
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { valid: false, error: 'Некорректный формат даты' };
  }
  
  if (end < start) {
    return { valid: false, error: 'Дата окончания раньше даты начала' };
  }
  
  return { valid: true, error: null };
};

/**
 * Вычисление статуса строки на основе дат
 */
export const getRowStatus = (schedule) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const plannedStart = schedule.planned_start_date ? new Date(schedule.planned_start_date) : null;
  const plannedEnd = schedule.planned_end_date ? new Date(schedule.planned_end_date) : null;
  const actualStart = schedule.actual_start_date ? new Date(schedule.actual_start_date) : null;
  const actualEnd = schedule.actual_end_date ? new Date(schedule.actual_end_date) : null;
  
  // Если фактическая дата окончания есть
  if (actualEnd) {
    if (plannedEnd && actualEnd > plannedEnd) {
      return { 
        status: 'delayed', 
        color: '#dc3545', 
        bgColor: '#f8d7da',
        label: 'Завершено с задержкой',
        icon: '⚠️'
      };
    }
    if (plannedEnd && actualEnd <= plannedEnd) {
      return { 
        status: 'completed_on_time', 
        color: '#28a745', 
        bgColor: '#d4edda',
        label: 'Завершено в срок',
        icon: '✓'
      };
    }
    return { 
      status: 'completed', 
      color: '#28a745', 
      bgColor: '#d4edda',
      label: 'Завершено',
      icon: '✓'
    };
  }
  
  // Если работа начата но не завершена
  if (actualStart && !actualEnd) {
    if (plannedEnd && today > plannedEnd) {
      return { 
        status: 'overdue', 
        color: '#dc3545', 
        bgColor: '#f8d7da',
        label: 'Просрочено',
        icon: '🔴'
      };
    }
    return { 
      status: 'in_progress', 
      color: '#ffc107', 
      bgColor: '#fff3cd',
      label: 'В работе',
      icon: '🔄'
    };
  }
  
  // Если работа не начата
  if (!actualStart) {
    if (plannedStart && today > plannedStart) {
      return { 
        status: 'not_started', 
        color: '#fd7e14', 
        bgColor: '#ffe5d0',
        label: 'Не начато вовремя',
        icon: '⏰'
      };
    }
    if (plannedStart && today.getTime() === plannedStart.getTime()) {
      return { 
        status: 'starts_today', 
        color: '#17a2b8', 
        bgColor: '#d1ecf1',
        label: 'Начало сегодня',
        icon: '📅'
      };
    }
    if (plannedStart && plannedStart > today) {
      const daysUntil = Math.ceil((plannedStart - today) / (1000 * 60 * 60 * 24));
      return { 
        status: 'scheduled', 
        color: '#6c757d', 
        bgColor: '#e9ecef',
        label: `Через ${daysUntil} дн.`,
        icon: '📋'
      };
    }
  }
  
  return { 
    status: 'unknown', 
    color: '#6c757d', 
    bgColor: 'transparent',
    label: '',
    icon: ''
  };
};

/**
 * Экспорт данных в CSV
 */
export const exportToCSV = (data, columns, filename = 'export.csv') => {
  // Заголовки
  const headers = columns.map(col => col.label).join(';');
  
  // Данные
  const rows = data.map(item => {
    return columns.map(col => {
      let value = item[col.field];
      
      // Форматирование дат
      if (col.type === 'date' && value) {
        value = formatDateDisplay(value);
      }
      
      // Форматирование чисел
      if (col.type === 'number' && value) {
        value = value.toString().replace('.', ',');
      }
      
      // Экранирование
      if (typeof value === 'string') {
        value = value.replace(/"/g, '""');
        if (value.includes(';') || value.includes('\n') || value.includes('"')) {
          value = `"${value}"`;
        }
      }
      
      return value ?? '';
    }).join(';');
  });
  
  // UTF-8 BOM для корректного отображения кириллицы в Excel
  const BOM = '\uFEFF';
  const csvContent = BOM + headers + '\n' + rows.join('\n');
  
  // Скачивание файла
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Экспорт данных в Excel
 */
export const exportToExcel = (data, columns, filename = 'export.xlsx', sheetName = 'Данные') => {
  // Подготавливаем данные для Excel
  const excelData = data.map(item => {
    const row = {};
    columns.forEach(col => {
      let value = item[col.field];
      
      // Форматирование дат
      if (col.type === 'date' && value) {
        value = formatDateDisplay(value);
      }
      
      // Форматирование чисел
      if (col.type === 'number' && value !== null && value !== undefined) {
        value = parseFloat(value);
      }
      
      row[col.label] = value ?? '';
    });
    return row;
  });

  // Создаём книгу и лист
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Устанавливаем ширину столбцов
  const colWidths = columns.map(col => {
    // Базовая ширина на основе заголовка
    let width = col.label.length + 2;
    
    // Проверяем данные для определения максимальной ширины
    data.forEach(item => {
      const value = item[col.field];
      if (value) {
        const strLen = String(value).length;
        if (strLen > width) width = strLen;
      }
    });
    
    // Ограничиваем максимальную ширину
    return { wch: Math.min(width, 50) };
  });
  worksheet['!cols'] = colWidths;

  // Добавляем лист в книгу
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Скачиваем файл
  XLSX.writeFile(workbook, filename);
};

/**
 * Экспорт данных в Excel с несколькими листами
 */
export const exportToExcelMultiSheet = (sheets, filename = 'export.xlsx') => {
  const workbook = XLSX.utils.book_new();

  sheets.forEach(({ data, columns, sheetName }) => {
    const excelData = data.map(item => {
      const row = {};
      columns.forEach(col => {
        let value = item[col.field];
        
        if (col.type === 'date' && value) {
          value = formatDateDisplay(value);
        }
        
        if (col.type === 'number' && value !== null && value !== undefined) {
          value = parseFloat(value);
        }
        
        row[col.label] = value ?? '';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Устанавливаем ширину столбцов
    const colWidths = columns.map(col => {
      let width = col.label.length + 2;
      data.forEach(item => {
        const value = item[col.field];
        if (value) {
          const strLen = String(value).length;
          if (strLen > width) width = strLen;
        }
      });
      return { wch: Math.min(width, 50) };
    });
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31)); // Excel ограничивает имя листа 31 символом
  });

  XLSX.writeFile(workbook, filename);
};

/**
 * Подготовка строки для копирования
 */
export const prepareRowForCopy = (row, scheduleType) => {
  const copy = { ...row };
  
  // Удаляем идентификаторы и служебные поля
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.isNew;
  
  // Генерируем новый временный ID
  copy.id = `new-${Date.now()}`;
  copy.isNew = true;
  copy.schedule_type = scheduleType;
  
  // Очищаем фактические даты (копируем только план)
  copy.actual_start_date = null;
  copy.actual_end_date = null;
  
  return copy;
};

/**
 * Добавление дней к дате
 */
export const addDaysToDate = (dateStr, days) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDateForInput(date);
};

