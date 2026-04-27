-- focus_sessions: persisted completed focus blocks for dashboard aggregates and history (RQ-M2-06 / RQ-M2-07)

CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0),
  target_type text,
  target_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed
  ON public.focus_sessions (user_id, completed_at DESC);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own focus_sessions"
  ON public.focus_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own focus_sessions"
  ON public.focus_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own focus_sessions"
  ON public.focus_sessions FOR DELETE
  USING (auth.uid() = user_id);
