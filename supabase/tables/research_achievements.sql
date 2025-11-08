CREATE TABLE research_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    xp_awarded INTEGER DEFAULT 0,
    earned_at TIMESTAMPTZ DEFAULT now()
);