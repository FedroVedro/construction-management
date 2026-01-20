import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';

const Cities = () => {
  const [cities, setCities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    visible_in_schedules: true
  });
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      setCities(response.data);
    } catch (error) {
      console.error('Error fetching cities:', error);
      showError('Ошибка при загрузке списка объектов');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCity) {
        await client.put(`/cities/${editingCity.id}`, formData);
        showSuccess('Объект строительства обновлён');
      } else {
        await client.post('/cities', formData);
        showSuccess('Объект строительства создан');
      }
      fetchCities();
      resetForm();
    } catch (error) {
      console.error('Error saving city:', error);
      showError('Ошибка при сохранении объекта строительства');
    }
  };

  const handleEdit = (city) => {
    setEditingCity(city);
    setFormData({
      name: city.name,
      description: city.description || '',
      visible_in_schedules: city.visible_in_schedules !== undefined ? city.visible_in_schedules : true
    });
    setShowForm(true);
  };

  const handleDelete = async (cityId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот объект строительства?')) {
      try {
        await client.delete(`/cities/${cityId}`);
        showSuccess('Объект строительства удалён');
        fetchCities();
      } catch (error) {
        console.error('Error deleting city:', error);
        showError('Ошибка при удалении объекта строительства');
      }
    }
  };

  const toggleVisibility = async (city) => {
    try {
      const newVisibility = !city.visible_in_schedules;
      await client.put(`/cities/${city.id}`, {
        name: city.name,
        description: city.description,
        visible_in_schedules: newVisibility
      });
      showSuccess(newVisibility ? 'Объект будет отображаться в графиках' : 'Объект скрыт из графиков');
      fetchCities();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      showError('Ошибка при изменении видимости объекта');
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCity(null);
    setFormData({ name: '', description: '', visible_in_schedules: true });
  };

  return (
    <div className="container-fluid">
      <h1>Управление объектами строительства</h1>
      
      <button 
        className="btn btn-primary" 
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: '20px' }}
      >
        {showForm ? 'Отмена' : '+ Добавить объект строительства'}
      </button>

      {showForm && (
        <div className="card" style={{ maxWidth: '800px' }}>
          <h3>{editingCity ? 'Редактировать объект строительства' : 'Новый объект строительства'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Название объекта</label>
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
                placeholder="Введите описание объекта строительства"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.visible_in_schedules}
                  onChange={(e) => setFormData({ ...formData, visible_in_schedules: e.target.checked })}
                  style={{ cursor: 'pointer' }}
                />
                <span>📊 Отображать в графиках отделов</span>
              </label>
              <small style={{ color: 'var(--text-muted)', marginLeft: '28px', display: 'block', marginTop: '4px' }}>
                Когда отключено, объект не будет отображаться в графиках отделов (HR, Закупки, Строительство и т.д.), 
                но останется видимым в Мастер-карте стратегического развития
              </small>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">
                {editingCity ? 'Обновить' : 'Создать'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card-full-width">
        <h3>Список объектов строительства</h3>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Описание</th>
                <th>Видимость в графиках</th>
                <th>Дата создания</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(city => (
                <tr key={city.id}>
                  <td>{city.id}</td>
                  <td>{city.name}</td>
                  <td>{city.description || '-'}</td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => toggleVisibility(city)}
                      style={{
                        backgroundColor: city.visible_in_schedules ? '#22c55e' : '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: '500',
                        transition: 'all 0.2s',
                        minWidth: '120px'
                      }}
                      title={city.visible_in_schedules ? 'Кликните, чтобы скрыть из графиков' : 'Кликните, чтобы показать в графиках'}
                    >
                      {city.visible_in_schedules ? '✓ Отображается' : '✕ Скрыт'}
                    </button>
                  </td>
                  <td>{new Date(city.created_at).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleEdit(city)}
                      style={{ marginRight: '5px' }}
                    >
                      ✏️ Редактировать
                    </button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => handleDelete(city.id)}
                    >
                      🗑️ Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {cities.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    Нет объектов строительства. Добавьте первый объект.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cities;
