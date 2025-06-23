import React, { useState, useEffect } from 'react';
import GanttChart from '../components/Dashboard/GanttChart';
import client from '../api/client';

const DirectiveSchedule = () => {
  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null);

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
      <h1>Директивный агрегированный график</h1>
      
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

      <GanttChart cityId={selectedCity} />
    </div>
  );
};

export default DirectiveSchedule;