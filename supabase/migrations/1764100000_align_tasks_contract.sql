-- Align existing task tables with the canonical frontend task contract.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
UPDATE public.tasks SET completed = false WHERE completed IS NULL;
ALTER TABLE public.tasks ALTER COLUMN completed SET DEFAULT false;
ALTER TABLE public.tasks ALTER COLUMN completed SET NOT NULL;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'status'
  ) THEN
    UPDATE public.tasks
    SET completed = true
    WHERE status IN ('completed', 'done')
      AND completed = false;
  END IF;
END $$;
