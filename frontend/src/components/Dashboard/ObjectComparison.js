import React, { useEffect, useState } from 'react';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

const ObjectComparison = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    client.get('/dashboard/object-comparison')
      .then((res) => setData(res.data))
      .catch(() => showError('Ошибка загрузки сравнения'))
      .finally(() => setLoading(false));
  }, [showError]);

  if (loading || !data?.objects?.length) return null;

  return (
    <div className="card">
      <h3 style={{ marginBottom: '12px' }}>Сравнение объектов</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ fontSize: '13px' }}>
          <thead>
            <tr>
              <th>Объект</th>
              <th style={{ textAlign: 'center' }}>Задержек</th>
              <th style={{ textAlign: 'center' }}>В срок</th>
              <th style={{ textAlign: 'center' }}>Опережение</th>
              <th style={{ textAlign: 'right' }}>План</th>
              <th style={{ textAlign: 'right' }}>Факт</th>
              <th style={{ textAlign: 'center' }}>% готовности</th>
            </tr>
          </thead>
          <tbody>
            {data.objects.map((o) => (
              <tr key={o.city_id}>
                <td>{o.city_name}</td>
                <td style={{ textAlign: 'center', color: o.delayed ? '#dc3545' : undefined }}>{o.delayed}</td>
                <td style={{ textAlign: 'center', color: '#28a745' }}>{o.on_time}</td>
                <td style={{ textAlign: 'center', color: '#17a2b8' }}>{o.ahead}</td>
                <td style={{ textAlign: 'right' }}>{o.cost_plan?.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{o.cost_fact?.toLocaleString()}</td>
                <td style={{ textAlign: 'center' }}>{o.percent_done}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ObjectComparison;
