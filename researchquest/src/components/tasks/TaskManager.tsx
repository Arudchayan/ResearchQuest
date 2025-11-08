import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, Clock, AlertCircle, Trash2, Plus, Calendar, Filter } from 'lucide-react'
import { useTasks } from '../../hooks/useTasks'
import type { Task } from '../../hooks/useTasks'
import { supabase } from '../../lib/supabase'

type TaskFilter = 'all' | 'pending' | 'completed' | 'overdue'
type TaskPriority = 'high' | 'medium' | 'low'
type TaskCategory = 'Research' | 'Reading' | 'Writing' | 'Analysis' | 'Presentation'

const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const CATEGORIES: TaskCategory[] = ['Research', 'Reading', 'Writing', 'Analysis', 'Presentation']

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'low':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  }
}

function isOverdue(dueDate: string | undefined): boolean {
  if (!dueDate) return false
  return new Date(dueDate) < new Date()
}

export function TaskManager() {
  const [userId, setUserId] = useState<string | undefined>(undefined)
  const { tasks, loading, createTask, updateTask, completeTask, deleteTask } = useTasks(userId)
  
  const [filter, setFilter] = useState<TaskFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  
  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium')
  const [formCategory, setFormCategory] = useState<TaskCategory>('Research')
  const [formDueDate, setFormDueDate] = useState('')
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id)
    })
  }, [])
  
  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'pending') return !task.completed
    if (filter === 'completed') return task.completed
    if (filter === 'overdue') return !task.completed && isOverdue(task.due_date)
    return true
  })
  
  // Calculate progress
  const completedCount = tasks.filter(t => t.completed).length
  const totalCount = tasks.length
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  
  const handleAddTask = async () => {
    if (!formTitle.trim()) return
    
    await createTask({
      title: formTitle,
      description: formDescription || undefined,
      priority: formPriority,
      category: formCategory,
      due_date: formDueDate || undefined,
    })
    
    // Reset form
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormCategory('Research')
    setFormDueDate('')
    setShowAddModal(false)
  }
  
  const handleUpdateTask = async () => {
    if (!editingTask || !formTitle.trim()) return
    
    await updateTask(editingTask.id, {
      title: formTitle,
      description: formDescription || undefined,
      priority: formPriority,
      category: formCategory,
      due_date: formDueDate || undefined,
    })
    
    // Reset form
    setEditingTask(null)
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormCategory('Research')
    setFormDueDate('')
  }
  
  const handleEditClick = (task: Task) => {
    setEditingTask(task)
    setFormTitle(task.title)
    setFormDescription(task.description || '')
    setFormPriority(task.priority)
    setFormCategory((task.category as TaskCategory) || 'Research')
    setFormDueDate(task.due_date || '')
  }
  
  const handleToggleComplete = async (task: Task) => {
    if (task.completed) {
      // Un-complete task
      await updateTask(task.id, { completed: false })
    } else {
      // Complete task with animation
      await completeTask(task.id)
    }
  }
  
  const handleCancelEdit = () => {
    setEditingTask(null)
    setFormTitle('')
    setFormDescription('')
    setFormPriority('medium')
    setFormCategory('Research')
    setFormDueDate('')
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-secondary">Loading tasks...</div>
      </div>
    )
  }
  
  return (
    <div className="h-full flex flex-col bg-bg-base">
      {/* Header */}
      <div className="p-6 border-b border-border-subtle bg-bg-surface">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-title font-bold text-text-primary">Task Manager</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
        
        {/* Progress Bar */}
        {totalCount > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-small text-text-secondary">
                {completedCount} of {totalCount} tasks completed
              </span>
              <span className="text-small font-semibold text-primary-500">{progressPercentage}%</span>
            </div>
            <div className="h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'pending', 'completed', 'overdue'] as TaskFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-caption font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-primary-500 text-white'
                  : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      
      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-text-tertiary opacity-50" />
            <p className="text-body text-text-secondary mb-2">No tasks yet</p>
            <p className="text-small text-text-tertiary">Create your first research task to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggleComplete={handleToggleComplete}
                onEdit={handleEditClick}
                onDelete={deleteTask}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Add/Edit Modal */}
      {(showAddModal || editingTask) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
          setShowAddModal(false)
          handleCancelEdit()
        }}>
          <div className="bg-bg-surface rounded-lg shadow-xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-body font-bold text-text-primary mb-4">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h3>
            
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Enter task title"
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-body focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Optional task details"
                  rows={3}
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
              </div>
              
              {/* Priority & Category Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Priority */}
                <div>
                  <label className="block text-small font-medium text-text-primary mb-2">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value as TaskPriority)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500 capitalize"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
                
                {/* Category */}
                <div>
                  <label className="block text-small font-medium text-text-primary mb-2">
                    Category
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Due Date */}
              <div>
                <label className="block text-small font-medium text-text-primary mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={e => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-base border border-border-subtle rounded-md text-small focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  handleCancelEdit()
                }}
                className="flex-1 px-4 py-2 bg-bg-elevated text-text-primary rounded-md hover:bg-bg-base transition-colors text-small font-medium"
              >
                Cancel
              </button>
              <button
                onClick={editingTask ? handleUpdateTask : handleAddTask}
                disabled={!formTitle.trim()}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors text-small font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingTask ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface TaskCardProps {
  task: Task
  onToggleComplete: (task: Task) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
}

