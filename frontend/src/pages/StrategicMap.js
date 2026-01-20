import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';

// Константы для типов вех и их цветов
const MILESTONE_TYPES = {
  'РНС': { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', label: 'РНС' },
  'РНВ': { color: '#14b8a6', bgColor: 'rgba(20, 184, 166, 0.15)', label: 'РНВ' },
  'Продажа': { color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', label: 'Продажа' },
  'Строительство': { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', label: 'Строит.' },
  'Проектирование': { color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', label: 'Проект.' },
  'Согласование': { color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)', label: 'Соглас.' },
  'Завершение': { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.2)', label: 'Заверш.' },
  'Подготовка': { color: '#6366f1', bgColor: 'rgba(99, 102, 241, 0.15)', label: 'Подгот.' },
};

// Константы для статусов проектов
const STATUS_OPTIONS = [
  'Строительство',
  'Проектирование, экспертиза, получение РНС',
  'Поиск участка',
  'Приобретение прав на участок',
  'Есть право на зу, ждет реализации',
  'Завершен'
];

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
  const [yearFilter, setYearFilter] = useState('all');
  const [quickFillType, setQuickFillType] = useState(null); // 'РНС', 'Продажа' etc.
  const [updatingCells, setUpdatingCells] = useState(new Set()); // Набор `${projectId}-${dateStr}`
  const [hoveredRow, setHoveredRow] = useState(null);
  const [startYear, setStartYear] = useState(2022);
  const [endYear, setEndYear] = useState(2028);
  const [yearRangeLimits, setYearRangeLimits] = useState({ min: 2018, max: 2035 });
  const [updatingProjectFields, setUpdatingProjectFields] = useState(new Set()); // `${projectId}-${field}`
  const [projectFieldEdits, setProjectFieldEdits] = useState({});
  const [editingAreaCell, setEditingAreaCell] = useState(null); // { projectId, date, displayDate }
  const [areaEditValue, setAreaEditValue] = useState('');
  
  const tableRef = useRef(null);

  // Генерация месяцев для временной шкалы (с startYear по endYear)
  const months = useMemo(() => {
    const result = [];
    for (let year = startYear; year <= endYear; year++) {
      for (let month = 0; month < 12; month++) {
        result.push(new Date(year, month, 1));
      }
    }
    return result;
  }, [startYear, endYear]);

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

  const yearsInView = useMemo(() => {
    const years = [];
    filteredMonths.forEach(date => {
      const year = date.getFullYear();
      if (!years.includes(year)) years.push(year);
    });
    return years;
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

  // Получить список вех для проекта на конкретный месяц
  const getMilestones = useCallback((project, date) => {
    if (!project.milestones) return null;
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return project.milestones.filter(m => {
      const mDate = new Date(m.month_date);
      const mYearMonth = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`;
      return mYearMonth === yearMonth;
    });
  }, []);

  const findMilestoneByType = useCallback((project, date, milestoneType) => {
    const milestones = getMilestones(project, date) || [];
    return milestones.find(m => m.milestone_type === milestoneType);
  }, [getMilestones]);

  const getCellAreaMilestone = useCallback((project, date) => {
    const milestones = getMilestones(project, date) || [];
    return milestones.find(m => m.area_value !== null && m.area_value !== undefined) || null;
  }, [getMilestones]);

  const getCellAreaValue = useCallback((project, date) => {
    const carrier = getCellAreaMilestone(project, date);
    return carrier ? carrier.area_value : null;
  }, [getCellAreaMilestone]);

  const getYearAreaTotal = useCallback((project, year) => {
    if (!project) return 0;
    return filteredMonths.reduce((sum, date) => {
      if (date.getFullYear() !== year) return sum;
      const area = getCellAreaValue(project, date);
      return area ? sum + area : sum;
    }, 0);
  }, [filteredMonths, getCellAreaValue]);

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
    const milestonesForMonth = getMilestones(project, date) || [];
    const primaryMilestone = milestonesForMonth[0] || null;
    const cellAreaValue = getCellAreaValue(project, date);

    if (quickFillType) {
      // Режим быстрого заполнения
      setUpdatingCells(prev => new Set(prev).add(cellKey));
      try {
        const existingMilestone = findMilestoneByType(project, date, quickFillType);
        if (existingMilestone) {
          const remainingMilestones = milestonesForMonth.filter(m => m.id !== existingMilestone.id);
          const areaToPreserve = existingMilestone.area_value ?? null;

          await client.delete(`/strategic-map/milestones/${existingMilestone.id}`);

          if (areaToPreserve !== null) {
            if (remainingMilestones.length > 0) {
              const carrier = remainingMilestones[0];
              await client.put(`/strategic-map/milestones/${carrier.id}`, { area_value: areaToPreserve });
              setProjects(prev => prev.map(p => {
                if (p.id !== projectId) return p;
                return {
                  ...p,
                  milestones: (p.milestones || [])
                    .filter(m => m.id !== existingMilestone.id)
                    .map(m => (m.id === carrier.id ? { ...m, area_value: areaToPreserve } : { ...m, area_value: m.area_value ?? null }))
                };
              }));
            } else {
              const createdArea = await client.post(
                `/strategic-map/projects/${projectId}/milestones`,
                {
                  month_date: dateStr,
                  milestone_type: null,
                  value: null,
                  area_value: areaToPreserve,
                  is_key_milestone: false
                }
              );
              const newAreaMilestone = createdArea.data;
              setProjects(prev => prev.map(p => {
                if (p.id !== projectId) return p;
                return {
                  ...p,
                  milestones: [
                    ...(p.milestones || []).filter(m => m.id !== existingMilestone.id),
                    newAreaMilestone
                  ]
                };
              }));
            }
          } else {
            setProjects(prev => prev.map(p => {
              if (p.id !== projectId) return p;
              return {
                ...p,
                milestones: (p.milestones || []).filter(m => m.id !== existingMilestone.id)
              };
            }));
          }
        } else {
          const created = await client.post(
            `/strategic-map/projects/${projectId}/milestones`,
            {
              month_date: dateStr,
              milestone_type: quickFillType,
              value: null,
              area_value: null,
              is_key_milestone: ['РНС', 'Завершение'].includes(quickFillType)
            }
          );
          const newMilestone = created.data;
          setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              milestones: [...(p.milestones || []), newMilestone]
            };
          }));
        }
      } catch (e) {
        console.error(e);
        showError('Ошибка при обновлении');
        // В случае ошибки перезагружаем данные
        await fetchData();
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
    setEditValue(primaryMilestone?.value || '');
    setSelectedMilestoneType(primaryMilestone?.milestone_type || '');
    setEditAreaValue(cellAreaValue ?? '');
  };

  // Закрытие модального окна редактирования
  const closeEditModal = () => {
    setEditingCell(null);
    setEditValue('');
    setEditAreaValue('');
    setSelectedMilestoneType('');
  };

  const closeAreaEdit = () => {
    setEditingAreaCell(null);
    setAreaEditValue('');
  };

  // Сохранение редактирования ячейки
  const saveCellEdit = async () => {
    if (!editingCell) return;
    
    try {
      const project = projects.find(p => p.id === editingCell.projectId);
      const displayDate = editingCell.displayDate || new Date(editingCell.date);
      const monthMilestones = getMilestones(project, displayDate) || [];
      const rawArea = (editAreaValue ?? '').toString();
      const trimmedArea = rawArea.trim();
      const parsedAreaValue = trimmedArea === '' ? null : parseFloat(trimmedArea);
      if (parsedAreaValue !== null && Number.isNaN(parsedAreaValue)) {
        showError('Неверный формат числа');
        return;
      }
      const areaCarrier = monthMilestones.find(m => m.area_value !== null && m.area_value !== undefined) || null;

      let updatedMilestones = [...(project.milestones || [])];

      if (!selectedMilestoneType) {
        if (parsedAreaValue === null) {
          // Если тип не выбран и площадь пустая — очищаем все вехи в этой ячейке
          await Promise.all(monthMilestones.map(m => client.delete(`/strategic-map/milestones/${m.id}`)));
          updatedMilestones = updatedMilestones.filter(m => !monthMilestones.find(mm => mm.id === m.id));
        } else {
          // Тип не выбран, но площадь задана — сохраняем площадь на уровне ячейки
          let carrier = areaCarrier;
          if (!carrier && monthMilestones.length > 0) {
            carrier = monthMilestones[0];
          }
          if (carrier) {
            await client.put(`/strategic-map/milestones/${carrier.id}`, { area_value: parsedAreaValue });
            updatedMilestones = updatedMilestones.map(m => 
              m.id === carrier.id ? { ...m, area_value: parsedAreaValue } : m
            );
          } else {
            const response = await client.post(
              `/strategic-map/projects/${editingCell.projectId}/milestones`,
              {
                month_date: editingCell.date,
                milestone_type: null,
                value: null,
                area_value: parsedAreaValue,
                is_key_milestone: false
              }
            );
            updatedMilestones.push(response.data);
          }
          const toClear = monthMilestones.filter(m => carrier && m.id !== carrier.id && m.area_value !== null && m.area_value !== undefined);
          if (toClear.length > 0) {
            await Promise.all(toClear.map(m => client.put(`/strategic-map/milestones/${m.id}`, { area_value: null })));
            updatedMilestones = updatedMilestones.map(m => 
              toClear.find(tc => tc.id === m.id) ? { ...m, area_value: null } : m
            );
          }
        }
      } else {
        let selectedMilestone = monthMilestones.find(m => m.milestone_type === selectedMilestoneType);
        if (selectedMilestone) {
          await client.put(
            `/strategic-map/milestones/${selectedMilestone.id}`,
            {
              value: editValue || null,
              milestone_type: selectedMilestoneType,
              is_key_milestone: ['РНС', 'Завершение'].includes(selectedMilestoneType)
            }
          );
          updatedMilestones = updatedMilestones.map(m => 
            m.id === selectedMilestone.id 
              ? { ...m, value: editValue || null, milestone_type: selectedMilestoneType, is_key_milestone: ['РНС', 'Завершение'].includes(selectedMilestoneType) }
              : m
          );
        } else {
          const created = await client.post(
            `/strategic-map/projects/${editingCell.projectId}/milestones`,
            {
              month_date: editingCell.date,
              milestone_type: selectedMilestoneType,
              value: editValue || null,
              area_value: null,
              is_key_milestone: ['РНС', 'Завершение'].includes(selectedMilestoneType)
            }
          );
          selectedMilestone = created.data;
          updatedMilestones.push(selectedMilestone);
        }

        if (parsedAreaValue === null) {
          if (areaCarrier) {
            await client.put(`/strategic-map/milestones/${areaCarrier.id}`, { area_value: null });
            updatedMilestones = updatedMilestones.map(m => 
              m.id === areaCarrier.id ? { ...m, area_value: null } : m
            );
          }
        } else {
          const carrier = areaCarrier || selectedMilestone;
          if (carrier) {
            await client.put(`/strategic-map/milestones/${carrier.id}`, { area_value: parsedAreaValue });
            updatedMilestones = updatedMilestones.map(m => 
              m.id === carrier.id ? { ...m, area_value: parsedAreaValue } : m
            );
            const toClear = monthMilestones.filter(m => m.id !== carrier.id && m.area_value !== null && m.area_value !== undefined);
            if (toClear.length > 0) {
              await Promise.all(toClear.map(m => client.put(`/strategic-map/milestones/${m.id}`, { area_value: null })));
              updatedMilestones = updatedMilestones.map(m => 
                toClear.find(tc => tc.id === m.id) ? { ...m, area_value: null } : m
              );
            }
          }
        }
      }

      // Обновляем локальное состояние вместо перезагрузки
      setProjects(prev => prev.map(p => 
        p.id === editingCell.projectId 
          ? { ...p, milestones: updatedMilestones }
          : p
      ));

      showSuccess('Сохранено');
    } catch (e) {
      console.error(e);
      showError('Ошибка сохранения');
      // В случае ошибки перезагружаем данные
      await fetchData();
    }
    closeEditModal();
  };

  const saveAreaOnlyEdit = async () => {
    if (!editingAreaCell) return;

    const rawArea = (areaEditValue ?? '').toString();
    const trimmedArea = rawArea.trim();
    const parsedAreaValue = trimmedArea === '' ? null : parseFloat(trimmedArea);
    if (parsedAreaValue !== null && Number.isNaN(parsedAreaValue)) {
      showError('Неверный формат числа');
      return;
    }

    try {
      const project = projects.find(p => p.id === editingAreaCell.projectId);
      const displayDate = editingAreaCell.displayDate || new Date(editingAreaCell.date);
      const monthMilestones = getMilestones(project, displayDate) || [];
      const areaCarrier = monthMilestones.find(m => m.area_value !== null && m.area_value !== undefined) || null;

      let updatedMilestones = [...(project.milestones || [])];

      if (parsedAreaValue === null) {
        if (areaCarrier) {
          await client.put(`/strategic-map/milestones/${areaCarrier.id}`, { area_value: null });
          updatedMilestones = updatedMilestones.map(m => 
            m.id === areaCarrier.id ? { ...m, area_value: null } : m
          );
        }
      } else {
        let carrier = areaCarrier;
        if (!carrier && monthMilestones.length > 0) {
          carrier = monthMilestones[0];
        }
        if (carrier) {
          await client.put(`/strategic-map/milestones/${carrier.id}`, { area_value: parsedAreaValue });
          updatedMilestones = updatedMilestones.map(m => 
            m.id === carrier.id ? { ...m, area_value: parsedAreaValue } : m
          );
        } else {
          const response = await client.post(
            `/strategic-map/projects/${editingAreaCell.projectId}/milestones`,
            {
              month_date: editingAreaCell.date,
              milestone_type: null,
              value: null,
              area_value: parsedAreaValue,
              is_key_milestone: false
            }
          );
          updatedMilestones.push(response.data);
        }
        const toClear = monthMilestones.filter(m => carrier && m.id !== carrier.id && m.area_value !== null && m.area_value !== undefined);
        if (toClear.length > 0) {
          await Promise.all(toClear.map(m => client.put(`/strategic-map/milestones/${m.id}`, { area_value: null })));
          updatedMilestones = updatedMilestones.map(m => 
            toClear.find(tc => tc.id === m.id) ? { ...m, area_value: null } : m
          );
        }
      }

      // Обновляем локальное состояние вместо перезагрузки
      setProjects(prev => prev.map(p => 
        p.id === editingAreaCell.projectId 
          ? { ...p, milestones: updatedMilestones }
          : p
      ));

      showSuccess('Сохранено');
    } catch (e) {
      console.error(e);
      showError('Ошибка сохранения');
      // В случае ошибки перезагружаем данные
      await fetchData();
    }

    closeAreaEdit();
  };

  const deleteLegendMilestone = async (project, date, milestone) => {
    if (!milestone?.id) return;
    const dateStr = formatDateLocal(date);
    const cellKey = `${project.id}-${dateStr}`;
    if (updatingCells.has(cellKey)) return;

    setUpdatingCells(prev => new Set(prev).add(cellKey));
    try {
      const allMilestones = getMilestones(project, date) || [];
      const remaining = allMilestones.filter(x => x.id !== milestone.id);
      const areaToPreserve = milestone.area_value ?? null;

      let updatedMilestones = [...(project.milestones || [])];

      await client.delete(`/strategic-map/milestones/${milestone.id}`);
      updatedMilestones = updatedMilestones.filter(m => m.id !== milestone.id);

      if (areaToPreserve !== null) {
        if (remaining.length > 0) {
          const carrier = remaining[0];
          await client.put(`/strategic-map/milestones/${carrier.id}`, { area_value: areaToPreserve });
          updatedMilestones = updatedMilestones.map(m => 
            m.id === carrier.id ? { ...m, area_value: areaToPreserve } : m
          );
        } else {
          const response = await client.post(
            `/strategic-map/projects/${project.id}/milestones`,
            {
              month_date: dateStr,
              milestone_type: null,
              value: null,
              area_value: areaToPreserve,
              is_key_milestone: false
            }
          );
          updatedMilestones.push(response.data);
        }
      }

      // Обновляем локальное состояние вместо перезагрузки
      setProjects(prev => prev.map(p => 
        p.id === project.id 
          ? { ...p, milestones: updatedMilestones }
          : p
      ));
    } catch (e) {
      console.error(e);
      showError('Ошибка удаления');
      // В случае ошибки перезагружаем данные
      await fetchData();
    } finally {
      setUpdatingCells(prev => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
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
    for (let y = startYear; y <= endYear; y++) years.add(y);
    return Array.from(years);
  }, [startYear, endYear]);

  // Добавить год в начало
  const addYearBefore = () => {
    setStartYear(prev => {
      const next = prev - 1;
      setYearRangeLimits(limit => ({ ...limit, min: Math.min(limit.min, next) }));
      return next;
    });
  };

  // Добавить год в конец
  const addYearAfter = () => {
    setEndYear(prev => {
      const next = prev + 1;
      setYearRangeLimits(limit => ({ ...limit, max: Math.max(limit.max, next) }));
      return next;
    });
  };

  const updateProjectField = async (projectId, field, value) => {
    const fieldKey = `${projectId}-${field}`;
    if (updatingProjectFields.has(fieldKey)) return;

    setUpdatingProjectFields(prev => new Set(prev).add(fieldKey));
    setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, [field]: value } : p)));

    try {
      await client.put(`/strategic-map/projects/${projectId}`, { [field]: value });
    } catch (e) {
      console.error(e);
      showError('Ошибка сохранения');
      fetchData();
    } finally {
      setUpdatingProjectFields(prev => {
        const next = new Set(prev);
        next.delete(fieldKey);
        return next;
      });
    }
  };

  const getFieldKey = (projectId, field) => `${projectId}-${field}`;

  const setFieldEditValue = (projectId, field, value) => {
    const key = getFieldKey(projectId, field);
    setProjectFieldEdits(prev => ({ ...prev, [key]: value }));
  };

  const clearFieldEditValue = (projectId, field) => {
    const key = getFieldKey(projectId, field);
    setProjectFieldEdits(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const getDisplayValue = (value) => (value === null || value === undefined ? '' : String(value));

  const commitNumericField = (projectId, field, rawValue, parser = 'int') => {
    const trimmed = rawValue.trim();
    const parsed = trimmed === '' ? null : (parser === 'float' ? parseFloat(trimmed) : parseInt(trimmed, 10));
    if (parsed !== null && Number.isNaN(parsed)) {
      showError('Неверный формат числа');
      return;
    }
    updateProjectField(projectId, field, parsed);
  };

  const commitTextField = (projectId, field, rawValue) => {
    const trimmed = rawValue.trim();
    updateProjectField(projectId, field, trimmed === '' ? null : trimmed);
  };

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

  const yearRangeStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.5)',
    borderRadius: 10,
    padding: '8px 10px'
  };

  const rangeTrackStyle = {
    position: 'relative',
    minWidth: 240,
    height: 28,
    display: 'flex',
    alignItems: 'center'
  };

  const rangeInputStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    margin: 0,
    pointerEvents: 'none',
    appearance: 'none',
    background: 'transparent'
  };

  const rangeThumbStyle = {
    pointerEvents: 'auto'
  };

  const rangeTrackBaseStyle = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 999,
    background: isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'
  };

  const rangeTrackActiveStyle = (start, end) => {
    const span = yearRangeLimits.max - yearRangeLimits.min || 1;
    const left = ((start - yearRangeLimits.min) / span) * 100;
    const right = ((end - yearRangeLimits.min) / span) * 100;
    return {
      position: 'absolute',
      height: 6,
      borderRadius: 999,
      left: `${left}%`,
      width: `${Math.max(0, right - left)}%`,
      background: isDark ? 'rgba(59, 130, 246, 0.7)' : 'rgba(37, 99, 235, 0.7)'
    };
  };

  const yearStepButtonStyle = {
    border: 'none',
    background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#fff',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600
  };

  const inlineInputStyle = {
    width: '100%',
    height: 30,
    borderRadius: 6,
    border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.6)' : 'rgba(203, 213, 225, 0.9)'}`,
    background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#fff',
    color: 'var(--text-primary)',
    padding: '4px 6px',
    fontSize: 11,
    textAlign: 'center'
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

  const fixedColumnWidths = {
    index: 40,
    project: 160,
    status: 160,
    sections: 70,
    area: 100,
    duration: 80
  };

  const headerRowHeights = {
    top: 48,
    top2: 44,
    top3: 36
  };

  const fixedColumnOffsets = {
    index: 0,
    project: fixedColumnWidths.index,
    status: fixedColumnWidths.index + fixedColumnWidths.project,
    sections: fixedColumnWidths.index + fixedColumnWidths.project + fixedColumnWidths.status,
    area: fixedColumnWidths.index + fixedColumnWidths.project + fixedColumnWidths.status + fixedColumnWidths.sections,
    duration: fixedColumnWidths.index + fixedColumnWidths.project + fixedColumnWidths.status + fixedColumnWidths.sections + fixedColumnWidths.area
  };

  const cellStyle = (isHeader = false, isFixed = false, fixedLeft = 0, isFixedVertical = false, fixedWidth = null) => {
    let topValue = 'auto';
    let minHeight = undefined;
    if (isFixedVertical && isHeader) {
      if (isFixedVertical === 'top2') {
        topValue = headerRowHeights.top;
        minHeight = headerRowHeights.top2;
      } else if (isFixedVertical === 'top3') {
        topValue = headerRowHeights.top + headerRowHeights.top2;
        minHeight = headerRowHeights.top3;
      } else {
        topValue = 0;
        minHeight = headerRowHeights.top;
      }
    }
    
    return {
      padding: isHeader ? '10px 8px' : '8px 6px',
      fontSize: isHeader ? 11 : 12,
      fontWeight: isHeader ? 600 : 400,
      textAlign: 'center',
      whiteSpace: isHeader ? 'normal' : 'nowrap',
      wordBreak: isHeader ? 'break-word' : 'normal',
      lineHeight: isHeader ? 1.2 : 'normal',
      verticalAlign: 'middle',
      borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
      borderBottom: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
      background: isFixed || isFixedVertical
        ? (isDark ? '#1e293b' : '#f8fafc')
        : (isDark ? 'rgba(15, 23, 42, 0.1)' : 'transparent'),
      position: (isFixed || isFixedVertical) ? 'sticky' : 'static',
      left: isFixed ? fixedLeft : 'auto',
      top: isFixedVertical ? topValue : 'auto',
      zIndex: isFixed && isFixedVertical ? 30 : (isFixed ? 20 : (isFixedVertical ? 15 : 1)),
      width: isFixed ? fixedWidth : 'auto',
      minWidth: isFixed ? fixedWidth : (isHeader ? 60 : 80),
      maxWidth: isFixed ? fixedWidth : 'none',
      ...(minHeight ? { minHeight } : {}),
    };
  };

  const yearTotalColumnStyle = (isHeader = false, isFixedVertical = false) => ({
    ...cellStyle(isHeader, false, 0, isFixedVertical),
    minWidth: 80,
    maxWidth: 100,
    background: isDark
      ? 'rgba(30, 41, 59, 0.7)'
      : 'rgba(226, 232, 240, 0.7)',
    fontWeight: isHeader ? 700 : 600
  });

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
          style={{ minWidth: 240, maxWidth: 300 }}
        />
        
        <select 
          value={yearFilter} 
          onChange={(e) => setYearFilter(e.target.value)}
          style={{ minWidth: 120 }}
        >
          <option value="all">Все годы</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

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

        {/* Управление годами */}
        <div style={yearRangeStyle}>
          <button
            onClick={addYearBefore}
            style={yearStepButtonStyle}
            title="Добавить год слева"
          >
            − год
          </button>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
              {startYear} — {endYear}
            </div>
            
            {/* Начальный год */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'left' }}>
                Начало: {startYear}
              </label>
              <input
                type="range"
                min={yearRangeLimits.min}
                max={yearRangeLimits.max}
                value={startYear}
                onChange={(e) => {
                  const next = Math.min(parseInt(e.target.value, 10), endYear);
                  setStartYear(next);
                }}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 999,
                  appearance: 'none',
                  background: `linear-gradient(to right, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'} 0%, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'} ${((startYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} ${((startYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} 100%)`,
                  cursor: 'pointer'
                }}
              />
            </div>
            
            {/* Конечный год */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <label style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'left' }}>
                Конец: {endYear}
              </label>
              <input
                type="range"
                min={yearRangeLimits.min}
                max={yearRangeLimits.max}
                value={endYear}
                onChange={(e) => {
                  const next = Math.max(parseInt(e.target.value, 10), startYear);
                  setEndYear(next);
                }}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 999,
                  appearance: 'none',
                  background: `linear-gradient(to right, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} 0%, 
                    ${isDark ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.6)'} ${((endYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'} ${((endYear - yearRangeLimits.min) / (yearRangeLimits.max - yearRangeLimits.min)) * 100}%, 
                    ${isDark ? 'rgba(148, 163, 184, 0.25)' : 'rgba(148, 163, 184, 0.4)'} 100%)`,
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
          <button
            onClick={addYearAfter}
            style={yearStepButtonStyle}
            title="Добавить год справа"
          >
            + год
          </button>
        </div>
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
      <div style={{ ...tableContainerStyle, maxHeight: '700px' }} ref={tableRef}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%', tableLayout: 'auto' }}>
          <thead>
            {/* Кварталы */}
            <tr>
              <th style={{ 
                ...cellStyle(true, true, fixedColumnOffsets.index, 'top', fixedColumnWidths.index),
                minHeight: headerRowHeights.top
              }}>
                №
              </th>
              <th style={{ 
                ...cellStyle(true, true, fixedColumnOffsets.project, 'top', fixedColumnWidths.project),
                minHeight: headerRowHeights.top
              }}>
                Проект
              </th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.status, 'top', fixedColumnWidths.status), minHeight: headerRowHeights.top }}>Текущий статус</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.sections, 'top', fixedColumnWidths.sections), minHeight: headerRowHeights.top }}>Кол-во секций</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.area, 'top', fixedColumnWidths.area), minHeight: headerRowHeights.top }}>Продаваемая площадь (М2)</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.duration, 'top', fixedColumnWidths.duration), minHeight: headerRowHeights.top }}>Срок реализации (мес)</th>
              {Object.entries(quarters).map(([quarter, monthsInQuarter]) => {
                const quarterYear = monthsInQuarter[0]?.getFullYear();
                const quarterIndex = Math.floor(monthsInQuarter[0]?.getMonth() / 3) + 1;
                return (
                  <React.Fragment key={quarter}>
                    <th 
                      colSpan={monthsInQuarter.length}
                      style={{ 
                        ...cellStyle(true, false, 0, 'top'),
                        background: isDark ? 'rgba(51, 65, 85, 0.95)' : 'rgba(226, 232, 240, 0.98)',
                        fontSize: 22,
                        fontWeight: 700,
                      }}
                    >
                      {quarter}
                    </th>
                    {quarterIndex === 4 && (
                      <th style={{ ...yearTotalColumnStyle(true, 'top') }}>
                        Итого {quarterYear}
                      </th>
                    )}
                  </React.Fragment>
                );
              })}
            </tr>
            
            {/* Месяцы - первая строка (статусы) */}
            <tr>
              <th style={{ 
                ...cellStyle(true, true, fixedColumnOffsets.index, 'top2', fixedColumnWidths.index),
                fontSize: 9,
                color: 'var(--text-muted)'
              }}>
                №
              </th>
              <th style={{ 
                ...cellStyle(true, true, fixedColumnOffsets.project, 'top2', fixedColumnWidths.project),
                fontSize: 9,
                color: 'var(--text-muted)'
              }}>
                название объекта
              </th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.status, 'top2', fixedColumnWidths.status), fontSize: 9 }}>статус</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.sections, 'top2', fixedColumnWidths.sections), fontSize: 9 }}>секций</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.area, 'top2', fixedColumnWidths.area), fontSize: 9 }}>площадь м²</th>
              <th style={{ ...cellStyle(true, true, fixedColumnOffsets.duration, 'top2', fixedColumnWidths.duration), fontSize: 9 }}>срок мес.</th>
              {filteredMonths.map((date, idx) => (
                <React.Fragment key={idx}>
                  <th 
                    style={{ 
                      ...cellStyle(true, false, 0, 'top2'),
                      fontSize: 10,
                      padding: '4px 2px',
                      minHeight: headerRowHeights.top2,
                      lineHeight: 1.2,
                      color: date.getMonth() === 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: date.getMonth() === 0 ? 700 : 400,
                      background: date.getMonth() === 0 
                        ? (isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)')
                        : (isDark ? '#1e293b' : '#f8fafc')
                    }}
                  >
                    {formatMonth(date)}
                    {date.getMonth() === 0 && <div style={{ fontSize: 8, lineHeight: 1.2 }}>{date.getFullYear()}</div>}
                  </th>
                  {date.getMonth() === 11 && (
                    <th style={{ ...yearTotalColumnStyle(true, 'top2') }}>
                      итого
                    </th>
                  )}
                </React.Fragment>
              ))}
              <th style={{ ...cellStyle(true, false, 0, 'top2') }}></th>
            </tr>
            
          </thead>
          
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr>
                <td colSpan={6 + filteredMonths.length + yearsInView.length + 1} style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
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
                    ...cellStyle(false, true, fixedColumnOffsets.index, false, fixedColumnWidths.index),
                    fontSize: 11,
                    fontWeight: project.is_subtotal || project.is_total ? 700 : 400
                  }}>
                    {rowIdx + 1}
                  </td>
                  
                  {/* Название проекта */}
                  <td style={{ 
                    ...cellStyle(false, true, fixedColumnOffsets.project, false, fixedColumnWidths.project),
                    textAlign: 'left',
                    paddingLeft: project.name.startsWith('  ') ? 8 : 4,
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
                  <td style={{ 
                    ...cellStyle(false, true, fixedColumnOffsets.status, false, fixedColumnWidths.status), 
                    fontSize: 11,
                    whiteSpace: 'normal',
                    wordWrap: 'break-word',
                    verticalAlign: 'middle'
                  }}>
                    {project.is_subtotal || project.is_total ? (
                      <div style={{ whiteSpace: 'normal', wordWrap: 'break-word' }}>
                        {project.current_status || '—'}
                      </div>
                    ) : (
                      <select
                        value={projectFieldEdits[getFieldKey(project.id, 'current_status')] ?? getDisplayValue(project.current_status)}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setFieldEditValue(project.id, 'current_status', newValue);
                          commitTextField(project.id, 'current_status', newValue);
                          clearFieldEditValue(project.id, 'current_status');
                        }}
                        style={{
                          ...inlineInputStyle,
                          cursor: 'pointer',
                          paddingRight: 20,
                          height: 'auto',
                          minHeight: 60,
                          whiteSpace: 'normal',
                          wordWrap: 'break-word',
                          lineHeight: '1.4'
                        }}
                      >
                        <option value="">—</option>
                        {STATUS_OPTIONS.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  
                  {/* Кол-во секций */}
                  <td style={{ ...cellStyle(false, true, fixedColumnOffsets.sections, false, fixedColumnWidths.sections), fontSize: 11 }}>
                    {project.is_subtotal || project.is_total ? (
                      project.sections_count ?? '—'
                    ) : (
                      <input
                        type="number"
                        value={projectFieldEdits[getFieldKey(project.id, 'sections_count')] ?? getDisplayValue(project.sections_count)}
                        onChange={(e) => setFieldEditValue(project.id, 'sections_count', e.target.value)}
                        onBlur={(e) => {
                          commitNumericField(project.id, 'sections_count', e.target.value, 'int');
                          clearFieldEditValue(project.id, 'sections_count');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            clearFieldEditValue(project.id, 'sections_count');
                            e.currentTarget.blur();
                          }
                        }}
                        style={inlineInputStyle}
                      />
                    )}
                  </td>
                  
                  {/* Продаваемая площадь (М2) */}
                  <td style={{ ...cellStyle(false, true, fixedColumnOffsets.area, false, fixedColumnWidths.area), fontSize: 11 }}>
                    {project.is_subtotal || project.is_total ? (
                      project.sellable_area != null ? project.sellable_area.toLocaleString('ru-RU') : '—'
                    ) : (
                      <input
                        type="number"
                        step="0.01"
                        value={projectFieldEdits[getFieldKey(project.id, 'sellable_area')] ?? getDisplayValue(project.sellable_area)}
                        onChange={(e) => setFieldEditValue(project.id, 'sellable_area', e.target.value)}
                        onBlur={(e) => {
                          commitNumericField(project.id, 'sellable_area', e.target.value, 'float');
                          clearFieldEditValue(project.id, 'sellable_area');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            clearFieldEditValue(project.id, 'sellable_area');
                            e.currentTarget.blur();
                          }
                        }}
                        style={inlineInputStyle}
                      />
                    )}
                  </td>
                  
                  {/* Срок реализации (мес) */}
                  <td style={{ ...cellStyle(false, true, fixedColumnOffsets.duration, false, fixedColumnWidths.duration), fontSize: 11 }}>
                    {project.is_subtotal || project.is_total ? (
                      project.construction_duration ?? '—'
                    ) : (
                      <input
                        type="number"
                        value={projectFieldEdits[getFieldKey(project.id, 'construction_duration')] ?? getDisplayValue(project.construction_duration)}
                        onChange={(e) => setFieldEditValue(project.id, 'construction_duration', e.target.value)}
                        onBlur={(e) => {
                          commitNumericField(project.id, 'construction_duration', e.target.value, 'int');
                          clearFieldEditValue(project.id, 'construction_duration');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') {
                            clearFieldEditValue(project.id, 'construction_duration');
                            e.currentTarget.blur();
                          }
                        }}
                        style={inlineInputStyle}
                      />
                    )}
                  </td>
                  
                  {/* Месяцы */}
                  {filteredMonths.map((date, idx) => {
                    const milestones = getMilestones(project, date) || [];
                    const legendMilestones = milestones.filter(m => m.milestone_type);
                    const primaryMilestone = legendMilestones[0] || null;
                    const cellAreaValue = getCellAreaValue(project, date);
                    const dateStr = formatDateLocal(date);
                    const cellKey = `${project.id}-${dateStr}`;
                    const isUpdating = updatingCells.has(cellKey);
                    const isEditing = editingCell?.projectId === project.id && editingCell?.date === dateStr;
                    const cellMilestoneStyle = legendMilestones.length === 1 ? getMilestoneCellStyle(primaryMilestone) : {};
                    
                    const isAreaEditing = editingAreaCell?.projectId === project.id && editingAreaCell?.date === dateStr;

                    return (
                      <React.Fragment key={idx}>
                        <td 
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
                          {!isEditing && (
                            <div style={{ 
                              display: 'flex',
                              flexDirection: 'column',
                              minHeight: 52,
                              padding: '4px 2px'
                            }}>
                              <div style={{ 
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                                flexGrow: 1,
                                justifyContent: 'center'
                              }}>
                              {legendMilestones.length === 0 ? (
                                  <div style={{ 
                                    fontSize: 9, 
                                    fontWeight: 400,
                                    color: 'var(--text-muted)',
                                    lineHeight: 1.2,
                                    minHeight: 12
                                  }} />
                                ) : (
                                  legendMilestones.map((m, idx) => {
                                    const type = MILESTONE_TYPES[m.milestone_type] || { color: 'var(--text-primary)', bgColor: 'transparent' };
                                    return (
                                      <div
                                        key={m.id || idx}
                                        style={{
                                          display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 4,
                                        padding: '2px 4px',
                                          borderRadius: 4,
                                          background: type.bgColor,
                                          color: type.color,
                                          lineHeight: 1.2
                                        }}
                                      onClick={(e) => e.stopPropagation()}
                                      >
                                      <div style={{ fontSize: 9, fontWeight: 600, flex: 1, textAlign: 'left' }}>
                                          {m.milestone_type || ''}
                                        </div>
                                      <button
                                        type="button"
                                        title="Удалить"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (project.is_subtotal || project.is_total) return;
                                          deleteLegendMilestone(project, date, m);
                                        }}
                                        style={{
                                          border: 'none',
                                          background: 'transparent',
                                          color: type.color,
                                          fontSize: 10,
                                          lineHeight: 1,
                                          cursor: 'pointer',
                                          padding: 0,
                                          opacity: 0.7
                                        }}
                                      >
                                        ✕
                                      </button>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (project.is_subtotal || project.is_total) return;
                                  setEditingAreaCell({ projectId: project.id, date: dateStr, displayDate: date });
                                  setAreaEditValue(cellAreaValue ?? '');
                                }}
                                style={{ 
                                  fontSize: 8, 
                                  fontWeight: cellAreaValue ? 600 : 400,
                                  color: cellAreaValue ? 'var(--text-primary)' : 'var(--text-muted)',
                                  lineHeight: 1.2,
                                  minHeight: 18,
                                  paddingTop: 2,
                                  borderTop: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`,
                                  textAlign: 'center',
                                  cursor: project.is_subtotal || project.is_total ? 'default' : 'text'
                                }}
                              >
                                {isAreaEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={areaEditValue}
                                    onChange={(e) => setAreaEditValue(e.target.value)}
                                    onBlur={saveAreaOnlyEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveAreaOnlyEdit();
                                      if (e.key === 'Escape') closeAreaEdit();
                                    }}
                                    autoFocus
                                    style={{
                                      width: '100%',
                                      height: 18,
                                      border: 'none',
                                      outline: 'none',
                                      background: 'transparent',
                                      color: 'inherit',
                                      fontSize: 8,
                                      textAlign: 'center'
                                    }}
                                  />
                                ) : (
                                  cellAreaValue ? `${cellAreaValue.toLocaleString('ru-RU')} м²` : ''
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        {date.getMonth() === 11 && (
                          <td style={{ ...yearTotalColumnStyle(false, false) }}>
                            {(() => {
                              const total = getYearAreaTotal(project, date.getFullYear());
                              return total ? total.toLocaleString('ru-RU') : '—';
                            })()}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Действия */}
                  <td style={{ ...cellStyle() }} />
                </tr>
              ))
            )}
            
            {/* Итоговые строки */}
            {filteredProjects.length > 0 && (
              <>
                {/* Итого в строительстве м² по месяцам */}
                <tr style={{ 
                  background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  borderTop: `2px solid ${isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.3)'}`
                }}>
                  <td 
                    colSpan={6}
                    style={{ 
                      ...cellStyle(false, true, fixedColumnOffsets.index, false, fixedColumnWidths.index + fixedColumnWidths.project + fixedColumnWidths.status + fixedColumnWidths.sections + fixedColumnWidths.area + fixedColumnWidths.duration),
                      fontWeight: 700,
                      fontSize: 12,
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
                      color: isDark ? '#fbbf24' : '#d97706'
                    }}
                  >
                    Итого в строительстве м² по месяцам
                  </td>
                  {filteredMonths.map((date, idx) => {
                    const constructionProjects = filteredProjects.filter(p => 
                      !p.is_subtotal && !p.is_total && p.current_status === 'Строительство'
                    );
                    const totalArea = constructionProjects.reduce((sum, project) => {
                      const milestones = getMilestones(project, date) || [];
                      const areaValue = milestones.find(m => m.area_value !== null && m.area_value !== undefined)?.area_value || 0;
                      return sum + areaValue;
                    }, 0);
                    
                    return (
                      <React.Fragment key={idx}>
                        <td style={{ 
                          ...cellStyle(false, false),
                          fontWeight: 700,
                          fontSize: 11,
                          background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                          color: totalArea > 0 ? (isDark ? '#fbbf24' : '#d97706') : 'var(--text-muted)'
                        }}>
                          {totalArea > 0 ? totalArea.toLocaleString('ru-RU') : '—'}
                        </td>
                        {date.getMonth() === 11 && (
                          <td style={{ 
                            ...yearTotalColumnStyle(false, false),
                            fontWeight: 700,
                            fontSize: 11,
                            background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                            color: isDark ? '#fbbf24' : '#d97706'
                          }}>
                            {(() => {
                              const yearTotal = constructionProjects.reduce((sum, project) => {
                                const total = getYearAreaTotal(project, date.getFullYear());
                                return sum + (total || 0);
                              }, 0);
                              return yearTotal > 0 ? yearTotal.toLocaleString('ru-RU') : '—';
                            })()}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <td style={{ 
                    ...cellStyle(),
                    background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)'
                  }} />
                </tr>

                {/* Итого в строительстве объектов */}
                <tr style={{ 
                  background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)'
                }}>
                  <td 
                    colSpan={6}
                    style={{ 
                      ...cellStyle(false, true, fixedColumnOffsets.index, false, fixedColumnWidths.index + fixedColumnWidths.project + fixedColumnWidths.status + fixedColumnWidths.sections + fixedColumnWidths.area + fixedColumnWidths.duration),
                      fontWeight: 700,
                      fontSize: 12,
                      textAlign: 'left',
                      padding: '10px 12px',
                      background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                      color: isDark ? '#fbbf24' : '#d97706'
                    }}
                  >
                    Итого в строительстве объектов
                  </td>
                  {filteredMonths.map((date, idx) => {
                    const constructionProjects = filteredProjects.filter(p => 
                      !p.is_subtotal && !p.is_total && p.current_status === 'Строительство'
                    );
                    const count = constructionProjects.filter(project => {
                      const milestones = getMilestones(project, date) || [];
                      return milestones.length > 0;
                    }).length;
                    
                    return (
                      <React.Fragment key={idx}>
                        <td style={{ 
                          ...cellStyle(false, false),
                          fontWeight: 700,
                          fontSize: 11,
                          background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
                          color: count > 0 ? (isDark ? '#fbbf24' : '#d97706') : 'var(--text-muted)'
                        }}>
                          {count > 0 ? count : '—'}
                        </td>
                        {date.getMonth() === 11 && (
                          <td style={{ 
                            ...yearTotalColumnStyle(false, false),
                            fontWeight: 700,
                            fontSize: 11,
                            background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
                            color: isDark ? '#fbbf24' : '#d97706'
                          }}>
                            {(() => {
                              const yearCount = constructionProjects.filter(project => {
                                const yearDates = filteredMonths.filter(d => d.getFullYear() === date.getFullYear());
                                return yearDates.some(d => {
                                  const milestones = getMilestones(project, d) || [];
                                  return milestones.length > 0;
                                });
                              }).length;
                              return yearCount > 0 ? yearCount : '—';
                            })()}
                          </td>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <td style={{ 
                    ...cellStyle(),
                    background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)'
                  }} />
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Table - Area by Status */}
      <div style={{ 
        marginTop: 24,
        background: isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        border: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(203, 213, 225, 0.6)'}`,
        boxShadow: isDark 
          ? '0 4px 24px rgba(0, 0, 0, 0.3)' 
          : '0 4px 24px rgba(0, 0, 0, 0.08)',
        padding: 16,
        maxWidth: 600
      }}>
        <h3 style={{ 
          fontSize: 16, 
          fontWeight: 600, 
          marginBottom: 12,
          color: 'var(--text-primary)'
        }}>
          ИТОГО
        </h3>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse'
        }}>
          <tbody>
            {STATUS_OPTIONS.map(status => {
              const total = filteredProjects
                .filter(p => !p.is_subtotal && !p.is_total && p.current_status === status)
                .reduce((sum, p) => sum + (p.sellable_area || 0), 0);
              
              const bgColor = status === 'Завершен' 
                ? '#fef08a'
                : status === 'Строительство'
                  ? '#fecaca'
                  : status === 'Проектирование, экспертиза, получение РНС'
                    ? '#fef3c7'
                    : 'transparent';
              
              return (
                <tr key={status} style={{ 
                  borderBottom: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
                }}>
                  <td style={{ 
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    background: bgColor,
                    borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
                  }}>
                    {status}
                  </td>
                  <td style={{ 
                    padding: '8px 12px',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'right',
                    color: 'var(--text-primary)',
                    background: bgColor
                  }}>
                    {total > 0 ? total.toLocaleString('ru-RU') : '—'}
                  </td>
                </tr>
              );
            })}
            
            {/* Стратегия 2026 */}
            <tr style={{ 
              borderBottom: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
            }}>
              <td style={{ 
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--text-primary)',
                borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
              }}>
                Стратегия 2026
              </td>
              <td style={{ 
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'right',
                color: 'var(--text-primary)'
              }}>
                {(() => {
                  const total = filteredProjects
                    .filter(p => !p.is_subtotal && !p.is_total)
                    .reduce((sum, p) => sum + (p.sellable_area || 0), 0);
                  return total > 0 ? total.toLocaleString('ru-RU') : '—';
                })()}
              </td>
            </tr>
            
            {/* Стратегия 2027 */}
            <tr>
              <td style={{ 
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 500,
                color: '#fff',
                background: '#dc2626',
                borderRight: `1px solid ${isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(226, 232, 240, 0.8)'}`
              }}>
                Стратегия 2027
              </td>
              <td style={{ 
                padding: '8px 12px',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'right',
                color: '#fff',
                background: '#dc2626'
              }}>
                —
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal Window */}
      {editingCell && (
        <>
          {/* Backdrop */}
          <div 
            style={{ 
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 99998,
              backdropFilter: 'blur(2px)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              closeEditModal();
            }}
          />
          {/* Modal */}
          <div style={{ 
            position: 'fixed', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 99999,
            background: isDark ? '#1e293b' : '#fff',
            padding: 20,
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            minWidth: 320,
            border: `2px solid ${isDark ? '#475569' : '#e2e8f0'}`
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ marginBottom: 12, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
              {editingCell && projects.find(p => p.id === editingCell.projectId)?.name.trim()}
            </div>
            <div style={{ marginBottom: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              {editingCell && formatMonth(editingCell.displayDate || new Date(editingCell.date))} {editingCell && (editingCell.displayDate || new Date(editingCell.date)).getFullYear()}
            </div>
            <select
              value={selectedMilestoneType}
              onChange={(e) => setSelectedMilestoneType(e.target.value)}
              style={{ marginBottom: 16, fontSize: 13, height: 40, width: '100%' }}
            >
              <option value="">— Выберите статус —</option>
              {Object.keys(MILESTONE_TYPES).map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={saveCellEdit} 
                style={{ 
                  flex: 2, 
                  height: 40,
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#2563eb'}
                onMouseLeave={(e) => e.target.style.background = '#3b82f6'}
              >
                Сохранить
              </button>
              <button 
                onClick={closeEditModal} 
                style={{ 
                  flex: 1, 
                  height: 40,
                  background: isDark ? '#475569' : '#e2e8f0',
                  color: isDark ? '#fff' : '#1e293b',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = isDark ? '#64748b' : '#cbd5e1'}
                onMouseLeave={(e) => e.target.style.background = isDark ? '#475569' : '#e2e8f0'}
              >
                ✕
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
};

export default StrategicMap;
