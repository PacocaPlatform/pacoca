-- Paçoca community levels store (Cloudflare D1 / SQLite).
--
-- Designed so user login can be added later without a painful migration:
-- author_id is nullable now (anonymous publishing) and becomes the owner key
-- once auth exists; author_name is the display label shown in listings.

CREATE TABLE IF NOT EXISTS levels (
    id             TEXT PRIMARY KEY,              -- uuid (crypto.randomUUID)
    name           TEXT NOT NULL,
    theme          TEXT NOT NULL DEFAULT 'forest',
    author_id      TEXT,                          -- reserved for auth; NULL = anonymous
    author_name    TEXT,                          -- display name shown in listings
    map_json       TEXT NOT NULL,                 -- canonical structured level JSON
    schema_version INTEGER NOT NULL DEFAULT 1,
    play_count     INTEGER NOT NULL DEFAULT 0,
    is_public      INTEGER NOT NULL DEFAULT 1,    -- 0/1
    status         TEXT NOT NULL DEFAULT 'active',-- moderation: active | hidden | removed
    created_at     INTEGER NOT NULL,              -- unix ms
    updated_at     INTEGER NOT NULL               -- unix ms
);

-- Browse feeds: newest and most-played public+active levels.
CREATE INDEX IF NOT EXISTS idx_levels_feed_new
    ON levels (is_public, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_levels_feed_popular
    ON levels (is_public, status, play_count DESC);

-- "My levels" lookups once login exists.
CREATE INDEX IF NOT EXISTS idx_levels_author
    ON levels (author_id);
