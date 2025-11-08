-- Migration: enhance_papers_and_rls
-- Created at: 1762557806

-- Enhance papers table for abstract extractor functionality
ALTER TABLE papers ADD COLUMN IF NOT EXISTS abstract_summary TEXT;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS key_insights TEXT;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS research_theme VARCHAR(100);
ALTER TABLE papers ADD COLUMN IF NOT EXISTS reading_notes TEXT;

-- Enable RLS on new tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_achievements ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Research goals policies
CREATE POLICY "Users can view own goals" ON research_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON research_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON research_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON research_goals FOR DELETE USING (auth.uid() = user_id);

-- Research projects policies
CREATE POLICY "Users can view own projects" ON research_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON research_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON research_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON research_projects FOR DELETE USING (auth.uid() = user_id);

-- Research milestones policies
CREATE POLICY "Users can view own milestones" ON research_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own milestones" ON research_milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON research_milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own milestones" ON research_milestones FOR DELETE USING (auth.uid() = user_id);

-- Research achievements policies
CREATE POLICY "Users can view own achievements" ON research_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own achievements" ON research_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_research_goals_user_id ON research_goals(user_id);
CREATE INDEX idx_research_projects_user_id ON research_projects(user_id);
CREATE INDEX idx_research_milestones_user_id ON research_milestones(user_id);
CREATE INDEX idx_research_achievements_user_id ON research_achievements(user_id);

-- Add triggers for updated_at
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_research_goals_updated_at BEFORE UPDATE ON research_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  
CREATE TRIGGER update_research_projects_updated_at BEFORE UPDATE ON research_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();;