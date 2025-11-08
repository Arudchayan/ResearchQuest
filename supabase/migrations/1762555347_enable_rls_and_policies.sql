-- Migration: enable_rls_and_policies
-- Created at: 1762555347

-- Enable RLS on all tables
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Topics policies (shared across users initially, can be made private later)
CREATE POLICY "Topics are viewable by everyone" ON topics FOR SELECT USING (true);
CREATE POLICY "Users can insert topics" ON topics FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update topics" ON topics FOR UPDATE USING (true);
CREATE POLICY "Users can delete topics" ON topics FOR DELETE USING (true);

-- Papers policies
CREATE POLICY "Users can view own papers" ON papers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own papers" ON papers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own papers" ON papers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own papers" ON papers FOR DELETE USING (auth.uid() = user_id);

-- Notes policies
CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- Ideas policies
CREATE POLICY "Users can view own ideas" ON ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ideas" ON ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ideas" ON ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ideas" ON ideas FOR DELETE USING (auth.uid() = user_id);

-- Daily logs policies
CREATE POLICY "Users can view own daily logs" ON daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily logs" ON daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily logs" ON daily_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily logs" ON daily_logs FOR DELETE USING (auth.uid() = user_id);

-- Links policies
CREATE POLICY "Users can view own links" ON links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own links" ON links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own links" ON links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own links" ON links FOR DELETE USING (auth.uid() = user_id);

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);;