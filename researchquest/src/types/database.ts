export type ReadingStatus = "To Read" | "Reading" | "Read";
export type IdeaStage = "Seed" | "Developing" | "Supported" | "Mature";
export type EntityType = "note" | "idea" | "paper" | "topic";
export type ThemePreference = "light" | "dark" | "auto";
export type FeedItemType = "paper" | "job" | "news" | "custom";
export type FeedItemStatus = "new" | "triaged" | "archived" | "promoted";
export type FeedPromoteTarget = "paper" | "task" | "note";
export type JsonRecord = Record<string, unknown>;

export interface ActiveBoost {
  type: string;
  label?: string;
  multiplier?: number;
  expires_at: string;
}

export interface Topic {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface TopicWithCounts extends Topic {
  note_count: number;
  paper_count: number;
  idea_count: number;
}

export type TopicEntityType = "note" | "paper" | "idea";

export interface TopicQuest {
  id: string;
  user_id: string;
  topic_id: string;
  objective: string;
  target_count: number;
  progress_count: number;
  due_date?: string;
  status: "active" | "completed" | "expired";
  created_at: string;
  updated_at: string;
}

export interface TopicQuestWithTopic extends TopicQuest {
  topic?: Pick<Topic, "id" | "name" | "updated_at">;
}

export interface Paper {
  id: string;
  user_id: string;
  title: string;
  authors: string[];
  doi?: string;
  source_url?: string;
  status: ReadingStatus;
  topic_ids?: string[];
  abstract?: string;
  publication_date?: string;
  created_at: string;
  updated_at: string;
}

export type PaperDraft = Pick<Paper, "title" | "authors"> &
  Partial<
    Pick<
      Paper,
      "doi" | "source_url" | "status" | "topic_ids" | "abstract" | "publication_date"
    >
  >;

export interface Note {
  id: string;
  user_id: string;
  title?: string;
  markdown_body: string;
  tags: string[];
  linked_entity_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Idea {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  stage: IdeaStage;
  linked_note_ids?: string[];
  linked_paper_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  due_date?: string;
  completed: boolean;
  category?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FeedSource {
  id: string;
  user_id: string;
  name: string;
  kind: string;
  config: JsonRecord;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedItem {
  id: string;
  user_id: string;
  source_id?: string | null;
  type: FeedItemType;
  title: string;
  summary?: string | null;
  url?: string | null;
  payload: JsonRecord;
  status: FeedItemStatus;
  external_id?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date: string;
  summary?: string;
  xp_earned: number;
  streak_count: number;
  created_at: string;
}

export interface Link {
  id: string;
  user_id: string;
  source_id: string;
  source_type: EntityType;
  target_id: string;
  target_type: EntityType;
  context?: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username?: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  longest_streak: number;
  last_activity_date?: string;
  streak_freeze_tokens: number;
  active_boost?: ActiveBoost | null;
  rest_days: number;
  auto_create_reading_tasks?: boolean;
  theme_preference: ThemePreference;
  notes_count?: number;
  papers_count?: number;
  tasks_completed_count?: number;
  papers_with_insights_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CrossrefPaper {
  doi: string;
  title: string;
  authors: string[];
  abstract: string;
  publicationDate: number | null;
  sourceUrl: string;
  containerTitle: string;
  publisher: string;
  type: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: string;
  title: string;
  description: string;
  xp_awarded: number;
  earned_at: string;
}
