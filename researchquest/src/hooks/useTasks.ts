import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import { toast } from 'sonner'
import { parseDateInput } from '../utils/time'

export interface Task {
  id: string
  user_id: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  due_date?: string
  completed: boolean
  category?: string
  project_id?: string
  created_at: string
  updated_at: string
}

export function useTasks(userId: string | undefined) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sortTasksByDueDate = useCallback((taskList: Task[]) => {
    return [...taskList].sort((a, b) => {
      const aDueDate = parseDateInput(a.due_date)
      const bDueDate = parseDateInput(b.due_date)
      const aDue = aDueDate ? aDueDate.getTime() : null
      const bDue = bDueDate ? bDueDate.getTime() : null

      if (aDue === null && bDue === null) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      if (aDue === null) return 1
      if (bDue === null) return -1
      if (aDue === bDue) {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return aDue - bDue
    })
  }, [])

  const fetchTasks = useCallback(async () => {
    if (!userId) return

    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true, nullsFirst: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setTasks(sortTasksByDueDate(data || []))
    }
    setLoading(false)
  }, [userId, sortTasksByDueDate])

  useEffect(() => {
    if (!userId) {
      setTasks([])
      setLoading(false)
      return
    }

    fetchTasks()

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`tasks_realtime_${userId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        (payload) => {
          console.log('Tasks realtime update:', payload)
          // Optimistic UI update based on event type
          if (payload.eventType === 'INSERT') {
            // Check if task already exists (from optimistic update) to avoid duplicates
            setTasks(prev => {
              const exists = prev.some(t => t.id === (payload.new as Task).id)
              if (exists) {
                console.log('Task already exists (from optimistic update), skipping realtime insert')
                return prev
              }
              return sortTasksByDueDate([...(prev ?? []), payload.new as Task])
            })
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(task =>
              task.id === payload.new.id ? payload.new as Task : task
            ))
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(task => task.id !== payload.old.id))
          }
        }
      )
      .subscribe((status) => {
        console.log('Tasks subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchTasks, sortTasksByDueDate, userId])

  async function createTask(taskData: Partial<Task>): Promise<Task | null> {
    if (!userId) {
      setError('User not authenticated')
      toast.error('You must be logged in to create tasks')
      return null
    }

    // Validate required fields
    if (!taskData.title || !taskData.title.trim()) {
      setError('Task title is required')
      toast.error('Task title is required')
      return null
    }

    // Clean and prepare the data - only include defined fields
    const cleanData: any = {
      user_id: userId,
      title: taskData.title.trim(),
      completed: false,
      priority: taskData.priority || 'medium',
    }

    // Only add optional fields if they have values (and trim strings)
    if (taskData.description && taskData.description.trim()) {
      cleanData.description = taskData.description.trim()
    }
    if (taskData.due_date && taskData.due_date.trim()) {
      const normalized = parseDateInput(taskData.due_date.trim())
      cleanData.due_date = normalized
        ? `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-${String(normalized.getDate()).padStart(2, '0')}`
        : taskData.due_date.trim()
    }
    if (taskData.category && taskData.category.trim()) {
      cleanData.category = taskData.category.trim()
    }
    if (taskData.project_id && taskData.project_id.trim()) {
      cleanData.project_id = taskData.project_id.trim()
    }

    console.log('Creating task with cleaned data:', cleanData)

    const { data, error: createError } = await supabase
      .from('tasks')
      .insert(cleanData)
      .select()
      .single()

    if (createError) {
      console.error('Failed to create task:', createError)
      console.error('Error details:', JSON.stringify(createError, null, 2))
      console.error('Task data that failed:', cleanData)
      
      const errorMessage = createError.message || createError.details || createError.hint || 'Unknown error occurred'
      setError(`Failed to create task: ${errorMessage}`)
      toast.error(`Failed to create task: ${errorMessage}`)
      return null
    }

    console.log('Task created successfully:', data)
    toast.success('Task created successfully')

    // Optimistic update - add to local state immediately
    setTasks(prev => sortTasksByDueDate([...(prev ?? []), data]))

    // Award XP (don't await to avoid blocking)
    awardXP(userId, XP_REWARDS.CREATE_TASK, 'create_task').catch(console.error)

    void fetchTasks()

    return data
  }

  async function updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    // Optimistic update
    const sanitizedUpdates: Partial<Task> = { ...updates }
    if (typeof sanitizedUpdates.due_date === 'string') {
      const normalized = parseDateInput(sanitizedUpdates.due_date)
      sanitizedUpdates.due_date = normalized
        ? `${normalized.getFullYear()}-${String(normalized.getMonth() + 1).padStart(2, '0')}-${String(normalized.getDate()).padStart(2, '0')}`
        : sanitizedUpdates.due_date
    }

    setTasks(prev => prev.map(task =>
      task.id === taskId ? { ...task, ...sanitizedUpdates, updated_at: new Date().toISOString() } : task
    ))

    const { error: updateError } = await supabase
      .from('tasks')
      .update(sanitizedUpdates)
      .eq('id', taskId)

    if (updateError) {
      console.error('Failed to update task:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))

      const errorMessage = updateError.message || updateError.details || updateError.hint || 'Unknown error occurred'
      setError(`Failed to update task: ${errorMessage}`)
      toast.error(`Failed to update task: ${errorMessage}`)
      // Revert on error
      fetchTasks()
      return false
    }

    void fetchTasks()
    return true
  }

  async function completeTask(taskId: string): Promise<boolean> {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return false
    
    // Toggle completion status
    const newCompletedStatus = !task.completed
    
    // Optimistic update
    setTasks(prev => prev.map(t => 
      t.id === taskId ? { ...t, completed: newCompletedStatus, updated_at: new Date().toISOString() } : t
    ))

    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed: newCompletedStatus })
      .eq('id', taskId)

    if (updateError) {
      console.error('Failed to complete/uncomplete task:', updateError)
      console.error('Error details:', JSON.stringify(updateError, null, 2))
      
      const errorMessage = updateError.message || updateError.details || updateError.hint || 'Unknown error occurred'
      setError(`Failed to update task: ${errorMessage}`)
      toast.error(`Failed to update task: ${errorMessage}`)
      // Revert on error
      fetchTasks()
      return false
    }

    if (newCompletedStatus) {
      toast.success('Task completed! 🎉')
    }

    // Award XP only when completing (not un-completing, don't await to avoid blocking)
    if (newCompletedStatus && userId) {
      awardXP(userId, XP_REWARDS.COMPLETE_TASK, 'complete_task').catch(console.error)
    }

    void fetchTasks()
    return true
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    // Optimistic delete
    const deletedTask = tasks.find(t => t.id === taskId)
    setTasks(prev => prev.filter(task => task.id !== taskId))

    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      console.error('Failed to delete task:', deleteError)
      console.error('Error details:', JSON.stringify(deleteError, null, 2))
      
      const errorMessage = deleteError.message || deleteError.details || deleteError.hint || 'Unknown error occurred'
      setError(`Failed to delete task: ${errorMessage}`)
      toast.error(`Failed to delete task: ${errorMessage}`)
      // Revert on error
      if (deletedTask) {
        setTasks(prev => [...prev, deletedTask])
      }
      return false
    }

    toast.success('Task deleted')
    void fetchTasks()
    return true
  }

  return {
    tasks,
    loading,
    error,
    createTask,
    updateTask,
    completeTask,
    deleteTask,
    refreshTasks: fetchTasks,
  }
}
