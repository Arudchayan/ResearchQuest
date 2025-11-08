CREATE TABLE research_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    progress INTEGER DEFAULT 0,
    target_value INTEGER DEFAULT 100,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active',
    'completed',
    'archived')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);