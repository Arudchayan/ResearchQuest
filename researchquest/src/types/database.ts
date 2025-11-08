export type ReadingStatus = 'To Read' | 'Reading' | 'Read'
export type IdeaStage = 'Seed' | 'Developing' | 'Supported' | 'Mature'
export type EntityType = 'note' | 'idea' | 'paper' | 'topic'
export type ThemePreference = 'light' | 'dark' | 'auto'

export interface Topic {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface Paper {
  id: string
  user_id: string
  title: string
  authors: string[]
  doi?: string
  source_url?: string
  status: ReadingStatus
  topic_ids?: string[]
  abstract?: string
  publication_date?: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  title?: string
  markdown_body: string
  tags: string[]
  linked_entity_ids?: string[]
  created_at: string
  updated_at: string
}

export interface Idea {
  id: string
  user_id: string
  title: string
  description?: string
  stage: IdeaStage
  linked_note_ids?: string[]
  linked_paper_ids?: string[]
  created_at: string
  updated_at: string
}

export interface DailyLog {
  id: string
  user_id: string
  date: string
  summary?: string
  xp_earned: number
  streak_count: number
  created_at: string
}

export interface Link {
  id: string
  user_id: string
  source_id: string
  source_type: EntityType
  target_id: string
  target_type: EntityType
  context?: string
  created_at: string
}

export interface UserProfile {
  id: string
  username?: string
  total_xp: number
  current_level: number
  current_streak: number
  longest_streak: number
  last_activity_date?: string
  theme_preference: ThemePreference
  created_at: string
  updated_at: string
}

export interface CrossrefPaper {
  doi: string
  title: string
  authors: string[]
  abstract: string
  publicationDate: number | null
  sourceUrl: string
  containerTitle: string
  publisher: string
  type: string
}
