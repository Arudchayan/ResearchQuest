-- Migration: enable_realtime_for_tasks
-- Created at: 1762559748

-- Enable realtime for tasks table
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;

-- Also ensure other tables are enabled
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_logs;