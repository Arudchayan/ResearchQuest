import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'
import { awardXP, XP_REWARDS } from '../utils/gamification'
import type {
  TopicWithCounts,
  TopicEntityType,
  TopicQuestWithTopic,
} from '../types/database'

interface TopicRow extends TopicWithCounts {
  topic_notes?: { count: number | null }[]
  topic_papers?: { count: number | null }[]
  topic_ideas?: { count: number | null }[]
}

interface TopicQuestRow extends TopicQuestWithTopic {
  topics?: {
    id: string
    name: string
    updated_at: string
  }
}

const ENTITY_TABLE: Record<TopicEntityType, string> = {
  note: 'topic_notes',
  paper: 'topic_papers',
  idea: 'topic_ideas',
}

const ENTITY_COLUMN: Record<TopicEntityType, string> = {
  note: 'note_id',
  paper: 'paper_id',
  idea: 'idea_id',
}

function coerceCount(value?: { count: number | null }[]): number {
  if (!value || value.length === 0) return 0
  const first = value[0]
  if (!first || first.count == null) return 0
  return first.count
}

function mapTopicRow(row: TopicRow): TopicWithCounts {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
    note_count: coerceCount(row.topic_notes),
    paper_count: coerceCount(row.topic_papers),
    idea_count: coerceCount(row.topic_ideas),
  }
}

function mapQuestRow(row: TopicQuestRow): TopicQuestWithTopic {
  return {
    id: row.id,
    user_id: row.user_id,
    topic_id: row.topic_id,
    objective: row.objective,
    target_count: row.target_count,
    progress_count: row.progress_count,
    due_date: row.due_date,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    topic: row.topics
      ? {
          id: row.topics.id,
          name: row.topics.name,
          updated_at: row.topics.updated_at,
        }
      : row.topic,
  }
}

function getDueDate(daysAhead: number): string {
  const date = new Date()
  date.setDate(date.getDate() + daysAhead)
  return date.toISOString().split('T')[0]
}

