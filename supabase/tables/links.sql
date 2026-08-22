-- Deprecated/unused: entity arrays and topic junction tables are the source of truth for relationships.
CREATE TABLE links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('note',
    'idea',
    'paper')),
    target_id UUID NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('note',
    'idea',
    'paper',
    'topic')),
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);