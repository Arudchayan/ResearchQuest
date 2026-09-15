CREATE TABLE papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    authors TEXT[] DEFAULT '{}',
    doi TEXT,
    source_url TEXT,
    status VARCHAR(50) DEFAULT 'To Read',
    -- Read cache of topic_papers membership (authority: topic_papers junction).
    topic_ids TEXT[] DEFAULT '{}',
    abstract TEXT,
    publication_date TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);