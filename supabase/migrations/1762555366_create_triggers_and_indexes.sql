-- Migration: create_triggers_and_indexes
-- Created at: 1762555366

-- Create function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, total_xp, current_level, current_streak, longest_streak)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', 'Researcher'), 0, 1, 0, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signups
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_topics_updated_at BEFORE UPDATE ON topics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_papers_updated_at BEFORE UPDATE ON papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ideas_updated_at BEFORE UPDATE ON ideas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Performance indexes for common queries
CREATE INDEX idx_papers_user_id ON papers(user_id);
CREATE INDEX idx_papers_status ON papers(status);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);
CREATE INDEX idx_ideas_user_id ON ideas(user_id);
CREATE INDEX idx_ideas_stage ON ideas(stage);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, date DESC);
CREATE INDEX idx_links_source ON links(source_id, source_type);
CREATE INDEX idx_links_target ON links(target_id, target_type);
CREATE INDEX idx_links_user_id ON links(user_id);;