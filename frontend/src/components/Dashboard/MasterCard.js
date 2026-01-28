import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import client from '../../api/client';
import { useToast } from '../../context/ToastContext';

const typeNamesRu = {
  document: 'Выдача документации',
  hr: 'HR',
  procurement: 'Закупки',
  construction: 'Строительство'
};

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
  const [sortBy, setSortBy] = useState('stage'); // stage, status, delay
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const { showError } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const params = cityId ? { city_id: cityId } : {};
        const response = await client.get('/dashboard/master-card', { params });
        setData(response.data);
      } catch (error) {
        console.error('Error fetching master card data:', error);
        showError('Ошибка при загрузке мастер-карты');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [cityId, showError]);

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

  const getFilteredDeviations = () => {
    if (!data || !data.deviations) return [];
    
    let filtered = [...data.deviations];
    
    // Фильтрация по этапу
    if (selectedStage) {
      filtered = filtered.filter(item => item.construction_stage === selectedStage);
    }
    
    // Фильтрация по тексту
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(item => 
        item.construction_stage?.toLowerCase().includes(search) ||
        item.detail_info?.toLowerCase().includes(search)
      );
    }
    
    // Сортировка
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'stage':
          // Сортировка по order_index этапа
          const stageA = stages.find(s => s.name === a.construction_stage);
          const stageB = stages.find(s => s.name === b.construction_stage);
          const orderA = stageA ? stageA.order_index : 999;
          const orderB = stageB ? stageB.order_index : 999;
          comparison = orderA - orderB;
          break;
          
        case 'status':
          // Порядок: delayed -> on_time -> ahead
          const statusOrder = { delayed: 0, on_time: 1, ahead: 2 };
          comparison = (statusOrder[a.status] || 1) - (statusOrder[b.status] || 1);
          break;
          
        case 'delay':
          // Сортировка по отклонению в днях
          const delayA = a.delay_days || -(a.ahead_days || 0);
          const delayB = b.delay_days || -(b.ahead_days || 0);
          comparison = delayB - delayA; // Большие задержки сначала
          break;
          
        default:
          comparison = 0;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    return filtered;
  };

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

  if (loading) {
    return (
      <div className="card" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '200px',
        gap: '15px'
      }}>
        <div className="loading-spinner" style={{ width: '30px', height: '30px' }}></div>
        <span style={{ color: 'var(--text-muted)' }}>Загрузка мастер-карты...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <span style={{ fontSize: '48px', marginBottom: '15px', display: 'block' }}>📊</span>
        <p style={{ color: 'var(--text-muted)' }}>Нет данных для отображения</p>
      </div>
    );
  }

  const filteredStats = getFilteredStats();
  const pieData = [
    { name: 'В срок', value: filteredStats.on_time, color: '#28a745' },
    { name: 'С задержкой', value: filteredStats.delayed, color: '#dc3545' },
    { name: 'С опережением', value: filteredStats.ahead, color: '#17a2b8' },
  ];

  return (
    <div className="card">
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        📊 Мастер-карта отклонений
      </h2>
      <div style={{ display: 'flex', gap: '40px', marginTop: '20px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h3>Статистика</h3>
          <div style={{ 
            display: 'grid', 
            gap: '10px', 
            marginTop: '15px' 
          }}>
            <StatItem 
              label="Всего графиков" 
              value={filteredStats.total} 
              icon="📋"
            />
            <StatItem 
              label="В срок" 
              value={filteredStats.on_time} 
              color="#28a745"
              icon="✓"
            />
            <StatItem 
              label="С задержкой" 
              value={filteredStats.delayed} 
              color="#dc3545"
              icon="⚠"
            />
            <StatItem 
              label="С опережением" 
              value={filteredStats.ahead} 
              color="#17a2b8"
              icon="🚀"
            />
          </div>
        </div>
        <div style={{ flex: 1, height: '300px', minWidth: '250px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                innerRadius={40}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(0)}%` : ''}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <h3 style={{ marginTop: '30px' }}>Детальная информация</h3>

      {/* Блок фильтров и сортировки */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: 'var(--table-stripe)', 
        borderRadius: '8px',
        marginBottom: '15px',
        display: 'flex',
        gap: '15px',
        flexWrap: 'wrap',
        alignItems: 'flex-end'
      }}>
        <div style={{ minWidth: '220px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            📋 Этап строительства:
          </label>
          <select 
            value={selectedStage} 
            onChange={(e) => setSelectedStage(e.target.value)}
            className="form-control"
            style={{ fontSize: '14px' }}
          >
            <option value="">Все этапы</option>
            {stages.map(stage => (
              <option key={stage.id} value={stage.name}>
                {stage.order_index + 1}. {stage.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '200px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            🔍 Поиск:
          </label>
          <input
            type="text"
            placeholder="Поиск по этапу или информации..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="form-control"
            style={{ fontSize: '14px' }}
          />
        </div>

        {/* Разделитель */}
        <div style={{ width: '1px', height: '36px', backgroundColor: 'var(--border-color)', margin: '0 5px' }} />

        {/* Сортировка */}
        <div style={{ minWidth: '180px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
            📊 Сортировка:
          </label>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="form-control"
            style={{ fontSize: '14px' }}
          >
            <option value="stage">🏗️ По этапу</option>
            <option value="status">🚦 По статусу</option>
            <option value="delay">📅 По отклонению</option>
          </select>
        </div>

        {/* Направление сортировки */}
        <div>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="btn btn-secondary"
            style={{ 
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '14px'
            }}
            title={sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
            {sortOrder === 'asc' ? 'А-Я' : 'Я-А'}
          </button>
        </div>

        {(selectedStage || searchText) && (
          <button
            onClick={() => {
              setSelectedStage('');
              setSearchText('');
            }}
            className="btn btn-secondary"
            style={{ padding: '8px 12px' }}
          >
            ✕ Сбросить
          </button>
        )}
      </div>

      {(selectedStage || searchText) && (
        <div style={{ 
          marginBottom: '10px', 
          padding: '10px', 
          backgroundColor: 'rgba(0,123,255,0.1)',
          borderRadius: '4px',
          fontSize: '14px',
          color: 'var(--text-primary)'
        }}>
          Найдено записей: <strong>{getFilteredDeviations().length}</strong> из {data.deviations.length}
        </div>
      )}

      <div style={{ maxHeight: '400px', overflowY: 'auto', borderRadius: '8px' }}>
        <table className="table">
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--table-stripe)' }}>
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
                    style={{ fontSize: '12px', color: 'var(--text-muted)' }}
                  >
                    <strong>{getDetailFieldName(item.type)}:</strong>
                  </span>
                  {' '}
                  <span>{item.detail_info || '-'}</span>
                </td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    backgroundColor: item.status === 'on_time' ? '#d4edda' : 
                                    item.status === 'delayed' ? '#f8d7da' : '#d1ecf1',
                    color: item.status === 'on_time' ? '#28a745' : 
                           item.status === 'delayed' ? '#dc3545' : '#17a2b8'
                  }}>
                    {item.status === 'on_time' ? '✓ В срок' : 
                     item.status === 'delayed' ? '⚠ Задержка' : '🚀 Опережение'}
                  </span>
                </td>
                <td style={{ fontWeight: 600 }}>
                  <span style={{
                    color: item.delay_days ? '#dc3545' : item.ahead_days ? '#17a2b8' : 'var(--text-muted)'
                  }}>
                    {item.delay_days && `+${item.delay_days}`}
                    {item.ahead_days && `-${item.ahead_days}`}
                    {!item.delay_days && !item.ahead_days && '0'}
                  </span>
                </td>
              </tr>
            ))}
            {getFilteredDeviations().length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  Нет данных по выбранным критериям
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Компонент статистики
const StatItem = ({ label, value, color, icon }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    backgroundColor: color ? `${color}15` : 'var(--table-stripe)',
    borderRadius: '8px',
    borderLeft: color ? `3px solid ${color}` : 'none'
  }}>
    <span style={{ fontSize: '18px' }}>{icon}</span>
    <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{label}</span>
    <span style={{ 
      fontSize: '18px', 
      fontWeight: 700, 
      color: color || 'var(--text-primary)' 
    }}>
      {value}
    </span>
  </div>
);

export default MasterCard;
