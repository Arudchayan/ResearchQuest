-- Migration: api_keys + api_key_audit for agent REST gateway
-- Created at: 1764600000

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash TEXT NOT NULL,
    scopes TEXT[] NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT api_keys_key_hash_unique UNIQUE (key_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_active
    ON api_keys(user_id)
    WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS api_key_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    resource VARCHAR(128),
    status_code INTEGER,
    ip INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_audit_user_id ON api_key_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_key_id ON api_key_audit(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_audit_created_at ON api_key_audit(created_at DESC);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own api keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own api keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own api keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own api key audit"
    ON api_key_audit FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own api key audit"
    ON api_key_audit FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Mirror table definitions for reference
COMMENT ON TABLE api_keys IS 'Hashed per-user API keys for ResearchQuest agent REST gateway';
COMMENT ON TABLE api_key_audit IS 'Audit log for API key usage and lifecycle events';
