-- Harden owner-scoped RLS gaps for tables that already store user_id.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'research_achievements'
      AND policyname = 'Users can update own achievements'
  ) THEN
    CREATE POLICY "Users can update own achievements"
      ON public.research_achievements FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'research_achievements'
      AND policyname = 'Users can delete own achievements'
  ) THEN
    CREATE POLICY "Users can delete own achievements"
      ON public.research_achievements FOR DELETE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'focus_sessions'
      AND policyname = 'Users update own focus_sessions'
  ) THEN
    CREATE POLICY "Users update own focus_sessions"
      ON public.focus_sessions FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
