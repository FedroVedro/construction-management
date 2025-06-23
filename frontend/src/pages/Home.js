import React, { useState, useEffect } from 'react';
import MasterCard from '../components/Dashboard/MasterCard';
import GanttChart from '../components/Dashboard/GanttChart';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const Home = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);
  const { user } = useAuth();

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

  return (
    <div className="container">
      <h1>Панель управления</h1>
      
      <div className="card">
        <div className="form-group">
          <label className="form-label">Выберите город</label>
          <select 
            className="form-control"
            value={selectedCity || ''}
            onChange={(e) => setSelectedCity(e.target.value || null)}
          >
            <option value="">Все города</option>
            {cities.map(city => (
              <option key={city.id} value={city.id}>{city.name}</option>
            ))}
          </select>
        </div>
      </div>

      <MasterCard cityId={selectedCity} />
      
      {(user?.role === 'admin' || user?.role === 'director') && (
        <GanttChart cityId={selectedCity} />
      )}
    </div>
  );
};

export default Home;