function TaskCard({ task, onToggleComplete, onEdit, onDelete }: TaskCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  
  const overdue = isOverdue(task.due_date)
  
  const handleToggle = async () => {
    if (!task.completed) {
      setIsCompleting(true)
      setTimeout(() => setIsCompleting(false), 600)
    }
    await onToggleComplete(task)
  }
  
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (showDeleteConfirm) {
      onDelete(task.id)
    } else {
      setShowDeleteConfirm(true)
      setTimeout(() => setShowDeleteConfirm(false), 3000)
    }
  }
  
  return (
    <div
      className={`p-4 rounded-lg border bg-bg-surface transition-all duration-300 ${
        task.completed
          ? 'border-border-subtle opacity-60'
          : overdue
          ? 'border-red-200 dark:border-red-900'
          : 'border-border-subtle hover:border-border-moderate hover:shadow-sm'
      } ${isCompleting ? 'scale-95 opacity-50' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={handleToggle}
          className={`flex-shrink-0 mt-0.5 transition-all duration-200 ${
            isCompleting ? 'scale-125' : ''
          }`}
        >
          {task.completed ? (
            <CheckCircle2 className="w-5 h-5 text-green-500 animate-in fade-in zoom-in duration-300" />
          ) : (
            <Circle className="w-5 h-5 text-text-tertiary hover:text-primary-500" />
          )}
        </button>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4
              className={`text-small font-semibold ${
                task.completed ? 'text-text-tertiary line-through' : 'text-text-primary'
              }`}
            >
              {task.title}
            </h4>
            
            <div className="flex items-center gap-1 flex-shrink-0">
              {!task.completed && (
                <button
                  onClick={() => onEdit(task)}
                  className="p-1 text-text-tertiary hover:text-primary-500 transition-colors"
                  title="Edit task"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              <button
                onClick={handleDelete}
                className={`p-1 rounded transition-colors ${
                  showDeleteConfirm ? 'text-red-500' : 'text-text-tertiary hover:text-red-500'
                }`}
                title={showDeleteConfirm ? 'Click again to confirm' : 'Delete task'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {task.description && (
            <p className="text-small text-text-secondary mb-3">{task.description}</p>
          )}
          
          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Badge */}
            <span className={`px-2 py-0.5 rounded-full text-caption font-medium capitalize ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </span>
            
            {/* Category Badge */}
            {task.category && (
              <span className="px-2 py-0.5 rounded-full text-caption font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                {task.category}
              </span>
            )}
            
            {/* Due Date */}
            {task.due_date && (
              <div className={`flex items-center gap-1 text-caption ${
                overdue && !task.completed
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : 'text-text-tertiary'
              }`}>
                {overdue && !task.completed ? (
                  <AlertCircle className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span>
                  {new Date(task.due_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                {overdue && !task.completed && <span className="font-semibold">(Overdue)</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
