-- Add user preference for auto-creating reading tasks
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS auto_create_reading_tasks BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_profiles.auto_create_reading_tasks 
IS 'When enabled, automatically creates a reading task when a paper is added to the library';
