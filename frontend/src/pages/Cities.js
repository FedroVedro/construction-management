import React, { useState, useEffect } from 'react';
import client from '../api/client';

const Cities = () => {
  const [cities, setCities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  useEffect(() => {
    fetchCities();
  }, []);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      setCities(response.data);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCity) {
        await client.put(`/cities/${editingCity.id}`, formData);
      } else {
        await client.post('/cities', formData);
      }
      fetchCities();
      resetForm();
    } catch (error) {
      console.error('Error saving city:', error);
      alert('Ошибка при сохранении объекта строительства');
    }
  };

  const handleEdit = (city) => {
    setEditingCity(city);
    setFormData({
      name: city.name,
      description: city.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (cityId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот объект строительства?')) {
      try {
        await client.delete(`/cities/${cityId}`);
        fetchCities();
      } catch (error) {
        console.error('Error deleting city:', error);
        alert('Ошибка при удалении объекта строительства');
      }
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCity(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="container-fluid">
      <h1>Управление объектами строительства</h1>
      
      <button 
        className="btn btn-primary" 
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: '20px' }}
      >
        {showForm ? 'Отмена' : 'Добавить объект строительства'}
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
                  <td>{new Date(city.created_at).toLocaleDateString()}</td>
                  <td>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => handleEdit(city)}
                      style={{ marginRight: '5px' }}
                    >
                      Редактировать
                    </button>
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={() => handleDelete(city.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Cities;