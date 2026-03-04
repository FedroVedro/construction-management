import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

// Маппинг путей к названиям страниц
const PAGE_NAMES = {
  '': 'Панель управления',
  'cities': 'Объекты строительства',
  'construction-stages': 'Этапы строительства',
  'document-schedule': 'График выдачи документации',
  'hr-schedule': 'HR-график',
  'procurement-schedule': 'График закупок',
  'construction-schedule': 'График строительства',
  'directive-schedule': 'Директивный график',
  'marketing-schedule': 'График маркетинга и продаж',
  'project-office': 'Проектный офис',
  'telegram-settings': 'Настройки Telegram',
  'admin': 'Админ-панель',
  'strategic-map': 'Мастер-карта',
  'process-management': 'Процесс управления',
  'dependency-manager': 'Зависимости задач',
  'preconstruction-schedule': 'График ТЗ',
  'directive-schedule': 'Директивный график'
};

const Breadcrumbs = () => {
  const location = useLocation();
  const { isDark } = useTheme();
  
  // Разбираем путь на части
  const pathnames = location.pathname.split('/').filter(x => x);
  
  // Если мы на главной, не показываем breadcrumbs
  if (pathnames.length === 0) {
    return null;
  }
  
  const currentPage = PAGE_NAMES[pathnames[0]] || pathnames[0];
  
  return (
    <nav style={{
      padding: '12px 0',
      marginBottom: '10px',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <Link 
        to="/" 
        style={{ 
          color: isDark ? '#6aa5ff' : '#007bff',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}
      >
        <span style={{ fontSize: '16px' }}>🏠</span>
        <span>Главная</span>
      </Link>
      
      <span style={{ 
        color: isDark ? '#6c757d' : '#6c757d',
        fontSize: '12px'
      }}>
        ›
      </span>
      
      <span style={{ 
        color: isDark ? '#e8e8e8' : '#495057',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        {getPageIcon(pathnames[0])}
        {currentPage}
      </span>
    </nav>
  );
};

// Получение иконки для страницы
const getPageIcon = (path) => {
  const icons = {
    'cities': '🏗️',
    'construction-stages': '📋',
    'document-schedule': '📄',
    'hr-schedule': '👥',
    'procurement-schedule': '🛒',
    'construction-schedule': '🔨',
    'directive-schedule': '📊',
    'marketing-schedule': '📈',
    'project-office': '📁',
    'telegram-settings': '📱',
    'admin': '👑',
    'strategic-map': '🗺️',
    'process-management': '⚙️',
    'dependency-manager': '🔗',
    'preconstruction-schedule': '📋',
    'directive-schedule': '📊'
  };
  return icons[path] || '📌';
};

export default Breadcrumbs;

