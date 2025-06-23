import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const DocumentSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    schedule_type: 'document',
    city_id: '',
    construction_stage: '',
    sections: '',
    planned_start_date: '',
    planned_end_date: '',
  });
  const { user } = useAuth();

  useEffect(() => {
    fetchSchedules();
    fetchCities();
  }, []);

  const fetchSchedules = async () => {
    try {
      const response = await client.get('/schedules', {
        params: { schedule_type: 'document' }
      });
      setSchedules(response.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    }
  };

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
      await client.post('/schedules', formData);
      fetchSchedules();
      setShowForm(false);
      setFormData({
        schedule_type: 'document',
        city_id: '',
        construction_stage: '',
        sections: '',
        planned_start_date: '',
        planned_end_date: '',
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Ошибка при создании графика');
    }
  };

  const handleUpdate = async (id, actualDate, type) => {
    try {
      const updateData = {};
      if (type === 'start') {
        updateData.actual_start_date = actualDate;
      } else {
        updateData.actual_end_date = actualDate;
      }
      await client.put(`/schedules/${id}`, updateData);
      fetchSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  return (
    <div className="container">
      <h1>График выдачи рабочей документации</h1>
      
      {user?.role !== 'director' && (
        <button 
          className="btn btn-primary" 
          onClick={() => setShowForm(!showForm)}
          style={{ marginBottom: '20px' }}
        >
          {showForm ? 'Отмена' : 'Добавить запись'}
        </button>
      )}

      {showForm && (
        <div className="card">
          <h3>Новая запись</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Город</label>
              <select
                className="form-control"
                value={formData.city_id}
                onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                required
              >
                <option value="">Выберите город</option>
                {cities.map(city => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Этап строительства</label>
              <input
                type="text"
                className="form-control"
                value={formData.construction_stage}
                onChange={(e) => setFormData({ ...formData, construction_stage: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Разделы</label>
              <textarea
                className="form-control"
                value={formData.sections}
                onChange={(e) => setFormData({ ...formData, sections: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Плановая дата начала</label>
              <input
                type="date"
                className="form-control"
                value={formData.planned_start_date}
                onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Плановая дата окончания</label>
              <input
                type="date"
                className="form-control"
                value={formData.planned_end_date}
                onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">Создать</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Список графиков</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Город</th>
              <th>Этап</th>
              <th>Разделы</th>
              <th>План начало</th>
              <th>План конец</th>
              <th>Факт начало</th>
              <th>Факт конец</th>
              {user?.role !== 'director' && <th>Действия</th>}
            </tr>
          </thead>
          <tbody>
            {schedules.map(schedule => (
              <tr key={schedule.id}>
                <td>{cities.find(c => c.id === schedule.city_id)?.name}</td>
                <td>{schedule.construction_stage}</td>
                <td>{schedule.sections}</td>
                <td>{new Date(schedule.planned_start_date).toLocaleDateString()}</td>
                <td>{new Date(schedule.planned_end_date).toLocaleDateString()}</td>
                <td>
                  {schedule.actual_start_date ? 
                    new Date(schedule.actual_start_date).toLocaleDateString() :
                    user?.role !== 'director' && (
                      <input
                        type="date"
                        onChange={(e) => handleUpdate(schedule.id, e.target.value, 'start')}
                      />
                    )
                  }
                </td>
                <td>
                  {schedule.actual_end_date ? 
                    new Date(schedule.actual_end_date).toLocaleDateString() :
                    user?.role !== 'director' && (
                      <input
                        type="date"
                        onChange={(e) => handleUpdate(schedule.id, e.target.value, 'end')}
                      />
                    )
                  }
                </td>
                {user?.role !== 'director' && (
                  <td>
                    <button 
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm('Удалить запись?')) {
                          client.delete(`/schedules/${schedule.id}`).then(() => fetchSchedules());
                        }
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DocumentSchedule;