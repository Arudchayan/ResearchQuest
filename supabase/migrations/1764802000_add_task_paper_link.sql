-- Link tasks to papers (auto-created reading tasks surface their paper)
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS paper_id UUID REFERENCES papers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_paper_id ON tasks(paper_id);

COMMENT ON COLUMN tasks.paper_id
IS 'Optional link to the paper this task relates to (e.g. auto-created reading tasks)';
