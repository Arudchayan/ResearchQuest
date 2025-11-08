CREATE TABLE research_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT false,
    xp_reward INTEGER DEFAULT 50,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);