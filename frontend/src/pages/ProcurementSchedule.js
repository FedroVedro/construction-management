import React, { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const ProcurementSchedule = () => {
  const [schedules, setSchedules] = useState([]);
  const [cities, setCities] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    schedule_type: 'procurement',
    city_id: '',
    construction_stage: '',
    work_name: '',
    service: '',
    responsible_employee: '',
    contractor: '',
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
        params: { schedule_type: 'procurement' }
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
        schedule_type: 'procurement',
        city_id: '',
        construction_stage: '',
        work_name: '',
        service: '',
        responsible_employee: '',
        contractor: '',
        planned_start_date: '',
        planned_end_date: '',
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      alert('Ошибка при создании графика');
    }
  };

  return (
    <div className="container">
      <h1>График закупок</h1>
      
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
              <label className="form-label">Наименование работ</label>
              <input
                type="text"
                className="form-control"
                value={formData.work_name}
                onChange={(e) => setFormData({ ...formData, work_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Служба</label>
              <input
                type="text"
                className="form-control"
                value={formData.service}
                onChange={(e) => setFormData({ ...formData, service: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Ответственный сотрудник</label>
              <input
                type="text"
                className="form-control"
                value={formData.responsible_employee}
                onChange={(e) => setFormData({ ...formData, responsible_employee: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Контрагент</label>
              <input
                type="text"
                className="form-control"
                value={formData.contractor}
                onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
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
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Город</th>
                <th>Этап</th>
                <th>Работы</th>
                <th>Служба</th>
                <th>Ответственный</th>
                <th>Контрагент</th>
                <th>План начало</th>
                <th>План конец</th>
                <th>Факт начало</th>
                <th>Факт конец</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>{cities.find(c => c.id === schedule.city_id)?.name}</td>
                  <td>{schedule.construction_stage}</td>
                  <td>{schedule.work_name}</td>
                  <td>{schedule.service}</td>
                  <td>{schedule.responsible_employee}</td>
                  <td>{schedule.contractor}</td>
                  <td>{new Date(schedule.planned_start_date).toLocaleDateString()}</td>
                  <td>{new Date(schedule.planned_end_date).toLocaleDateString()}</td>
                  <td>{schedule.actual_start_date && new Date(schedule.actual_start_date).toLocaleDateString()}</td>
                  <td>{schedule.actual_end_date && new Date(schedule.actual_end_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProcurementSchedule;