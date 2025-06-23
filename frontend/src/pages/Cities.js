import React, { useState, useEffect } from 'react';
import client from '../api/client';

const Cities = () => {
  const [cities, setCities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    departments: ''
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
      await client.post('/cities', formData);
      fetchCities();
      setShowForm(false);
      setFormData({ name: '', departments: '' });
    } catch (error) {
      console.error('Error creating city:', error);
      alert('Ошибка при создании города');
    }
  };

  return (
    <div className="container">
      <h1>Управление городами</h1>
      
      <button 
        className="btn btn-primary" 
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: '20px' }}
      >
        {showForm ? 'Отмена' : 'Добавить город'}
      </button>

      {showForm && (
        <div className="card">
          <h3>Новый город</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Название города</label>
              <input
                type="text"
                className="form-control"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Отделы (через запятую)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Отдел 1, Отдел 2, Отдел 3"
                value={formData.departments}
                onChange={(e) => setFormData({ ...formData, departments: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Создать</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Список городов</h3>
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Название</th>
              <th>Отделы</th>
              <th>Дата создания</th>
            </tr>
          </thead>
          <tbody>
            {cities.map(city => (
              <tr key={city.id}>
                <td>{city.id}</td>
                <td>{city.name}</td>
                <td>{city.departments}</td>
                <td>{new Date(city.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Cities;