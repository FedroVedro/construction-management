import axios from 'axios';

// Используем переменную окружения или fallback на localhost для разработки
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000, // Timeout чтобы запросы не висели бесконечно
});

// Флаг для предотвращения множественных редиректов при 401
let isRedirecting = false;

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Обработка сетевых ошибок (нет ответа от сервера)
    if (!error.response) {
      console.error('Network error:', error.message);
      // Пользователь увидит ошибку через toast в компонентах
    }
    
    // Обработка 401 с защитой от race condition
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      // Сбрасываем флаг через задержку
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default client;