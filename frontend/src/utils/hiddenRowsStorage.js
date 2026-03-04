const STORAGE_KEY_PREFIX = 'hidden_rows_';
const COLLAPSED_PREFIX = 'outline_collapsed_';

export const saveHiddenRows = (cityId, scheduleType, hiddenIds) => {
  const key = `${STORAGE_KEY_PREFIX}${cityId}_${scheduleType}`;
  localStorage.setItem(key, JSON.stringify([...hiddenIds]));
};

export const getHiddenRows = (cityId, scheduleType) => {
  const key = `${STORAGE_KEY_PREFIX}${cityId}_${scheduleType}`;
  const stored = localStorage.getItem(key);
  return stored ? new Set(JSON.parse(stored)) : new Set();
};

export const saveCollapsedGroups = (cityId, scheduleType, collapsedIds) => {
  const key = `${COLLAPSED_PREFIX}${cityId}_${scheduleType}`;
  localStorage.setItem(key, JSON.stringify([...collapsedIds]));
};

export const getCollapsedGroups = (cityId, scheduleType) => {
  const key = `${COLLAPSED_PREFIX}${cityId}_${scheduleType}`;
  const stored = localStorage.getItem(key);
  return stored ? new Set(JSON.parse(stored)) : new Set();
};
