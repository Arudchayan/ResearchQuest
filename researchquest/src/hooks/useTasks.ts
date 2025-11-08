import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { awardXP, XP_REWARDS } from '../utils/gamification'

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
      setTasks(data || [])
    }
    setLoading(false)
  }, [userId])

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
          console.log('Realtime update received:', payload)
          fetchTasks()
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
      })

    return () => {
      subscription.unsubscribe()
    }
  }, [userId, fetchTasks])

  async function createTask(taskData: Partial<Task>): Promise<Task | null> {
    if (!userId) return null

    const { data, error: createError } = await supabase
      .from('tasks')
      .insert({
        ...taskData,
        user_id: userId,
        completed: false,
      })
      .select()
      .single()

    if (createError) {
      setError(createError.message)
      return null
    }

    // Award XP
    await awardXP(userId, XP_REWARDS.CREATE_TASK, 'create_task')

    // Manual refetch to ensure UI updates
    await fetchTasks()

    return data
  }

  async function updateTask(taskId: string, updates: Partial<Task>): Promise<boolean> {
    const { error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Manual refetch to ensure UI updates
    await fetchTasks()

    return true
  }

  async function completeTask(taskId: string): Promise<boolean> {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return false
    
    // Toggle completion status
    const newCompletedStatus = !task.completed
    
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed: newCompletedStatus })
      .eq('id', taskId)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Award XP only when completing (not un-completing)
    if (newCompletedStatus && userId) {
      await awardXP(userId, XP_REWARDS.COMPLETE_TASK, 'complete_task')
    }

    // Manual refetch to ensure UI updates
    await fetchTasks()

    return true
  }

  async function deleteTask(taskId: string): Promise<boolean> {
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    // Manual refetch to ensure UI updates
    await fetchTasks()

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
