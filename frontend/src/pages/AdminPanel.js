import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'department_user',
    department: '',
    is_active: true,
    permissions: { view: [], edit: [] }
  });
  
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, deptsRes, permsRes] = await Promise.all([
        client.get('/users'),
        client.get('/users/departments/list'),
        client.get('/users/permissions/list')
      ]);
      setUsers(usersRes.data);
      setDepartments(deptsRes.data);
      setAvailablePermissions(permsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      showError('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      // Редактирование
      let permissions = { view: [], edit: [] };
      try {
        if (user.permissions) {
          permissions = JSON.parse(user.permissions);
        }
      } catch (e) {
        console.error('Error parsing permissions:', e);
      }
      
      setFormData({
        username: user.username,
        email: user.email,
        password: '',
        role: user.role,
        department: user.department || '',
        is_active: user.is_active !== false,
        permissions
      });
      setEditingUser(user);
    } else {
      // Создание нового
      setFormData({
        username: '',
        email: '',
        password: '',
        role: 'department_user',
        department: '',
        is_active: true,
        permissions: { view: [], edit: [] }
      });
      setEditingUser(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
  };

  const handlePermissionChange = (permId, type) => {
    setFormData(prev => {
      const newPerms = { ...prev.permissions };
      const list = newPerms[type] || [];
      
      if (list.includes(permId)) {
        newPerms[type] = list.filter(id => id !== permId);
        // Если убираем edit - убираем и view
        if (type === 'view') {
          newPerms.edit = (newPerms.edit || []).filter(id => id !== permId);
        }
      } else {
        newPerms[type] = [...list, permId];
        // Если добавляем edit - добавляем и view
        if (type === 'edit' && !newPerms.view.includes(permId)) {
          newPerms.view = [...(newPerms.view || []), permId];
        }
      }
      
      return { ...prev, permissions: newPerms };
    });
  };

  const handleSelectAllPermissions = (type) => {
    const allIds = availablePermissions.map(p => p.id);
    setFormData(prev => {
      const newPerms = { ...prev.permissions };
      const currentList = newPerms[type] || [];
      
      if (currentList.length === allIds.length) {
        // Снять все
        newPerms[type] = [];
        if (type === 'view') {
          newPerms.edit = [];
        }
      } else {
        // Выбрать все
        newPerms[type] = allIds;
        if (type === 'edit') {
          newPerms.view = allIds;
        }
      }
      
      return { ...prev, permissions: newPerms };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        ...formData,
        permissions: JSON.stringify(formData.permissions)
      };
      
      // Если пароль пустой при редактировании - не отправляем его
      if (editingUser && !data.password) {
        delete data.password;
      }
      
      if (editingUser) {
        await client.put(`/users/${editingUser.id}`, data);
        showSuccess('Пользователь обновлён');
      } else {
        if (!data.password) {
          showError('Укажите пароль');
          return;
        }
        await client.post('/users', data);
        showSuccess('Пользователь создан');
      }
      
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Error saving user:', error);
      showError(error.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleToggleActive = async (user) => {
    if (user.id === currentUser.id) {
      showError('Нельзя деактивировать свой аккаунт');
      return;
    }
    
    try {
      await client.put(`/users/${user.id}`, { is_active: !user.is_active });
      showSuccess(user.is_active ? 'Пользователь деактивирован' : 'Пользователь активирован');
      fetchData();
    } catch (error) {
      showError('Ошибка изменения статуса');
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: { bg: '#dc3545', text: 'Администратор' },
      director: { bg: '#007bff', text: 'Директор' },
      department_user: { bg: '#28a745', text: 'Сотрудник отдела' }
    };
    const style = styles[role] || { bg: '#6c757d', text: role };
    
    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        backgroundColor: `${style.bg}20`,
        color: style.bg,
        textTransform: 'uppercase'
      }}>
        {style.text}
      </span>
    );
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? `${dept.icon} ${dept.name}` : '-';
  };

  const getPermissionsSummary = (permissionsStr) => {
    if (!permissionsStr) return 'Не настроены';
    try {
      const perms = JSON.parse(permissionsStr);
      const viewCount = perms.view?.length || 0;
      const editCount = perms.edit?.length || 0;
      if (viewCount === 0 && editCount === 0) return 'Не настроены';
      return `👁 ${viewCount} / ✏️ ${editCount}`;
    } catch {
      return 'Не настроены';
    }
  };

  if (loading) {
    return (
      <div className="container-fluid" style={{ padding: '20px 40px' }}>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <div className="loading-spinner" style={{ width: '40px', height: '40px', margin: '0 auto' }}></div>
          <p style={{ marginTop: '15px', color: 'var(--text-muted)' }}>Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid" style={{ padding: '20px 40px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>👑</span>
            Админ-панель
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Управление пользователями, отделами и разрешениями на страницы
          </p>
        </div>
        
        <button 
          className="btn btn-primary"
          onClick={() => handleOpenModal()}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '12px 24px',
            fontSize: '15px'
          }}
        >
          <span style={{ fontSize: '18px' }}>➕</span>
          Добавить пользователя
        </button>
      </div>

      {/* Статистика */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <StatCard 
          icon="👥" 
          label="Всего пользователей" 
          value={users.length} 
          color="#007bff"
        />
        <StatCard 
          icon="✅" 
          label="Активных" 
          value={users.filter(u => u.is_active !== false).length} 
          color="#28a745"
        />
        <StatCard 
          icon="👑" 
          label="Администраторов" 
          value={users.filter(u => u.role === 'admin').length} 
          color="#dc3545"
        />
        <StatCard 
          icon="📋" 
          label="Директоров" 
          value={users.filter(u => u.role === 'director').length} 
          color="#0d6efd"
        />
        <StatCard 
          icon="🏢" 
          label="Отделов" 
          value={departments.length} 
          color="#6f42c1"
        />
        <StatCard 
          icon="🔐" 
          label="Страниц в разрешениях" 
          value={availablePermissions.length} 
          color="#20c997"
        />
      </div>

      {/* Быстрые ссылки на нововведения */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px' }}>⚡ Разделы системы</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <AdminQuickLink to="/" icon="📊" text="Панель управления" />
          <AdminQuickLink to="/strategic-map" icon="🗺️" text="Мастер-карта" />
          <AdminQuickLink to="/process-management" icon="📋" text="Процесс управления" />
          <AdminQuickLink to="/dependency-manager" icon="🔗" text="Зависимости" />
          <AdminQuickLink to="/document-schedule" icon="📄" text="График документации" />
          <AdminQuickLink to="/hr-schedule" icon="👥" text="HR-график" />
          <AdminQuickLink to="/procurement-schedule" icon="🛒" text="График закупок" />
          <AdminQuickLink to="/construction-schedule" icon="🔨" text="График строительства" />
          <AdminQuickLink to="/directive-schedule" icon="📊" text="Директивный график" />
          <AdminQuickLink to="/marketing-schedule" icon="📢" text="График маркетинга" />
          <AdminQuickLink to="/preconstruction-schedule" icon="📋" text="График ТЗ" />
          <AdminQuickLink to="/project-office" icon="📁" text="Проектный офис" />
          <AdminQuickLink to="/cities" icon="🏗️" text="Объекты" />
          <AdminQuickLink to="/construction-stages" icon="📋" text="Этапы" />
          {currentUser?.role === 'admin' && (
            <AdminQuickLink to="/telegram-settings" icon="📱" text="Telegram" />
          )}
        </div>
      </div>

      {/* Таблица пользователей */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Список пользователей</h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Отдел</th>
                <th>Разрешения</th>
                <th>Статус</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr 
                  key={user.id}
                  style={{ 
                    opacity: user.is_active === false ? 0.5 : 1,
                    backgroundColor: user.id === currentUser.id ? 'rgba(0,123,255,0.05)' : 'transparent'
                  }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        backgroundColor: user.role === 'admin' ? '#dc3545' : '#007bff',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '600'
                      }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600' }}>
                          {user.username}
                          {user.id === currentUser.id && (
                            <span style={{ 
                              marginLeft: '8px', 
                              fontSize: '11px', 
                              color: 'var(--text-muted)',
                              fontWeight: 'normal'
                            }}>
                              (вы)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{user.email}</td>
                  <td>{getRoleBadge(user.role)}</td>
                  <td>{getDepartmentName(user.department)}</td>
                  <td>
                    <span style={{ 
                      fontSize: '13px',
                      color: user.permissions ? 'var(--text-primary)' : 'var(--text-muted)'
                    }}>
                      {getPermissionsSummary(user.permissions)}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '600',
                      backgroundColor: user.is_active !== false ? '#d4edda' : '#f8d7da',
                      color: user.is_active !== false ? '#28a745' : '#dc3545'
                    }}>
                      {user.is_active !== false ? '✓ Активен' : '✕ Неактивен'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenModal(user)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '13px' }}
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      {user.id !== currentUser.id && (
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`btn ${user.is_active !== false ? 'btn-danger' : 'btn-success'}`}
                          style={{ padding: '6px 12px', fontSize: '13px' }}
                          title={user.is_active !== false ? 'Деактивировать' : 'Активировать'}
                        >
                          {user.is_active !== false ? '🚫' : '✅'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '24px',
            width: '100%',
            maxWidth: '700px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{ margin: 0 }}>
                {editingUser ? '✏️ Редактирование пользователя' : '➕ Новый пользователь'}
              </h2>
              <button
                onClick={handleCloseModal}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Основные данные */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div className="form-group">
                  <label className="form-label">👤 Логин *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    placeholder="login"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">📧 Email *</label>
                  <input
                    type="email"
                    className="form-control"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="user@company.ru"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">
                    🔑 Пароль {editingUser ? '(оставьте пустым, чтобы не менять)' : '*'}
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required={!editingUser}
                    placeholder="••••••••"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">👑 Роль *</label>
                  <select
                    className="form-control"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    required
                  >
                    <option value="department_user">Сотрудник отдела</option>
                    <option value="director">Директор</option>
                    <option value="admin">Администратор</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">🏢 Отдел</label>
                  <select
                    className="form-control"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    <option value="">Не указан</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.icon} {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '28px' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    cursor: 'pointer'
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      style={{ width: '18px', height: '18px' }}
                    />
                    <span>Активный аккаунт</span>
                  </label>
                </div>
              </div>

              {/* Разрешения */}
              <div style={{ 
                backgroundColor: 'var(--table-stripe)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '16px'
                }}>
                  <h4 style={{ margin: 0 }}>🔐 Разрешения на страницы</h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleSelectAllPermissions('view')}
                    >
                      {formData.permissions.view?.length === availablePermissions.length ? 'Снять все 👁' : 'Выбрать все 👁'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => handleSelectAllPermissions('edit')}
                    >
                      {formData.permissions.edit?.length === availablePermissions.length ? 'Снять все ✏️' : 'Выбрать все ✏️'}
                    </button>
                  </div>
                </div>
                
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '8px'
                }}>
                  {availablePermissions.map(perm => (
                    <div 
                      key={perm.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>{perm.icon}</span>
                        <span style={{ fontSize: '13px' }}>{perm.name}</span>
                      </span>
                      
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: formData.permissions.view?.includes(perm.id) ? '#28a745' : 'var(--text-muted)'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.permissions.view?.includes(perm.id) || false}
                            onChange={() => handlePermissionChange(perm.id, 'view')}
                          />
                          👁
                        </label>
                        
                        <label style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          color: formData.permissions.edit?.includes(perm.id) ? '#007bff' : 'var(--text-muted)'
                        }}>
                          <input
                            type="checkbox"
                            checked={formData.permissions.edit?.includes(perm.id) || false}
                            onChange={() => handlePermissionChange(perm.id, 'edit')}
                          />
                          ✏️
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div style={{ 
                  marginTop: '12px', 
                  fontSize: '12px', 
                  color: 'var(--text-muted)',
                  display: 'flex',
                  gap: '16px'
                }}>
                  <span>👁 — просмотр</span>
                  <span>✏️ — редактирование</span>
                </div>
              </div>

              {/* Кнопки */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleCloseModal}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// Компонент быстрой ссылки
const AdminQuickLink = ({ to, icon, text }) => (
  <Link
    to={to}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      color: 'var(--text-primary)',
      textDecoration: 'none',
      fontSize: '13px',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--table-hover)';
      e.currentTarget.style.borderColor = '#007bff';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
      e.currentTarget.style.borderColor = 'var(--border-color)';
    }}
  >
    <span style={{ fontSize: '16px' }}>{icon}</span>
    <span>{text}</span>
  </Link>
);

// Компонент статистики
const StatCard = ({ icon, label, value, color }) => (
  <div style={{
    padding: '20px',
    backgroundColor: 'var(--bg-card)',
    borderRadius: '12px',
    border: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      borderRadius: '12px',
      backgroundColor: `${color}15`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px'
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '24px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  </div>
);

export default AdminPanel;
