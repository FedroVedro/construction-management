import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

const ExportDashboardButton = ({ cityId }) => {
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleExport = async () => {
    try {
      setLoading(true);
      const params = cityId ? { city_id: cityId } : {};
      const [mcRes, kpiRes, costRes, objRes] = await Promise.all([
        client.get('/dashboard/master-card', { params }),
        client.get('/dashboard/executive-kpis', { params }),
        client.get('/dashboard/cost-summary', { params }),
        client.get('/dashboard/object-comparison')
      ]);

      const wb = XLSX.utils.book_new();
      const mc = mcRes.data;
      const kpi = kpiRes.data;
      const cost = costRes.data;
      const obj = objRes.data;

      if (mc?.deviations?.length) {
        const deviationsData = mc.deviations.map((d) => ({
          'Этап': d.construction_stage,
          'Отдел': d.type,
          'Детали': d.detail_info,
          'Статус': d.status === 'delayed' ? 'Задержка' : d.status === 'ahead' ? 'Опережение' : 'В срок',
          'Отклонение (дн)': d.delay_days ?? d.ahead_days ?? 0
        }));
        const ws1 = XLSX.utils.json_to_sheet(deviationsData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Мастер-карта');
      }

      if (kpi?.top_delays?.length) {
        const delaysData = kpi.top_delays.map((d) => ({
          'Этап': d.construction_stage,
          'Отдел': d.type,
          'Задержка (дн)': d.delay_days
        }));
        const ws2 = XLSX.utils.json_to_sheet(delaysData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Топ задержек');
      }

      if (cost?.by_city?.length) {
        const costData = cost.by_city.map((c) => ({
          'Объект': c.city_name,
          'План': c.cost_plan,
          'Факт': c.cost_fact
        }));
        const ws3 = XLSX.utils.json_to_sheet(costData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Бюджет');
      }

      if (obj?.objects?.length) {
        const ws4 = XLSX.utils.json_to_sheet(obj.objects);
        XLSX.utils.book_append_sheet(wb, ws4, 'Сравнение объектов');
      }

      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `dashboard_${date}.xlsx`);
      showSuccess('Отчёт скачан');
    } catch (error) {
      console.error('Export error:', error);
      showError('Ошибка экспорта');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="btn btn-secondary"
      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
    >
      {loading ? (
        <span className="loading-spinner" style={{ width: '16px', height: '16px' }}></span>
      ) : (
        '📥'
      )}
      Скачать отчёт (Excel)
    </button>
  );
};

export default ExportDashboardButton;
