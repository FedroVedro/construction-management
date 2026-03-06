import axios from 'axios';

// Используем переменную окружения или fallback на localhost для разработки
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const client = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  withCredentials: true, // httpOnly cookie отправляется автоматически
});

// Флаг для предотвращения множественных редиректов при 401
let isRedirecting = false;

// Токен в заголовке не нужен — сессия в httpOnly cookie
client.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      console.error('Network error:', error.message);
    }
    // Не редиректить при 401 от /auth/me — иначе бесконечная перезагрузка
    // (AuthContext сам обработает и установит user = null, PrivateRoute перенаправит)
    const isAuthCheck = error.config?.url?.includes('auth/me');
    if (error.response?.status === 401 && !isAuthCheck && !isRedirecting) {
      isRedirecting = true;
      window.dispatchEvent(new CustomEvent('auth:session-expired'));
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default client;