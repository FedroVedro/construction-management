import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const ProcessManagement = () => {
  const [roles, setRoles] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStage, setEditingStage] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [showAddStage, setShowAddStage] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [newStage, setNewStage] = useState({ number: '', name: '', predecessor_number: '' });
  const [newRole, setNewRole] = useState({ name: '', short_name: '' });

  const API_URL = 'http://localhost:8000/api/process-management';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rolesRes, stagesRes] = await Promise.all([
        axios.get(`${API_URL}/roles`),
        axios.get(`${API_URL}/stages`)
      ]);
      setRoles(rolesRes.data);
      setStages(stagesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Если данных нет, инициализируем
      if (error.response?.status === 404 || roles.length === 0) {
        try {
          await axios.post(`${API_URL}/init-default-data`);
          const [rolesRes, stagesRes] = await Promise.all([
            axios.get(`${API_URL}/roles`),
            axios.get(`${API_URL}/stages`)
          ]);
          setRoles(rolesRes.data);
          setStages(stagesRes.data);
        } catch (initError) {
          console.error('Error initializing data:', initError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Получить назначение для этапа и роли
  const getAssignment = (stageId, roleId) => {
    const stage = stages.find(s => s.id === stageId);
    if (!stage || !stage.assignments) return null;
    return stage.assignments.find(a => a.role_id === roleId);
  };

  // Обработка клика по ячейке
  const handleCellClick = async (stageId, roleId) => {
    const current = getAssignment(stageId, roleId);
    let newType = null;

    if (!current) {
      newType = 'approver'; // Согласующий
    } else if (current.assignment_type === 'approver') {
      newType = 'responsible'; // Ответственный
    } else {
      // Удаляем назначение
      try {
        await axios.delete(`${API_URL}/assignments/${stageId}/${roleId}`);
        fetchData();
      } catch (error) {
        console.error('Error deleting assignment:', error);
      }
      return;
    }

    try {
      await axios.post(`${API_URL}/assignments`, {
        stage_id: stageId,
        role_id: roleId,
        assignment_type: newType
      });
      fetchData();
    } catch (error) {
      console.error('Error updating assignment:', error);
    }
  };

  // Добавление этапа
  const handleAddStage = async () => {
    if (!newStage.number || !newStage.name) return;
    try {
      await axios.post(`${API_URL}/stages`, newStage);
      setNewStage({ number: '', name: '', predecessor_number: '' });
      setShowAddStage(false);
      fetchData();
    } catch (error) {
      console.error('Error adding stage:', error);
    }
  };

  // Обновление этапа
  const handleUpdateStage = async (stageId, data) => {
    try {
      await axios.put(`${API_URL}/stages/${stageId}`, data);
      setEditingStage(null);
      fetchData();
    } catch (error) {
      console.error('Error updating stage:', error);
    }
  };

  // Удаление этапа
  const handleDeleteStage = async (stageId) => {
    if (!window.confirm('Удалить этот этап?')) return;
    try {
      await axios.delete(`${API_URL}/stages/${stageId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  // Добавление роли
  const handleAddRole = async () => {
    if (!newRole.name) return;
    try {
      await axios.post(`${API_URL}/roles`, {
        ...newRole,
        order_index: roles.length
      });
      setNewRole({ name: '', short_name: '' });
      setShowAddRole(false);
      fetchData();
    } catch (error) {
      console.error('Error adding role:', error);
    }
  };

  // Обновление роли
  const handleUpdateRole = async (roleId, data) => {
    try {
      await axios.put(`${API_URL}/roles/${roleId}`, data);
      setEditingRole(null);
      fetchData();
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  // Удаление роли
  const handleDeleteRole = async (roleId) => {
    if (!window.confirm('Удалить эту роль?')) return;
    try {
      await axios.delete(`${API_URL}/roles/${roleId}`);
      fetchData();
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  };

  // Сброс и загрузка данных по умолчанию
  const handleResetData = async () => {
    if (!window.confirm('Сбросить все данные и загрузить этапы по умолчанию?')) return;
    try {
      setLoading(true);
      await axios.post(`${API_URL}/reset-data`);
      fetchData();
    } catch (error) {
      console.error('Error resetting data:', error);
    }
  };

  // Стили
  const styles = {
    container: {
      padding: '20px',
      fontFamily: "'Inter', -apple-system, sans-serif",
      maxWidth: '100%',
      overflowX: 'auto'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      flexWrap: 'wrap',
      gap: '10px'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      color: '#1e293b',
      margin: 0
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px'
    },
    button: {
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      fontSize: '13px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px'
    },
    primaryButton: {
      background: '#7b9eb8',
      color: '#fff'
    },
    secondaryButton: {
      background: '#f1f5f9',
      color: '#475569'
    },
    dangerButton: {
      background: '#d4a0a0',
      color: '#fff'
    },
    tableWrapper: {
      overflow: 'auto',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      maxHeight: 'calc(100vh - 220px)'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '12px',
      minWidth: '1200px'
    },
    th: {
      background: '#f8fafc',
      padding: '10px 8px',
      borderBottom: '2px solid #e2e8f0',
      borderRight: '1px solid #e2e8f0',
      fontWeight: '600',
      color: '#475569',
      textAlign: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 10,
      minWidth: '80px'
    },
    thNumber: {
      width: '40px',
      minWidth: '40px'
    },
    thStage: {
      minWidth: '300px',
      textAlign: 'left'
    },
    thPredecessor: {
      width: '80px',
      minWidth: '80px'
    },
    td: {
      padding: '8px',
      borderBottom: '1px solid #e2e8f0',
      borderRight: '1px solid #e2e8f0',
      textAlign: 'center',
      verticalAlign: 'middle'
    },
    tdStage: {
      textAlign: 'left',
      maxWidth: '400px'
    },
    cell: {
      minHeight: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      borderRadius: '4px',
      transition: 'all 0.15s ease'
    },
    cellApprover: {
      background: '#fef08a',
      color: '#854d0e',
      fontWeight: '600',
      padding: '4px 8px'
    },
    cellResponsible: {
      background: '#fff',
      border: '1px solid #d1d5db',
      color: '#374151',
      fontWeight: '500',
      padding: '4px 8px'
    },
    cellEmpty: {
      background: '#f9fafb',
      minHeight: '32px'
    },
    input: {
      padding: '6px 10px',
      border: '1px solid #d1d5db',
      borderRadius: '4px',
      fontSize: '12px',
      width: '100%'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: '#fff',
      padding: '24px',
      borderRadius: '12px',
      minWidth: '400px',
      maxWidth: '500px'
    },
    modalTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '16px',
      color: '#1e293b'
    },
    formGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      marginBottom: '6px',
      fontWeight: '500',
      color: '#475569',
      fontSize: '13px'
    },
    legend: {
      display: 'flex',
      gap: '20px',
      marginBottom: '16px',
      padding: '12px',
      background: '#f8fafc',
      borderRadius: '8px',
      fontSize: '12px'
    },
    legendItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    legendBox: {
      width: '60px',
      height: '24px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '10px',
      fontWeight: '600'
    },
    stageNumber: {
      fontWeight: '600',
      color: '#1e293b'
    },
    stageName: {
      color: '#475569'
    },
    parentStage: {
      background: '#f0f9ff',
      fontWeight: '600'
    },
    childStage: {
      paddingLeft: '20px'
    },
    actions: {
      display: 'flex',
      gap: '4px',
      marginLeft: '8px'
    },
    actionButton: {
      padding: '4px 8px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '11px',
      background: '#f1f5f9',
      color: '#64748b'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{ textAlign: 'center', padding: '40px' }}>
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>📋 Процесс управления циклом девелопмента</h1>
        <div style={styles.buttonGroup}>
          <button
            style={{ ...styles.button, ...styles.dangerButton }}
            onClick={handleResetData}
            title="Сбросить все данные и загрузить этапы по умолчанию"
          >
            🔄 Загрузить данные
          </button>
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={() => setShowAddRole(true)}
          >
            ➕ Добавить роль
          </button>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => setShowAddStage(true)}
          >
            ➕ Добавить этап
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legend}>
        <span style={{ fontWeight: '600', color: '#475569' }}>Легенда:</span>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendBox, ...styles.cellApprover }}>
            Согласующий
          </div>
          <span>— участвует в согласовании</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendBox, ...styles.cellResponsible }}>
            Ответственный
          </div>
          <span>— ответственный исполнитель</span>
        </div>
        <div style={styles.legendItem}>
          <span style={{ color: '#64748b' }}>💡 Кликните по ячейке для изменения роли</span>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.thNumber }}>№</th>
              <th style={{ ...styles.th, ...styles.thStage }}>Этапы процесса</th>
              <th style={{ ...styles.th, ...styles.thPredecessor }}>Предшеств. задача (№п)</th>
              {roles.map(role => (
                <th key={role.id} style={styles.th}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    {editingRole === role.id ? (
                      <input
                        style={{ ...styles.input, width: '80px' }}
                        value={role.name}
                        onChange={(e) => {
                          const updated = roles.map(r => 
                            r.id === role.id ? { ...r, name: e.target.value } : r
                          );
                          setRoles(updated);
                        }}
                        onBlur={() => handleUpdateRole(role.id, { name: role.name })}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateRole(role.id, { name: role.name })}
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => setEditingRole(role.id)}
                        style={{ cursor: 'pointer' }}
                        title="Кликните для редактирования"
                      >
                        {role.name}
                      </span>
                    )}
                    <button
                      style={{ ...styles.actionButton, fontSize: '10px', padding: '2px 6px' }}
                      onClick={() => handleDeleteRole(role.id)}
                      title="Удалить роль"
                    >
                      ✕
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => {
              const isParent = !stage.number.includes('.');
              return (
                <tr key={stage.id} style={isParent ? styles.parentStage : {}}>
                  <td style={styles.td}>
                    {editingStage === stage.id ? (
                      <input
                        style={{ ...styles.input, width: '40px' }}
                        value={stage.number}
                        onChange={(e) => {
                          const updated = stages.map(s =>
                            s.id === stage.id ? { ...s, number: e.target.value } : s
                          );
                          setStages(updated);
                        }}
                        onBlur={() => handleUpdateStage(stage.id, { number: stage.number })}
                        autoFocus
                      />
                    ) : (
                      <span
                        style={styles.stageNumber}
                        onClick={() => setEditingStage(stage.id)}
                        title="Кликните для редактирования"
                      >
                        {stage.number}
                      </span>
                    )}
                  </td>
                  <td style={{ ...styles.td, ...styles.tdStage }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={!isParent ? styles.childStage : {}}>
                        {editingStage === stage.id ? (
                          <input
                            style={{ ...styles.input, minWidth: '250px' }}
                            value={stage.name}
                            onChange={(e) => {
                              const updated = stages.map(s =>
                                s.id === stage.id ? { ...s, name: e.target.value } : s
                              );
                              setStages(updated);
                            }}
                            onBlur={() => handleUpdateStage(stage.id, { name: stage.name })}
                          />
                        ) : (
                          <span
                            style={isParent ? { fontWeight: '600' } : styles.stageName}
                            onClick={() => setEditingStage(stage.id)}
                            title="Кликните для редактирования"
                          >
                            {stage.name}
                          </span>
                        )}
                      </div>
                      <div style={styles.actions}>
                        <button
                          style={styles.actionButton}
                          onClick={() => handleDeleteStage(stage.id)}
                          title="Удалить этап"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </td>
                  <td style={styles.td}>
                    {editingStage === stage.id ? (
                      <input
                        style={{ ...styles.input, width: '60px' }}
                        value={stage.predecessor_number || ''}
                        onChange={(e) => {
                          const updated = stages.map(s =>
                            s.id === stage.id ? { ...s, predecessor_number: e.target.value } : s
                          );
                          setStages(updated);
                        }}
                        onBlur={() => handleUpdateStage(stage.id, { predecessor_number: stage.predecessor_number })}
                      />
                    ) : (
                      <span
                        onClick={() => setEditingStage(stage.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        {stage.predecessor_number || '-'}
                      </span>
                    )}
                  </td>
                  {roles.map(role => {
                    const assignment = getAssignment(stage.id, role.id);
                    return (
                      <td key={role.id} style={styles.td}>
                        <div
                          style={{
                            ...styles.cell,
                            ...(assignment?.assignment_type === 'approver'
                              ? styles.cellApprover
                              : assignment?.assignment_type === 'responsible'
                              ? styles.cellResponsible
                              : styles.cellEmpty)
                          }}
                          onClick={() => handleCellClick(stage.id, role.id)}
                          title={
                            assignment?.assignment_type === 'approver'
                              ? 'Согласующий (клик = Ответственный)'
                              : assignment?.assignment_type === 'responsible'
                              ? 'Ответственный (клик = убрать)'
                              : 'Пусто (клик = Согласующий)'
                          }
                        >
                          {assignment?.assignment_type === 'approver' && 'Согласующий'}
                          {assignment?.assignment_type === 'responsible' && 'Ответственный'}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Stage */}
      {showAddStage && (
        <div style={styles.modal} onClick={() => setShowAddStage(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Добавить этап</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Номер этапа *</label>
              <input
                style={styles.input}
                placeholder="Например: 1.9 или 3"
                value={newStage.number}
                onChange={(e) => setNewStage({ ...newStage, number: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Название этапа *</label>
              <input
                style={styles.input}
                placeholder="Название этапа процесса"
                value={newStage.name}
                onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Предшествующая задача (№п)</label>
              <input
                style={styles.input}
                placeholder="Например: 1.8"
                value={newStage.predecessor_number}
                onChange={(e) => setNewStage({ ...newStage, predecessor_number: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowAddStage(false)}
              >
                Отмена
              </button>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleAddStage}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Role */}
      {showAddRole && (
        <div style={styles.modal} onClick={() => setShowAddRole(false)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Добавить роль/должность</h3>
            <div style={styles.formGroup}>
              <label style={styles.label}>Название должности *</label>
              <input
                style={styles.input}
                placeholder="Например: Юрист"
                value={newRole.name}
                onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Сокращённое название</label>
              <input
                style={styles.input}
                placeholder="Например: ЮР"
                value={newRole.short_name}
                onChange={(e) => setNewRole({ ...newRole, short_name: e.target.value })}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={() => setShowAddRole(false)}
              >
                Отмена
              </button>
              <button
                style={{ ...styles.button, ...styles.primaryButton }}
                onClick={handleAddRole}
              >
                Добавить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessManagement;
