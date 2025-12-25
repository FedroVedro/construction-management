// Утилиты для сохранения пользовательских настроек

const STORAGE_KEYS = {
  SELECTED_CITY: 'user_selected_city',
  LAST_PAGE: 'user_last_page',
  FILTERS: 'user_filters',
  VIEW_MODE: 'user_view_mode'
};

// Сохранение выбранного города
export const saveSelectedCity = (cityId) => {
  if (cityId) {
    localStorage.setItem(STORAGE_KEYS.SELECTED_CITY, cityId.toString());
  } else {
    localStorage.removeItem(STORAGE_KEYS.SELECTED_CITY);
  }
};

export const getSelectedCity = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.SELECTED_CITY);
  return saved ? parseInt(saved, 10) : null;
};

// Сохранение последней посещённой страницы
export const saveLastPage = (pagePath) => {
  localStorage.setItem(STORAGE_KEYS.LAST_PAGE, pagePath);
};

export const getLastPage = () => {
  return localStorage.getItem(STORAGE_KEYS.LAST_PAGE) || '/';
};

// Сохранение фильтров для страницы
export const savePageFilters = (pageName, filters) => {
  const allFilters = JSON.parse(localStorage.getItem(STORAGE_KEYS.FILTERS) || '{}');
  allFilters[pageName] = filters;
  localStorage.setItem(STORAGE_KEYS.FILTERS, JSON.stringify(allFilters));
};

export const getPageFilters = (pageName) => {
  const allFilters = JSON.parse(localStorage.getItem(STORAGE_KEYS.FILTERS) || '{}');
  return allFilters[pageName] || {};
};

// Сохранение режима просмотра (таблица/календарь)
export const saveViewMode = (pageName, mode) => {
  const allModes = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || '{}');
  allModes[pageName] = mode;
  localStorage.setItem(STORAGE_KEYS.VIEW_MODE, JSON.stringify(allModes));
};

export const getViewMode = (pageName, defaultMode = 'table') => {
  const allModes = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIEW_MODE) || '{}');
  return allModes[pageName] || defaultMode;
};

// Очистка всех настроек
export const clearAllPreferences = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

