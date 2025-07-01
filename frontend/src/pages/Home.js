import React, { useState, useEffect } from 'react';
import MasterCard from '../components/Dashboard/MasterCard';
import CalendarGanttChart from '../components/Dashboard/CalendarGanttChart';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const [cities, setCities] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchCities();
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [selectedCity]);

  const fetchCities = async () => {
    try {
      const response = await client.get('/cities');
      setCities(response.data);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const params = selectedCity ? { city_id: selectedCity } : {};
      const response = await client.get('/schedules', { params });
      setSchedules(response.data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid">
      <h1>Панель управления</h1>
      
      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="form-group">
          <label className="form-label">Выберите объект строительства</label>
          <select 
            className="form-control"
            value={selectedCity || ''}
            onChange={(e) => setSelectedCity(e.target.value || null)}
          >
            <option value="">Все объекты</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>

      <MasterCard cityId={selectedCity} />
      
      {(user?.role === 'admin' || user?.role === 'director') && (
        <div className="card-full-width">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div>Загрузка графика...</div>
            </div>
          ) : (
            <CalendarGanttChart schedules={schedules} cities={cities} />
          )}
        </div>
      )}
    </div>
  );
};

export default Home;