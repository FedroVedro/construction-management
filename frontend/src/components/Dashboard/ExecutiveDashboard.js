import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatDate as formatDateUtil } from '../../utils/dateParser';

const typeNamesRu = {
  document: 'Документация',
  hr: 'HR',
  procurement: 'Закупки',
  construction: 'Строительство',
  marketing: 'Маркетинг',
  preconstruction: 'ТЗ'
};

const formatDate = (s) => {
  if (!s) return '';
  return formatDateUtil(s);
};

const ExecutiveDashboard = ({ cityId }) => {
  const [costData, setCostData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showError } = useToast();

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const params = cityId ? { city_id: cityId } : {};
        const [costRes, kpiRes] = await Promise.all([
          client.get('/dashboard/cost-summary', { params }),
          client.get('/dashboard/executive-kpis', { params })
        ]);
        setCostData(costRes.data);
        setKpis(kpiRes.data);
      } catch (error) {
        console.error('Error fetching executive dashboard:', error);
        showError('Ошибка при загрузке панели директора');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [cityId, showError]);

  if (loading) {
    return (
      <div className="card" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-spinner" style={{ width: '32px', height: '32px' }}></div>
      </div>
    );
  }

  const chartData = costData?.by_city?.length
    ? costData.by_city.map((c) => ({
        name: c.city_name,
        План: c.cost_plan,
        Факт: c.cost_fact
      }))
    : costData?.by_type?.map((t) => ({
        name: t.type_name,
        План: t.cost_plan,
        Факт: t.cost_fact
      })) || [];

  return (
    <div className="card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        Панель директора
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Топ задержек</h3>
          {kpis?.top_delays?.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {kpis.top_delays.map((d) => (
                <li
                  key={d.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {typeNamesRu[d.type] || d.type} — {d.construction_stage}
                  </span>
                  <span style={{ color: '#dc3545', fontWeight: 600 }}>+{d.delay_days} дн.</span>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Нет задержек</p>
          )}
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Ближайшие дедлайны (14 дн.)</h3>
          {kpis?.upcoming_deadlines?.length ? (
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {kpis.upcoming_deadlines.slice(0, 5).map((d) => (
                <li
                  key={d.id}
                  style={{
                    padding: '8px 0',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '13px'
                  }}
                >
                  {d.construction_stage} — {formatDate(d.planned_end)}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Нет предстоящих дедлайнов</p>
          )}
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ marginBottom: '12px' }}>Прогресс по этапам</h3>
          {kpis?.progress_by_stage?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {kpis.progress_by_stage.slice(0, 5).map((p) => (
                <div key={p.stage}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                    <span>{p.stage}</span>
                    <span>{p.completed}/{p.total} ({p.percent}%)</span>
                  </div>
                  <div
                    style={{
                      height: '8px',
                      backgroundColor: 'var(--table-stripe)',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  >
                    <div
                      style={{
                        width: `${p.percent}%`,
                        height: '100%',
                        backgroundColor: p.percent >= 80 ? '#28a745' : p.percent >= 50 ? '#ffc107' : '#dc3545',
                        transition: 'width 0.3s'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Нет данных</p>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ marginBottom: '12px' }}>План vs факт по бюджету</h3>
          <div style={{ height: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--text-muted)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)'
                  }}
                />
                <Legend />
                <Bar dataKey="План" fill="#6c757d" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Факт" fill="#007bff" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExecutiveDashboard;
