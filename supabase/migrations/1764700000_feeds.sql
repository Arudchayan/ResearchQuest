-- Migration: feeds schema for ingest and triage API
-- Created at: 1764700000

CREATE TABLE IF NOT EXISTS feed_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    kind VARCHAR(64) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feed_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_id UUID REFERENCES feed_sources(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('paper', 'job', 'news', 'custom')),
    title TEXT NOT NULL,
    summary TEXT,
    url TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triaged', 'archived', 'promoted')),
    external_id TEXT,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_sources_user_id ON feed_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_sources_user_enabled ON feed_sources(user_id, enabled);

CREATE INDEX IF NOT EXISTS idx_feed_items_user_id ON feed_items(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_user_status ON feed_items(user_id, status);
CREATE INDEX IF NOT EXISTS idx_feed_items_user_type ON feed_items(user_id, type);
CREATE INDEX IF NOT EXISTS idx_feed_items_source_id ON feed_items(source_id);
CREATE INDEX IF NOT EXISTS idx_feed_items_published_at ON feed_items(published_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_items_user_external_id
    ON feed_items(user_id, external_id)
    WHERE external_id IS NOT NULL;

ALTER TABLE feed_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feed sources"
    ON feed_sources FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed sources"
    ON feed_sources FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed sources"
    ON feed_sources FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed sources"
    ON feed_sources FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own feed items"
    ON feed_items FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feed items"
    ON feed_items FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feed items"
    ON feed_items FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feed items"
    ON feed_items FOR DELETE
    USING (auth.uid() = user_id);

CREATE TRIGGER update_feed_sources_updated_at BEFORE UPDATE ON feed_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_feed_items_updated_at BEFORE UPDATE ON feed_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE feed_sources IS 'Per-user feed source definitions for agent and external ingest';
COMMENT ON TABLE feed_items IS 'Per-user feed inbox items for triage and promotion';
