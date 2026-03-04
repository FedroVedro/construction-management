import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

const typeNamesRu = {
  document: 'Документация', hr: 'HR', procurement: 'Закупки',
  construction: 'Строительство', marketing: 'Маркетинг', preconstruction: 'ТЗ'
};

const AlertsPanel = ({ cityId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = cityId ? { city_id: cityId } : {};
        const res = await client.get('/dashboard/alerts', { params });
        setData(res.data);
      } catch (error) {
        showError('Ошибка загрузки оповещений');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [cityId, showError]);

  if (loading || !data) return null;
  const { missing_dates, overdue } = data;
  const hasAlerts = (missing_dates?.length || 0) + (overdue?.length || 0) > 0;
  if (!hasAlerts) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '12px' }}>Риски и оповещения</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {overdue?.length > 0 && (
          <div>
            <h4 style={{ color: '#dc3545', marginBottom: '8px' }}>Просроченные</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '13px' }}>
              {overdue.slice(0, 5).map((o) => (
                <li key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                  {o.city} — {o.construction_stage} (+{o.days_overdue} дн.)
                </li>
              ))}
            </ul>
          </div>
        )}
        {missing_dates?.length > 0 && (
          <div>
            <h4 style={{ color: '#ffc107', marginBottom: '8px' }}>Без дат</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '13px' }}>
              {missing_dates.slice(0, 5).map((m) => (
                <li key={m.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                  {m.city} — {typeNamesRu[m.type] || m.type}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertsPanel;
