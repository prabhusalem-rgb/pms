'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useMemo } from 'react';
import { useProject } from '@/context/ProjectContext';
import { useAuth } from '@/context/AuthContext';
import { db, Task, BOQItem, User } from '@/lib/db';

export default function TasksPage() {
  const { activeProject, activeProjectId } = useProject();
  const { currentUser, canWrite, canAccess } = useAuth();
  
  // Guard access
  const hasAccess = canAccess('tasks'); // General access
  const hasWriteAccess = canWrite('tasks'); // Write access

  // State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // View mode
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [boqFilter, setBoqFilter] = useState<string>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Collaboration / Group Chat States
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [attachment, setAttachment] = useState<{ name: string; data: string } | null>(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo' as Task['status'],
    priority: 'medium' as Task['priority'],
    assigned_to: '',
    due_date: new Date().toISOString().split('T')[0],
    boq_item_id: '',
    progress: 0,
    estimated_hours: 0,
    actual_hours: 0
  });

  // Drag and drop feedback state
  const [draggingOverColumn, setDraggingOverColumn] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    if (activeProjectId) {
      setTasks(db.getTasks(activeProjectId));
      setBoqItems(db.getBOQItems(activeProjectId));
    } else {
      setTasks([]);
      setBoqItems([]);
    }
    setUsers(db.getUsers());
    if (selectedTask) {
      setMessages(db.getTaskMessages(selectedTask.id));
    }
  }, [activeProjectId, selectedTask]);

  // Handle reload from db listener
  useEffect(() => {
    const unsubscribe = db.subscribe(() => {
      if (activeProjectId) {
        setTasks(db.getTasks(activeProjectId));
        setBoqItems(db.getBOQItems(activeProjectId));
      }
      setUsers(db.getUsers());
      if (selectedTask) {
        setMessages(db.getTaskMessages(selectedTask.id));
        // Keep selectedTask updated with latest values if it was changed
        const latestTasks = db.getTasks(activeProjectId);
        const match = latestTasks.find(t => t.id === selectedTask.id);
        if (match) setSelectedTask(match);
      }
    });
    return unsubscribe;
  }, [activeProjectId, selectedTask]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === 'all' || 
        (task.assigned_to && task.assigned_to.split(',').map(s => s.trim()).includes(assigneeFilter));
      const matchesBOQ = boqFilter === 'all' || task.boq_item_id === boqFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee && matchesBOQ;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, boqFilter]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const todo = filteredTasks.filter(t => t.status === 'todo').length;
    const inProgress = filteredTasks.filter(t => t.status === 'in_progress').length;
    const review = filteredTasks.filter(t => t.status === 'review').length;
    const done = filteredTasks.filter(t => t.status === 'done').length;
    
    // Check if task is overdue (due date < today and status != done)
    const todayStr = new Date().toISOString().split('T')[0];
    const overdue = filteredTasks.filter(t => t.status !== 'done' && t.due_date < todayStr).length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    
    const totalEstHours = filteredTasks.reduce((sum, t) => sum + (t.estimated_hours || 0), 0);
    const totalActHours = filteredTasks.reduce((sum, t) => sum + (t.actual_hours || 0), 0);

    return { total, todo, inProgress, review, done, overdue, completionRate, totalEstHours, totalActHours };
  }, [filteredTasks]);

  // Handle Form Change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'progress' || name === 'estimated_hours' || name === 'actual_hours' 
        ? Number(value) 
        : value
    }));
  };

  // Open Create Modal
  const handleCreateOpen = () => {
    if (!hasWriteAccess) {
      alert("You do not have write permissions to create tasks.");
      return;
    }
    setEditingTask(null);
    setFormData({
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      assigned_to: currentUser?.username || '',
      due_date: new Date().toISOString().split('T')[0],
      boq_item_id: '',
      progress: 0,
      estimated_hours: 0,
      actual_hours: 0
    });
    setShowModal(true);
  };

  // Open Edit Modal
  const handleEditOpen = (task: Task) => {
    if (!hasWriteAccess) {
      alert("You do not have write permissions to edit tasks.");
      return;
    }
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assigned_to: task.assigned_to,
      due_date: task.due_date,
      boq_item_id: task.boq_item_id || '',
      progress: task.progress,
      estimated_hours: task.estimated_hours || 0,
      actual_hours: task.actual_hours || 0
    });
    setShowModal(true);
  };

  // Delete Task
  const handleDeleteTask = (id: string, title: string) => {
    if (!hasWriteAccess) {
      alert("You do not have write permissions to delete tasks.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the task: "${title}"?`)) {
      db.deleteTask(id);
      setTasks(db.getTasks(activeProjectId));
    }
  };

  // Submit Form
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId) {
      alert("No active project selected!");
      return;
    }

    const payload = {
      project_id: activeProjectId,
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      assigned_to: formData.assigned_to,
      due_date: formData.due_date,
      boq_item_id: formData.boq_item_id || null,
      progress: formData.progress,
      estimated_hours: formData.estimated_hours,
      actual_hours: formData.actual_hours
    };

    if (editingTask) {
      db.saveTask({ ...payload, id: editingTask.id });
    } else {
      db.saveTask(payload);
    }

    setShowModal(false);
    setTasks(db.getTasks(activeProjectId));
  };

  // Drag and Drop simulation/handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, column: string) => {
    e.preventDefault();
    if (hasWriteAccess) {
      setDraggingOverColumn(column);
    }
  };

  const handleDragLeave = () => {
    setDraggingOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: Task['status']) => {
    e.preventDefault();
    setDraggingOverColumn(null);
    if (!hasWriteAccess) return;

    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== targetStatus) {
      // Keep existing properties, update status and set progress automatically for 'done'
      const updatedProgress = targetStatus === 'done' ? 100 : (targetStatus === 'todo' ? 0 : task.progress);
      db.saveTask({
        ...task,
        status: targetStatus,
        progress: updatedProgress
      });
      setTasks(db.getTasks(activeProjectId));
    }
  };

  // Helper colors for priorities
  const priorityStyles = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
        return { bg: '#fee2e2', text: '#ef4444', border: '#fca5a5', label: '🔴 Critical' };
      case 'high':
        return { bg: '#ffedd5', text: '#f97316', border: '#fed7aa', label: '🟠 High' };
      case 'medium':
        return { bg: '#fef3c7', text: '#d97706', border: '#fde68a', label: '🟡 Medium' };
      case 'low':
      default:
        return { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0', label: '🔵 Low' };
    }
  };

  if (!hasAccess) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2>Unauthorized Access</h2>
        <p style={{ color: 'var(--text-muted)' }}>You do not have permissions to access the Tasks module.</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limit. Please upload a smaller file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        data: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || (!newMessageText.trim() && !attachment)) return;

    db.saveTaskMessage({
      task_id: selectedTask.id,
      sender: currentUser?.username || 'Anonymous',
      message: newMessageText.trim(),
      attachment_name: attachment?.name,
      attachment_data: attachment?.data
    });

    setNewMessageText('');
    setAttachment(null);
    setMessages(db.getTaskMessages(selectedTask.id));
  };

  const handleDeleteMessage = (msgId: string) => {
    if (confirm("Are you sure you want to delete this message?")) {
      db.deleteTaskMessage(msgId);
      if (selectedTask) {
        setMessages(db.getTaskMessages(selectedTask.id));
      }
    }
  };

  if (!activeProject) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h2>No Project Selected</h2>
        <p style={{ color: 'var(--text-muted)', margin: '1rem 0 2rem 0' }}>
          Please select a project from the top navigation bar to view and manage tasks.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0.5rem 2rem 0.5rem' }}>
      
      {/* ── Page Header ── */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="page-title-group">
          <h1>Project Tasks</h1>
          <p>Organize, schedule, and track construction progress for <strong>{activeProject.name}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* View Toggles */}
          <div style={{ 
            display: 'flex', 
            background: 'var(--border-color)', 
            padding: '3px', 
            borderRadius: '10px',
            border: '1px solid rgba(0,0,0,0.05)'
          }}>
            <button 
              onClick={() => setViewMode('kanban')}
              style={{
                border: 'none',
                background: viewMode === 'kanban' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.82rem',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'kanban' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              📋 Kanban Board
            </button>
            <button 
              onClick={() => setViewMode('list')}
              style={{
                border: 'none',
                background: viewMode === 'list' ? 'var(--bg-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-muted)',
                padding: '0.45rem 1rem',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.82rem',
                transition: 'all 0.2s',
                boxShadow: viewMode === 'list' ? 'var(--shadow-sm)' : 'none'
              }}
            >
              📄 Detailed List
            </button>
          </div>

          {hasWriteAccess && (
            <button onClick={handleCreateOpen} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>+</span> Add New Task
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Widgets ── */}
      <div className="stats-grid" style={{ marginBottom: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
        <div className="card stat-card" style={{ padding: '1.25rem' }}>
          <span className="stat-title">Total Active Tasks</span>
          <span className="stat-value">{stats.total}</span>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>{stats.todo} Todo</span> • <span>{stats.inProgress} Active</span>
          </div>
        </div>
        <div className="card stat-card success" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
          <span className="stat-title">Completion Rate</span>
          <span className="stat-value">{stats.completionRate}%</span>
          <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${stats.completionRate}%`, height: '100%', background: 'var(--success)' }}></div>
          </div>
        </div>
        <div className="card stat-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
          <span className="stat-title">In Progress / Review</span>
          <span className="stat-value">{stats.inProgress + stats.review}</span>
          <span className="stat-sub">Awaiting confirmation: {stats.review}</span>
        </div>
        <div className="card stat-card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--danger)', background: stats.overdue > 0 ? 'rgba(239, 68, 68, 0.03)' : 'inherit' }}>
          <span className="stat-title" style={{ color: stats.overdue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>⚠️ Overdue Tasks</span>
          <span className="stat-value" style={{ color: stats.overdue > 0 ? 'var(--danger)' : 'inherit' }}>{stats.overdue}</span>
          <span className="stat-sub" style={{ color: stats.overdue > 0 ? 'var(--danger)' : 'inherit' }}>Action required</span>
        </div>
        <div className="card stat-card secondary" style={{ padding: '1.25rem' }}>
          <span className="stat-title">Time Tracked</span>
          <span className="stat-value" style={{ fontSize: '1.3rem' }}>{stats.totalActHours} / {stats.totalEstHours} hrs</span>
          <span className="stat-sub">Actual vs Estimated</span>
        </div>
      </div>

      {/* ── Filters Bar ── */}
      <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', 
          gap: '1rem', 
          alignItems: 'center' 
        }}>
          {/* Search bar */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>🔍</span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '2.2rem', margin: 0, height: '38px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Status filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-control"
              style={{ margin: 0, height: '38px', fontSize: '0.85rem' }}
            >
              <option value="all">📂 All Statuses</option>
              <option value="todo">📋 To Do</option>
              <option value="in_progress">🔄 In Progress</option>
              <option value="review">👀 Under Review</option>
              <option value="done">✅ Done</option>
            </select>
          </div>

          {/* Priority filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="form-control"
              style={{ margin: 0, height: '38px', fontSize: '0.85rem' }}
            >
              <option value="all">⚡ All Priorities</option>
              <option value="critical">🔴 Critical</option>
              <option value="high">🟠 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🔵 Low</option>
            </select>
          </div>

          {/* Assignee filter */}
          <div>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="form-control"
              style={{ margin: 0, height: '38px', fontSize: '0.85rem' }}
            >
              <option value="all">👤 All Assignees</option>
              {Array.from(new Set(tasks.flatMap(t => t.assigned_to ? t.assigned_to.split(',').map(s => s.trim()) : []).filter(Boolean))).map(usr => (
                <option key={usr} value={usr}>{usr}</option>
              ))}
            </select>
          </div>

          {/* BOQ item filter */}
          <div>
            <select
              value={boqFilter}
              onChange={(e) => setBoqFilter(e.target.value)}
              className="form-control"
              style={{ margin: 0, height: '38px', fontSize: '0.85rem' }}
            >
              <option value="all">🏗️ All BOQ Codes</option>
              {boqItems.map(item => (
                <option key={item.id} value={item.id}>{item.item_code} - {item.description.slice(0, 20)}...</option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filters label */}
        {(searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || boqFilter !== 'all') && (
          <div style={{ marginTop: '0.75rem', textAlign: 'right' }}>
            <button 
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPriorityFilter('all');
                setAssigneeFilter('all');
                setBoqFilter('all');
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textDecoration: 'underline'
              }}
            >
              🧹 Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Kanban View Mode ── */}
      {viewMode === 'kanban' && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '1.25rem',
          minHeight: '500px',
          alignItems: 'start'
        }}>
          
          {/* Columns */}
          {(['todo', 'in_progress', 'review', 'done'] as Task['status'][]).map((colStatus) => {
            const columnTasks = filteredTasks.filter(t => t.status === colStatus);
            const columnMeta = {
              todo: { title: 'To Do', color: '#64748b', emoji: '📋' },
              in_progress: { title: 'In Progress', color: 'var(--primary)', emoji: '🔄' },
              review: { title: 'Under Review', color: 'var(--accent)', emoji: '👀' },
              done: { title: 'Completed', color: 'var(--success)', emoji: '✅' }
            }[colStatus];

            const isDraggingOver = draggingOverColumn === colStatus;

            return (
              <div 
                key={colStatus}
                onDragOver={(e) => handleDragOver(e, colStatus)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, colStatus)}
                style={{
                  background: isDraggingOver ? 'rgba(2, 132, 199, 0.05)' : '#edf2f7',
                  border: isDraggingOver ? '2px dashed var(--primary)' : '2px solid transparent',
                  borderRadius: '16px',
                  padding: '1rem',
                  minHeight: '500px',
                  transition: 'all 0.25s ease'
                }}
              >
                {/* Column Title */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: `2px solid ${columnMeta.color}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '1rem' }}>{columnMeta.emoji}</span>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{columnMeta.title}</strong>
                  </div>
                  <span style={{ 
                    background: 'rgba(0,0,0,0.06)', 
                    padding: '0.1rem 0.5rem', 
                    borderRadius: '20px', 
                    fontSize: '0.75rem', 
                    fontWeight: 'bold',
                    color: 'var(--text-muted)'
                  }}>
                    {columnTasks.length}
                  </span>
                </div>

                {/* Task Cards Stack */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {columnTasks.length === 0 ? (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '2.5rem 1rem', 
                      color: 'var(--text-muted)', 
                      fontSize: '0.78rem',
                      border: '1px dashed rgba(0,0,0,0.06)',
                      borderRadius: '12px',
                      background: 'rgba(255,255,255,0.4)'
                    }}>
                      Drop tasks here
                    </div>
                  ) : (
                    columnTasks.map(task => {
                      const prio = priorityStyles(task.priority);
                      const isOverdue = task.status !== 'done' && task.due_date < new Date().toISOString().split('T')[0];
                      const linkedBOQ = boqItems.find(b => b.id === task.boq_item_id);

                      return (
                        <div
                          key={task.id}
                          draggable={hasWriteAccess}
                          onDragStart={(e) => handleDragStart(e, task.id)}
                          onClick={() => setSelectedTask(task)}
                          style={{
                            background: 'white',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1rem',
                            cursor: hasWriteAccess ? 'grab' : 'pointer',
                            boxShadow: 'var(--shadow-sm)',
                            transition: 'transform 0.2s, box-shadow 0.2s',
                            position: 'relative'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'none';
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                          }}
                        >
                          {/* Priority Pill */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ 
                              background: prio.bg, 
                              color: prio.text, 
                              border: `1px solid ${prio.border}`,
                              fontSize: '0.7rem', 
                              padding: '0.15rem 0.4rem', 
                              borderRadius: '6px',
                              fontWeight: '600'
                            }}>
                              {prio.label}
                            </span>
                            
                            {/* Action Indicators */}
                            {hasWriteAccess && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id, task.title);
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  opacity: 0.5
                                }}
                                onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                                title="Delete task"
                              >
                                🗑️
                              </button>
                            )}
                          </div>

                          {/* Title */}
                          <h4 style={{ fontSize: '0.88rem', fontWeight: '700', marginBottom: '0.4rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                            {task.title}
                          </h4>

                          {/* Description */}
                          <p style={{ 
                            fontSize: '0.78rem', 
                            color: 'var(--text-muted)', 
                            marginBottom: '0.75rem',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {task.description || 'No description provided.'}
                          </p>

                          {/* BOQ Code Link badge */}
                          {linkedBOQ && (
                            <div style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '0.2rem',
                              background: 'var(--primary-light)', 
                              color: 'var(--primary-hover)',
                              fontSize: '0.72rem', 
                              padding: '0.15rem 0.45rem', 
                              borderRadius: '6px',
                              fontWeight: '600',
                              marginBottom: '0.75rem'
                            }}>
                              🏗️ {linkedBOQ.item_code}
                            </div>
                          )}

                          {/* Progress bar */}
                          <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                              <span>Progress</span>
                              <strong>{task.progress}%</strong>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ 
                                width: `${task.progress}%`, 
                                height: '100%', 
                                background: task.status === 'done' ? 'var(--success)' : 'var(--primary)' 
                              }}></div>
                            </div>
                          </div>

                          {/* Footer details: Due date + Assignee */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            borderTop: '1px solid #f1f5f9', 
                            paddingTop: '0.6rem',
                            fontSize: '0.72rem' 
                          }}>
                            <span style={{ 
                              color: isOverdue ? 'var(--danger)' : 'var(--text-muted)',
                              fontWeight: isOverdue ? 'bold' : 'normal'
                            }}>
                              📅 {isOverdue ? 'Overdue: ' : ''}{task.due_date}
                            </span>
                            <span style={{ 
                              background: '#f1f5f9', 
                              padding: '0.15rem 0.45rem', 
                              borderRadius: '6px', 
                              fontWeight: '600',
                              color: 'var(--text-main)' 
                            }}>
                              👤 {task.assigned_to ? task.assigned_to.split(',').join(', ') : 'Unassigned'}
                            </span>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            );
          })}

        </div>
      )}

      {/* ── List View Mode ── */}
      {viewMode === 'list' && (
        <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ fontSize: '0.85rem', width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th>Task Title</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th style={{ width: '110px' }}>Priority</th>
                  <th style={{ width: '130px' }}>Assignee</th>
                  <th style={{ width: '110px' }}>Due Date</th>
                  <th>BOQ Link</th>
                  <th style={{ width: '140px' }}>Progress</th>
                  <th style={{ width: '100px', textAlign: 'right' }}>Tracked (h)</th>
                  {hasWriteAccess && <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={hasWriteAccess ? 9 : 8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      No tasks matches the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => {
                    const prio = priorityStyles(task.priority);
                    const isOverdue = task.status !== 'done' && task.due_date < new Date().toISOString().split('T')[0];
                    const linkedBOQ = boqItems.find(b => b.id === task.boq_item_id);

                    const statusLabels = {
                      todo: { label: 'To Do', color: '#64748b', bg: '#f1f5f9' },
                      in_progress: { label: 'In Progress', color: 'var(--primary)', bg: 'var(--primary-light)' },
                      review: { label: 'Review', color: 'var(--accent)', bg: 'var(--accent-light)' },
                      done: { label: 'Completed', color: 'var(--success)', bg: 'var(--success-light)' }
                    };
                    const statusMeta = statusLabels[task.status] || { label: task.status, color: '#64748b', bg: '#f1f5f9' };

                    return (
                      <tr key={task.id} hover-style="true" style={{ cursor: 'pointer' }} onClick={() => setSelectedTask(task)}>
                        <td style={{ fontWeight: '600' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{task.title}</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal', marginTop: '0.15rem' }}>
                              {task.description ? task.description.slice(0, 50) + (task.description.length > 50 ? '...' : '') : 'No description'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            background: statusMeta.bg,
                            color: statusMeta.color,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '20px',
                            fontSize: '0.72rem',
                            fontWeight: '700'
                          }}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            background: prio.bg,
                            color: prio.text,
                            padding: '0.15rem 0.4rem',
                            borderRadius: '6px',
                            fontSize: '0.72rem',
                            fontWeight: '600',
                            border: `1px solid ${prio.border}`
                          }}>
                            {prio.label}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '500' }}>👤 {task.assigned_to ? task.assigned_to.split(',').join(', ') : 'Unassigned'}</span>
                        </td>
                        <td>
                          <span style={{ 
                            color: isOverdue ? 'var(--danger)' : 'inherit', 
                            fontWeight: isOverdue ? 'bold' : 'normal' 
                          }}>
                            {task.due_date} {isOverdue ? '⚠️' : ''}
                          </span>
                        </td>
                        <td>
                          {linkedBOQ ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 'bold', fontSize: '0.75rem', color: 'var(--primary)' }}>🏗️ {linkedBOQ.item_code}</span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{linkedBOQ.description.slice(0, 15)}...</span>
                            </div>
                          ) : '-'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${task.progress}%`, height: '100%', background: task.status === 'done' ? 'var(--success)' : 'var(--primary)' }}></div>
                            </div>
                            <strong style={{ fontSize: '0.75rem', width: '30px', textAlign: 'right' }}>{task.progress}%</strong>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: '600', color: 'var(--text-muted)' }}>
                          {task.actual_hours || 0} / {task.estimated_hours || 0} h
                        </td>
                        {hasWriteAccess && (
                          <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                              <button 
                                onClick={() => handleEditOpen(task)}
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => handleDeleteTask(task.id, task.title)}
                                className="btn btn-outline" 
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div className="overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90vw', maxHeight: '90vh', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', backgroundColor: 'white', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)' }}>
                {editingTask ? `Edit Task: ${editingTask.title}` : '➕ Add New Project Task'}
              </h2>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Title */}
              <div>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Task Title *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g. Pour concrete foundation"
                  required
                  className="form-control"
                  style={{ margin: 0 }}
                />
              </div>

              {/* Description */}
              <div>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Detail the steps, tools, or requirements..."
                  rows={3}
                  className="form-control"
                  style={{ margin: 0, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {/* Status & Priority Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{ margin: 0 }}
                  >
                    <option value="todo">📋 To Do</option>
                    <option value="in_progress">🔄 In Progress</option>
                    <option value="review">👀 Under Review</option>
                    <option value="done">✅ Done</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{ margin: 0 }}
                  >
                    <option value="low">🔵 Low Priority</option>
                    <option value="medium">🟡 Medium Priority</option>
                    <option value="high">🟠 High Priority</option>
                    <option value="critical">🔴 Critical Priority</option>
                  </select>
                </div>
              </div>

              {/* Assignee & Due Date Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Assigned To</label>
                  <div style={{
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '0.5rem',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    background: 'rgba(255, 255, 255, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    {users.map(usr => {
                      const selectedList = formData.assigned_to ? formData.assigned_to.split(',').map(s => s.trim()) : [];
                      const isChecked = selectedList.includes(usr.username);
                      return (
                        <label key={usr.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              let newList;
                              if (e.target.checked) {
                                newList = [...selectedList, usr.username];
                              } else {
                                newList = selectedList.filter(u => u !== usr.username);
                              }
                              setFormData(prev => ({
                                ...prev,
                                assigned_to: newList.join(',')
                              }));
                            }}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{usr.username} ({usr.role})</span>
                        </label>
                      );
                    })}
                    {users.length === 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No users available</span>}
                  </div>
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Due Date</label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    required
                    className="form-control"
                    style={{ margin: 0 }}
                  />
                </div>
              </div>

              {/* Link to BOQ Item */}
              <div>
                <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Link to BOQ Item Reference</label>
                <select
                  name="boq_item_id"
                  value={formData.boq_item_id}
                  onChange={handleInputChange}
                  className="form-control"
                  style={{ margin: 0 }}
                >
                  <option value="">🏗️ No BOQ Reference</option>
                  {boqItems.map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.item_code}] {item.description.slice(0, 45)}... ({item.approved_qty} {item.unit})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  Linking a task to BOQ aids in correlating work completion with the budget line-item.
                </span>
              </div>

              {/* Progress Slider */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', margin: 0 }}>Progress</label>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{formData.progress}%</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="range"
                    name="progress"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={handleInputChange}
                    style={{ flex: 1, accentColor: 'var(--primary)', height: '6px', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, progress: 0 }))} className="btn btn-outline" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}>0%</button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, progress: 50 }))} className="btn btn-outline" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}>50%</button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, progress: 100, status: 'done' }))} className="btn btn-outline" style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}>100%</button>
                  </div>
                </div>
              </div>

              {/* Hour Tracking */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Estimated Hours</label>
                  <input
                    type="number"
                    name="estimated_hours"
                    min="0"
                    value={formData.estimated_hours}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{ margin: 0 }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Actual Hours Spent</label>
                  <input
                    type="number"
                    name="actual_hours"
                    min="0"
                    value={formData.actual_hours}
                    onChange={handleInputChange}
                    className="form-control"
                    style={{ margin: 0 }}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ── Collaboration & Details Modal ── */}
      {selectedTask && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '900px',
            height: '80vh',
            display: 'flex',
            overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Left Side: Task Info */}
            <div style={{
              flex: '1',
              padding: '1.5rem',
              borderRight: '1px solid rgba(255, 255, 255, 0.08)',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              color: '#f1f5f9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  background: selectedTask.status === 'done' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)',
                  color: selectedTask.status === 'done' ? '#34d399' : '#818cf8',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '20px',
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  textTransform: 'uppercase'
                }}>
                  {selectedTask.status.replace('_', ' ')}
                </span>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '600',
                  color: 'var(--text-muted)'
                }}>
                  Priority: {selectedTask.priority}
                </span>
              </div>

              <h2 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0, color: 'white' }}>{selectedTask.title}</h2>
              
              <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>
                <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#cbd5e1' }}>Description</strong>
                {selectedTask.description || 'No description provided.'}
              </div>

              {/* Associated BOQ */}
              {boqItems.find(b => b.id === selectedTask.boq_item_id) && (
                <div style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '0.75rem',
                  fontSize: '0.82rem'
                }}>
                  <strong style={{ display: 'block', color: 'var(--primary)', marginBottom: '0.2rem' }}>Linked BOQ Item</strong>
                  <div>
                    <span style={{ fontWeight: '700', marginRight: '0.4rem' }}>{boqItems.find(b => b.id === selectedTask.boq_item_id)?.item_code}</span>
                    <span style={{ color: '#cbd5e1' }}>{boqItems.find(b => b.id === selectedTask.boq_item_id)?.description}</span>
                  </div>
                </div>
              )}

              {/* Progress */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                  <span>Progress</span>
                  <strong>{selectedTask.progress}%</strong>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${selectedTask.progress}%`, height: '100%', background: selectedTask.status === 'done' ? 'var(--success)' : 'var(--primary)' }}></div>
                </div>
              </div>

              {/* Due Date & Hours */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>📅 Due Date</span>
                  <span style={{ fontWeight: '600' }}>{selectedTask.due_date}</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', display: 'block' }}>⏱️ Hours (Spent/Est)</span>
                  <span style={{ fontWeight: '600' }}>{selectedTask.actual_hours || 0} / {selectedTask.estimated_hours || 0} hrs</span>
                </div>
              </div>

              {/* Assigned Staffs */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.82rem', marginBottom: '0.4rem', color: '#cbd5e1' }}>👥 Assigned Team Members</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {selectedTask.assigned_to ? (
                    selectedTask.assigned_to.split(',').map((u, i) => (
                      <span key={i} style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: 'white',
                        fontWeight: '500'
                      }}>
                        👤 {u.trim()}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No staff assigned</span>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                {hasWriteAccess && (
                  <button
                    onClick={() => {
                      handleEditOpen(selectedTask);
                      setSelectedTask(null);
                    }}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem' }}
                  >
                    ✏️ Edit Task
                  </button>
                )}
                <button
                  onClick={() => setSelectedTask(null)}
                  className="btn btn-outline"
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem' }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Right Side: Chat & File Sharing */}
            <div style={{
              flex: '1.3',
              background: '#0f172a',
              display: 'flex',
              flexDirection: 'column',
              height: '100%'
            }}>
              {/* Chat Header */}
              <div style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontWeight: '700', color: 'white', fontSize: '0.92rem' }}>💬 Task Group Chat</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{messages.length} messages</span>
              </div>

              {/* Chat Messages */}
              <div style={{
                flex: 1,
                padding: '1.25rem',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {messages.map((msg) => {
                  const isMe = msg.sender === currentUser?.username;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '80%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.15rem' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 'bold' }}>{msg.sender}</span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.65rem', cursor: 'pointer', padding: 0 }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <div style={{
                        background: isMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.06)',
                        border: isMe ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        padding: '0.6rem 0.85rem',
                        borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        fontSize: '0.82rem',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {msg.message}

                        {/* File Attachment */}
                        {msg.attachment_name && msg.attachment_data && (
                          <div style={{
                            marginTop: '0.5rem',
                            padding: '0.4rem',
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            fontSize: '0.75rem'
                          }}>
                            <span>📄</span>
                            <a
                              href={msg.attachment_data}
                              download={msg.attachment_name}
                              style={{
                                color: isMe ? 'white' : 'var(--primary)',
                                textDecoration: 'underline',
                                fontWeight: '600',
                                wordBreak: 'break-all'
                              }}
                            >
                              {msg.attachment_name}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {messages.length === 0 && (
                  <div style={{
                    margin: 'auto',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span style={{ fontSize: '1.5rem' }}>💬</span>
                    <span>No messages or updates yet.<br />Start the discussion by posting below.</span>
                  </div>
                )}
              </div>

              {/* Chat Input & File Selection */}
              <form onSubmit={handleSendMessage} style={{
                padding: '1rem',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                background: '#1e293b',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}>
                {attachment && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(56, 189, 248, 0.1)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '0.35rem 0.6rem',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    color: '#38bdf8'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                      📎 {attachment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachment(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    width: '38px',
                    height: '38px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    color: '#94a3b8',
                    transition: 'all 0.2s'
                  }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  >
                    📎
                    <input
                      type="file"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <input
                    type="text"
                    value={newMessageText}
                    onChange={(e) => setNewMessageText(e.target.value)}
                    placeholder="Type an update or message..."
                    className="form-control"
                    style={{ margin: 0, flex: 1, height: '38px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', color: 'white' }}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ height: '38px', padding: '0 1rem' }}
                  >
                    Send
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
