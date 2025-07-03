import React, { useState, useEffect } from 'react';
import client from '../api/client';

const ConstructionStages = () => {
  const [stages, setStages] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingStage, setEditingStage] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    order_index: 0,
    is_active: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStages();
  }, []);

  const fetchStages = async () => {
    try {
      setLoading(true);
      const response = await client.get('/construction-stages');
      setStages(response.data);
    } catch (error) {
      console.error('Error fetching stages:', error);
      alert('Ошибка при загрузке этапов строительства');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStage) {
        await client.put(`/construction-stages/${editingStage.id}`, formData);
      } else {
        await client.post('/construction-stages', formData);
      }
      fetchStages();
      resetForm();
    } catch (error) {
      console.error('Error saving stage:', error);
      if (error.response?.data?.detail) {
        alert(`Ошибка: ${error.response.data.detail}`);
      } else {
        alert('Ошибка при сохранении этапа строительства');
      }
    }
  };

  const handleEdit = (stage) => {
    setEditingStage(stage);
    setFormData({
      name: stage.name,
      description: stage.description || '',
      order_index: stage.order_index,
      is_active: stage.is_active
    });
    setShowForm(true);
  };

  const handleDelete = async (stageId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот этап строительства?')) {
      try {
        const response = await client.delete(`/construction-stages/${stageId}`);
        if (response.data.message.includes('деактивирован')) {
          alert('Этап используется в графиках и был деактивирован');
        }
        fetchStages();
      } catch (error) {
        console.error('Error deleting stage:', error);
        alert('Ошибка при удалении этапа строительства');
      }
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;
    
    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];
    
    // Обновляем order_index локально
    newStages.forEach((stage, idx) => {
      stage.order_index = idx;
    });
    
    setStages(newStages);
    
    // Отправляем новый порядок на сервер
    try {
      await client.post('/construction-stages/reorder', newStages.map(s => s.id));
    } catch (error) {
      console.error('Error reordering stages:', error);
      fetchStages(); // Перезагружаем в случае ошибки
    }
  };

  const handleMoveDown = async (index) => {
    if (index === stages.length - 1) return;
    
    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    
    // Обновляем order_index локально
    newStages.forEach((stage, idx) => {
      stage.order_index = idx;
    });
    
    setStages(newStages);
    
    // Отправляем новый порядок на сервер
    try {
      await client.post('/construction-stages/reorder', newStages.map(s => s.id));
    } catch (error) {
      console.error('Error reordering stages:', error);
      fetchStages(); // Перезагружаем в случае ошибки
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingStage(null);
    setFormData({ name: '', description: '', order_index: 0, is_active: true });
  };

  if (loading) {
    return <div className="container-fluid"><h1>Загрузка...</h1></div>;
  }

  return (
    <div className="container-fluid">
      <h1>Управление этапами строительства</h1>
      
      <button 
        className="btn btn-primary" 
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: '20px' }}
      >
        {showForm ? 'Отмена' : 'Добавить этап'}
      </button>

      {showForm && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <h3>{editingStage ? 'Редактировать этап' : 'Новый этап строительства'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Название этапа *</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Описание</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Введите описание этапа"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ marginRight: '5px' }}
                />
                Активный этап
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                {editingStage ? 'Обновить' : 'Создать'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-full-width">
        <h3>Список этапов строительства</h3>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>Порядок</th>
                <th>Название</th>
                <th>Описание</th>
                <th style={{ width: '100px' }}>Статус</th>
                <th style={{ width: '120px' }}>Сортировка</th>
                <th style={{ width: '180px' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, index) => (
                <tr key={stage.id} style={{ 
                  opacity: stage.is_active ? 1 : 0.6,
                  backgroundColor: stage.is_active ? 'transparent' : '#f8f9fa'
                }}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>
                    <strong>{stage.name}</strong>
                    {!stage.is_active && <span style={{ color: '#dc3545', marginLeft: '10px' }}>(Неактивен)</span>}
                  </td>
                  <td>{stage.description || '-'}</td>
                  <td>
                    <span className={stage.is_active ? 'status-on-time' : 'status-delayed'}>
                      {stage.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      style={{ marginRight: '5px' }}
                      title="Переместить вверх"
                    >
                      ↑
                    </button>
                    <button 
                      className="btn btn-sm btn-secondary"
                      onClick={() => handleMoveDown(index)}
                      disabled={index === stages.length - 1}
                      title="Переместить вниз"
                    >
                      ↓
                    </button>
                  </td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleEdit(stage)}
                      style={{ marginRight: '5px' }}
                    >
                      Редактировать
                    </button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => handleDelete(stage.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {stages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            Нет этапов строительства. Нажмите "Добавить этап" для создания.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConstructionStages;