import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import client from '../../api/client';

const typeNamesRu = {
  document: 'Выдача документации',
  hr: 'HR',
  procurement: 'Закупки',
  construction: 'Строительство'
};

// Названия полей для разных типов
const getDetailFieldName = (type) => {
  switch(type) {
    case 'document': return 'Разделы';
    case 'hr': return 'Вакансия';
    case 'procurement':
    case 'construction':
      return 'Наименование работ';
    default: return 'Информация';
  }
};

const MasterCard = ({ cityId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
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
    
    fetchData();
  }, [cityId]);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      const response = await client.get('/construction-stages?active_only=true');
      setStages(response.data);
    } catch (error) {
      console.error('Error fetching stages:', error);
    }
  };

  // Функция для фильтрации данных
  const getFilteredDeviations = () => {
    if (!data || !data.deviations) return [];
    
    let filtered = data.deviations;
    
    // Фильтр по этапу
    if (selectedStage) {
      filtered = filtered.filter(item => item.construction_stage === selectedStage);
    }
    
    // Поиск по тексту
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(item => 
        item.construction_stage?.toLowerCase().includes(search) ||
        item.detail_info?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };

  // Вычисляем статистику для отфильтрованных данных
  const getFilteredStats = () => {
    const filtered = getFilteredDeviations();
    
    const stats = {
      total: filtered.length,
      on_time: filtered.filter(item => item.status === 'on_time').length,
      delayed: filtered.filter(item => item.status === 'delayed').length,
      ahead: filtered.filter(item => item.status === 'ahead').length
    };
    
    return stats;
  };

  if (loading) return <div>Загрузка...</div>;
  if (!data) return <div>Нет данных</div>;

  const filteredStats = getFilteredStats();
  const pieData = [
    { name: 'В срок', value: filteredStats.on_time, color: '#28a745' },
    { name: 'С задержкой', value: filteredStats.delayed, color: '#dc3545' },
    { name: 'С опережением', value: filteredStats.ahead, color: '#17a2b8' },
  ];

  return (
    <div className="card">
      <h2>Мастер-карта отклонений</h2>
      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <h3>Статистика</h3>
          <p>Всего графиков: {filteredStats.total}</p>
          <p className="status-on-time">В срок: {filteredStats.on_time}</p>
          <p className="status-delayed">С задержкой: {filteredStats.delayed}</p>
          <p className="status-ahead">С опережением: {filteredStats.ahead}</p>
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

      {/* Блок фильтров */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: '#f8f9fa', 
        borderRadius: '4px',
        marginBottom: '15px',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {/* Фильтр по этапу строительства */}
        <div style={{ minWidth: '250px' }}>
          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
            Этап строительства:
          </label>
          <select 
            value={selectedStage} 
            onChange={(e) => setSelectedStage(e.target.value)}
            style={{ 
              padding: '6px 10px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              width: '100%',
              fontSize: '14px'
            }}
          >
            <option value="">Все этапы</option>
            {stages.map(stage => (
              <option key={stage.id} value={stage.name}>
                {stage.order_index + 1}. {stage.name}
              </option>
            ))}
          </select>
        </div>

        {/* Поиск */}
        <div style={{ minWidth: '250px' }}>
          <label style={{ fontSize: '12px', color: '#666', display: 'block', marginBottom: '4px' }}>
            Поиск:
          </label>
          <input
            type="text"
            placeholder="Поиск по этапу или информации..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ 
              padding: '6px 10px', 
              borderRadius: '4px', 
              border: '1px solid #ddd',
              width: '100%',
              fontSize: '14px'
            }}
          />
        </div>

        {/* Кнопка сброса фильтров */}
        {(selectedStage || searchText) && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setSelectedStage('');
                setSearchText('');
              }}
              className="btn btn-secondary"
              style={{ marginTop: '18px' }}
            >
              Сбросить фильтры
            </button>
          </div>
        )}
      </div>

      {/* Информация о результатах фильтрации */}
      {(selectedStage || searchText) && (
        <div style={{ 
          marginBottom: '10px', 
          padding: '10px', 
          backgroundColor: '#e3f2fd',
          borderRadius: '4px',
          fontSize: '14px'
        }}>
          Найдено записей: <strong>{getFilteredDeviations().length}</strong> из {data.deviations.length}
        </div>
      )}

      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Этап</th>
              <th>Отдел</th>
              <th style={{ minWidth: '150px' }}>Детали</th>
              <th>Статус</th>
              <th>Отклонение (дни)</th>
            </tr>
          </thead>
          <tbody>
            {getFilteredDeviations().map((item) => (
              <tr key={item.id}>
                <td>{item.construction_stage}</td>
                <td>{typeNamesRu[item.type] || item.type}</td>
                <td style={{ 
                  maxWidth: '300px', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  <span 
                    title={`${getDetailFieldName(item.type)}: ${item.detail_info || 'Не указано'}`}
                    style={{ fontSize: '12px', color: '#666' }}
                  >
                    <strong>{getDetailFieldName(item.type)}:</strong>
                  </span>
                  {' '}
                  <span>{item.detail_info || '-'}</span>
                </td>
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