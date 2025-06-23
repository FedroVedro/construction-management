import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import client from '../../api/client';

const MasterCard = ({ cityId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [cityId]);

  const fetchData = async () => {
    try {
      const params = cityId ? { city_id: cityId } : {};
      const response = await client.get('/dashboard/master-card', { params });
      setData(response.data);
    } catch (error) {
      console.error('Error fetching master card data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (!data) return <div>Нет данных</div>;

  const pieData = [
    { name: 'В срок', value: data.on_time, color: '#28a745' },
    { name: 'С задержкой', value: data.delayed, color: '#dc3545' },
    { name: 'С опережением', value: data.ahead, color: '#17a2b8' },
  ];

  return (
    <div className="card">
      <h2>Мастер-карта отклонений</h2>
      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>Статистика</h3>
          <p>Всего графиков: {data.total_schedules}</p>
          <p className="status-on-time">В срок: {data.on_time}</p>
          <p className="status-delayed">С задержкой: {data.delayed}</p>
          <p className="status-ahead">С опережением: {data.ahead}</p>
        </div>
        <div style={{ flex: 1, height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <h3 style={{ marginTop: '30px' }}>Детальная информация</h3>
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Этап</th>
              <th>Тип</th>
              <th>Статус</th>
              <th>Отклонение (дни)</th>
            </tr>
          </thead>
          <tbody>
            {data.deviations.map((item) => (
              <tr key={item.id}>
                <td>{item.construction_stage}</td>
                <td>{item.type}</td>
                <td className={`status-${item.status.replace('_', '-')}`}>
                  {item.status === 'on_time' ? 'В срок' : 
                   item.status === 'delayed' ? 'Задержка' : 'Опережение'}
                </td>
                <td>
                  {item.delay_days && `+${item.delay_days}`}
                  {item.ahead_days && `-${item.ahead_days}`}
                  {!item.delay_days && !item.ahead_days && '0'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MasterCard;