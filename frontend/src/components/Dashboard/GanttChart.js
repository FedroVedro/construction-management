import React, { useEffect, useState } from 'react';
import client from '../../api/client';

const GanttChart = ({ cityId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = cityId ? { city_id: cityId } : {};
        const response = await client.get('/dashboard/gantt-data', { params });
        setData(response.data);
      } catch (error) {
        console.error('Error fetching gantt data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [cityId]);

  const getColor = (type) => {
    const colors = {
      document: '#6B9BD1',
      hr: '#6BC788',
      procurement: '#D4A76A',
      construction: '#D97B7B',
    };
    return colors[type] || '#95a5a6';
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="card">
      <h2>Директивный график (Gantt Chart)</h2>
      <div style={{ marginTop: '20px', overflowX: 'auto' }}>
        <div style={{ minWidth: '800px' }}>
          {data.map((task) => (
            <div key={task.id} style={{ marginBottom: '10px' }}>
              <div style={{ marginBottom: '5px' }}>
                <strong>{task.name}</strong> - Прогресс: {task.progress}%
              </div>
              <div style={{ 
                position: 'relative', 
                height: '30px', 
                backgroundColor: '#ecf0f1',
                borderRadius: '4px',
              }}>
                <div style={{
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  height: '100%',
                  width: `${task.progress}%`,
                  backgroundColor: getColor(task.type),
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }}></div>
              </div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
                План: {new Date(task.start).toLocaleDateString()} - {new Date(task.end).toLocaleDateString()}
                {task.actualStart && ` | Факт начало: ${new Date(task.actualStart).toLocaleDateString()}`}
                {task.actualEnd && ` | Факт конец: ${new Date(task.actualEnd).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;