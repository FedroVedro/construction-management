/**
 * Обновление графика с учётом каскада для связанных задач.
 * При перетаскивании на диаграмме Ганта связанные задачи сдвигаются вместе.
 */
import client from '../api/client';

/**
 * Создаёт обработчик обновления с каскадом.
 * @param {Object} options
 * @param {Function} options.fetchSchedules - функция перезагрузки графиков
 * @param {Function} options.showError - показ ошибки
 * @param {number|null} options.cityId - ID объекта (для фильтрации графа)
 */
export const createScheduleUpdateHandler = ({ fetchSchedules, showError, cityId = null }) => {
  return async (scheduleId, updates) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const params = cityId ? { city_id: cityId } : {};
      const depsRes = await client.get('/dependencies/dependency-graph', { params, signal: controller.signal });
      const hasSuccessors = depsRes.data?.edges?.some((e) => e.source === scheduleId) ?? false;

      if (hasSuccessors && updates.actual_start_date && updates.actual_end_date) {
        await client.post(
          '/dependencies/cascade-update',
          {
            schedule_id: scheduleId,
            actual_start_date: updates.actual_start_date,
            actual_end_date: updates.actual_end_date,
            use_actual_dates: true
          },
          { signal: controller.signal, timeout: 10000 }
        );
      } else {
        await client.put(`/schedules/${scheduleId}`, updates, { signal: controller.signal });
      }

      clearTimeout(timeoutId);
      if (fetchSchedules) {
        await fetchSchedules();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        showError?.('Превышено время ожидания сохранения');
      } else if (error.response?.status) {
        showError?.(error.response?.data?.detail || 'Ошибка при сохранении дат');
      } else {
        showError?.('Ошибка при обновлении дат');
      }
      throw error;
    }
  };
};