export function useTopics(userId: string | undefined) {
  const {
    topics,
    setTopics,
    upsertTopic,
    removeTopic,
    setSelectedTopic,
  } = useAppStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quests, setQuests] = useState<TopicQuestWithTopic[]>([])
  const [questsLoading, setQuestsLoading] = useState(false)
  const linkCacheRef = useRef(new Map<string, string[]>())

  const fetchTopics = useCallback(async () => {
    if (!userId) {
      setTopics([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('topics')
      .select('*, topic_notes(count), topic_papers(count), topic_ideas(count)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (fetchError) {
      console.error('Failed to fetch topics:', fetchError)
      setError(fetchError.message)
      setTopics([])
    } else {
      const mapped = (data || []).map((row) => mapTopicRow(row as TopicRow))
      setTopics(mapped)
      setError(null)
    }

    setLoading(false)
  }, [setTopics, userId])

  const fetchTopicById = useCallback(
    async (topicId: string) => {
      if (!userId) return

      const { data, error: fetchError } = await supabase
        .from('topics')
        .select('*, topic_notes(count), topic_papers(count), topic_ideas(count)')
        .eq('id', topicId)
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchError) {
        console.error('Failed to refresh topic:', fetchError)
        return
      }

      if (data) {
        const mapped = mapTopicRow(data as TopicRow)
        upsertTopic(mapped)
        const currentSelected = useAppStore.getState().selectedTopic
        if (currentSelected?.id === mapped.id) {
          setSelectedTopic(mapped)
        }
      }
    },
    [setSelectedTopic, upsertTopic, userId]
  )

  const fetchQuests = useCallback(async () => {
    if (!userId) {
      setQuests([])
      return
    }
    setQuestsLoading(true)
    const { data, error: questError } = await supabase
      .from('topic_quests')
      .select('*, topics(id, name, updated_at)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (questError) {
      console.error('Failed to fetch topic quests:', questError)
    } else {
      setQuests((data || []).map((row) => mapQuestRow(row as TopicQuestRow)))
    }
    setQuestsLoading(false)
  }, [userId])

  const ensureActiveQuest = useCallback(async () => {
    if (!userId || topics.length === 0) return
    const existingActive = quests.find((quest) => quest.status === 'active')
    if (existingActive) return

    const sortedTopics = [...topics].sort(
      (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
    )
    const targetTopic = sortedTopics[0]
    const objective = `Review and enrich "${targetTopic.name}"`
    const { data, error: insertError } = await supabase
      .from('topic_quests')
      .insert({
        user_id: userId,
        topic_id: targetTopic.id,
        objective,
        target_count: 1,
        due_date: getDueDate(3),
      })
      .select('*, topics(id, name, updated_at)')
      .single()

    if (insertError) {
      console.error('Failed to create topic quest:', insertError)
      return
    }

    if (data) {
      const quest = mapQuestRow(data as TopicQuestRow)
      setQuests((prev) => [quest, ...prev])
    }
  }, [quests, topics, userId])

  useEffect(() => {
    linkCacheRef.current.clear()
  }, [userId])

  useEffect(() => {
    void fetchTopics()
  }, [fetchTopics])

  useEffect(() => {
    void fetchQuests()
  }, [fetchQuests])

  useEffect(() => {
    void ensureActiveQuest()
  }, [ensureActiveQuest])

  const createTopic = useCallback(
    async (topicData: { name: string; description?: string }) => {
      if (!userId) {
        toast.error('You must be logged in to create topics')
        return null
      }

      const payload = {
        user_id: userId,
        name: topicData.name.trim(),
        description: topicData.description?.trim() || null,
      }

      const { data, error: insertError } = await supabase
        .from('topics')
        .insert(payload)
        .select('*, topic_notes(count), topic_papers(count), topic_ideas(count)')
        .single()

      if (insertError) {
        console.error('Failed to create topic:', insertError)
        toast.error(insertError.message)
        return null
      }

      const mapped = mapTopicRow(data as TopicRow)
      upsertTopic(mapped)
      setSelectedTopic(mapped)
      toast.success('Topic created')
      await awardXP(userId, XP_REWARDS.CREATE_TOPIC, 'create_topic')
      void ensureActiveQuest()
      return mapped
    },
    [ensureActiveQuest, setSelectedTopic, upsertTopic, userId]
  )

  const adjustCounts = useCallback(
    (topicId: string, delta: Partial<Record<TopicEntityType, number>>) => {
      const topic = useAppStore.getState().topics.find((t) => t.id === topicId)
      if (!topic) return
      const updated: TopicWithCounts = {
        ...topic,
        note_count: topic.note_count + (delta.note ?? 0),
        paper_count: topic.paper_count + (delta.paper ?? 0),
        idea_count: topic.idea_count + (delta.idea ?? 0),
      }
      upsertTopic(updated)
      const currentSelected = useAppStore.getState().selectedTopic
      if (currentSelected?.id === topicId) {
        setSelectedTopic(updated)
      }
    },
    [setSelectedTopic, upsertTopic]
  )

  const incrementQuestProgress = useCallback(
    async (topicId: string) => {
      if (!userId) return
      const active = quests.find((quest) => quest.topic_id === topicId && quest.status === 'active')
      if (!active) return
      const nextProgress = Math.min(active.progress_count + 1, active.target_count)
      const nextStatus = nextProgress >= active.target_count ? 'completed' : active.status

      const { data, error: progressError } = await supabase
        .from('topic_quests')
        .update({
          progress_count: nextProgress,
          status: nextStatus,
        })
        .eq('id', active.id)
        .eq('user_id', userId)
        .select('*, topics(id, name, updated_at)')
        .single()

      if (progressError) {
        console.error('Failed to update quest progress:', progressError)
        return
      }

      if (data) {
        const quest = mapQuestRow(data as TopicQuestRow)
        setQuests((prev) => {
          const existingIndex = prev.findIndex((q) => q.id === quest.id)
          if (existingIndex === -1) {
            return [quest, ...prev]
          }
          const updated = [...prev]
          updated[existingIndex] = quest
          return updated
        })
        if (nextStatus === 'completed') {
          await awardXP(userId, XP_REWARDS.COMPLETE_TOPIC_QUEST, 'complete_topic_quest')
          toast.success('Topic quest completed!')
        }
      }
    },
    [quests, userId]
  )

  const updateTopic = useCallback(
    async (topicId: string, updates: { name?: string; description?: string }) => {
      if (!userId) {
        toast.error('You must be logged in to update topics')
        return false
      }

      const payload: Record<string, unknown> = {}
      if (typeof updates.name === 'string') {
        payload.name = updates.name.trim()
      }
      if (typeof updates.description === 'string') {
        payload.description = updates.description.trim() || null
      }

      const { error: updateError } = await supabase
        .from('topics')
        .update(payload)
        .eq('id', topicId)
        .eq('user_id', userId)

      if (updateError) {
        console.error('Failed to update topic:', updateError)
        toast.error(updateError.message)
        return false
      }

      await fetchTopicById(topicId)
      await incrementQuestProgress(topicId)
      await awardXP(userId, XP_REWARDS.UPDATE_TOPIC, 'update_topic')
      toast.success('Topic updated')
      return true
    },
    [fetchTopicById, incrementQuestProgress, userId]
  )

  const deleteTopic = useCallback(
    async (topicId: string) => {
      if (!userId) {
        toast.error('You must be logged in to delete topics')
        return false
      }

      const { error: deleteError } = await supabase
        .from('topics')
        .delete()
        .eq('id', topicId)
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Failed to delete topic:', deleteError)
        toast.error(deleteError.message)
        return false
      }

      removeTopic(topicId)
      linkCacheRef.current.forEach((ids, key) => {
        if (ids.includes(topicId)) {
          linkCacheRef.current.set(
            key,
            ids.filter((id) => id !== topicId)
          )
        }
      })
      const currentSelected = useAppStore.getState().selectedTopic
      if (currentSelected?.id === topicId) {
        setSelectedTopic(null)
      }
      setQuests((prev) => prev.filter((quest) => quest.topic_id !== topicId))
      void ensureActiveQuest()
      toast.success('Topic deleted')
      return true
    },
    [ensureActiveQuest, removeTopic, setSelectedTopic, userId]
  )

  const attachTopicToEntity = useCallback(
    async (topicId: string, entityId: string, entityType: TopicEntityType) => {
      if (!userId) {
        toast.error('You must be logged in to link topics')
        return false
      }

      const table = ENTITY_TABLE[entityType]
      const column = ENTITY_COLUMN[entityType]
      const payload = {
        topic_id: topicId,
        user_id: userId,
        [column]: entityId,
      }

      const { error: upsertError } = await supabase
        .from(table)
        .upsert(payload, { onConflict: `topic_id,${column}` })

      if (upsertError) {
        console.error('Failed to link topic:', upsertError)
        toast.error(upsertError.message)
        return false
      }

      adjustCounts(topicId, { [entityType]: 1 })
      const cacheKey = `${entityType}:${entityId}`
      const cached = linkCacheRef.current.get(cacheKey) || []
      if (!cached.includes(topicId)) {
        linkCacheRef.current.set(cacheKey, [...cached, topicId])
      }
      await incrementQuestProgress(topicId)
      await awardXP(userId, XP_REWARDS.TAG_ENTITY_WITH_TOPIC, 'tag_entity_with_topic')
      return true
    },
    [adjustCounts, incrementQuestProgress, userId]
  )

  const detachTopicFromEntity = useCallback(
    async (topicId: string, entityId: string, entityType: TopicEntityType) => {
      if (!userId) {
        toast.error('You must be logged in to unlink topics')
        return false
      }

      const table = ENTITY_TABLE[entityType]
      const column = ENTITY_COLUMN[entityType]

      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('topic_id', topicId)
        .eq(column, entityId)
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Failed to unlink topic:', deleteError)
        toast.error(deleteError.message)
        return false
      }

      adjustCounts(topicId, { [entityType]: -1 })
      const cacheKey = `${entityType}:${entityId}`
      const cached = linkCacheRef.current.get(cacheKey)
      if (cached) {
        linkCacheRef.current.set(
          cacheKey,
          cached.filter((id) => id !== topicId)
        )
      }
      return true
    },
    [adjustCounts, userId]
  )

  const getTopicIdsForEntity = useCallback(
    async (entityId: string, entityType: TopicEntityType) => {
      if (!userId) return []
      const cacheKey = `${entityType}:${entityId}`
      const cached = linkCacheRef.current.get(cacheKey)
      if (cached) {
        return cached
      }
      const table = ENTITY_TABLE[entityType]
      const column = ENTITY_COLUMN[entityType]
      const { data, error: fetchError } = await supabase
        .from(table)
        .select('topic_id')
        .eq('user_id', userId)
        .eq(column, entityId)

      if (fetchError) {
        console.error('Failed to fetch topic links:', fetchError)
        return []
      }

      const topicIds = (data || []).map((row) => row.topic_id)
      linkCacheRef.current.set(cacheKey, topicIds)
      return topicIds
    },
    [userId]
  )

  const activeQuest = useMemo(
    () => quests.find((quest) => quest.status === 'active') || null,
    [quests]
  )

  return {
    topics,
    loading,
    error,
    createTopic,
    updateTopic,
    deleteTopic,
    attachTopicToEntity,
    detachTopicFromEntity,
    getTopicIdsForEntity,
    fetchTopics,
    fetchTopicById,
    quests,
    questsLoading,
    activeQuest,
    refreshQuests: fetchQuests,
    advanceQuest: incrementQuestProgress,
  }
}
