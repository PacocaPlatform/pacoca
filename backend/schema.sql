-- Paçoca community store (Cloudflare D1 / SQLite) — canonical target schema.
--
-- Idempotent: every statement is CREATE ... IF NOT EXISTS, so `npm run db:local`
-- and `db:remote` are safe to re-run. This is the single source of truth for the
-- schema. No data has shipped yet, so there are no migrations to carry: to change
-- the shape, edit here and recreate the DB.

-- Users authenticated via Google Sign-In. `google_sub` is the stable Google
-- account id ("sub" claim); we mint our own `id` so the rest of the schema never
-- leaks the Google identifier.
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,              -- uuid (crypto.randomUUID)
    google_sub  TEXT NOT NULL UNIQUE,          -- Google "sub" claim
    email       TEXT,
    name        TEXT,                          -- display name (from Google profile)
    picture     TEXT,                          -- avatar URL
    created_at  INTEGER NOT NULL               -- unix ms
);

-- Community levels. Publishing now requires login, so author_id is always set on
-- new rows; it stays nullable only to tolerate pre-auth rows already in the DB.
CREATE TABLE IF NOT EXISTS levels (
    id             TEXT PRIMARY KEY,              -- uuid (crypto.randomUUID)
    name           TEXT NOT NULL,
    theme          TEXT NOT NULL DEFAULT 'forest',
    difficulty     TEXT NOT NULL DEFAULT 'normal',-- infantil|iniciante|normal|hard|impossible
    author_id      TEXT,                          -- users.id of the publisher
    author_name    TEXT,                          -- display name shown in listings
    map_json       TEXT NOT NULL,                 -- canonical structured level JSON
    schema_version INTEGER NOT NULL DEFAULT 1,
    play_count     INTEGER NOT NULL DEFAULT 0,
    like_count     INTEGER NOT NULL DEFAULT 0,    -- denormalized count of likes rows
    is_public      INTEGER NOT NULL DEFAULT 1,    -- 0/1
    status         TEXT NOT NULL DEFAULT 'active',-- moderation: active | hidden | removed
    created_at     INTEGER NOT NULL,              -- unix ms
    updated_at     INTEGER NOT NULL               -- unix ms
);

-- One row per (user, level) like. like_count on levels is kept in sync in the
-- same request; this table is the source of truth and enforces "one like each".
CREATE TABLE IF NOT EXISTS likes (
    user_id    TEXT NOT NULL,
    level_id   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, level_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_level ON likes (level_id);

-- One row per (user, level) saved to a player's personal collection ("Minha
-- coleção"). Unlike likes there is no denormalized count on levels — a
-- collection is a private bookmark, not a public signal.
CREATE TABLE IF NOT EXISTS collections (
    user_id    TEXT NOT NULL,
    level_id   TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, level_id)
);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections (user_id, created_at DESC);

-- Browse feeds: newest, most-played and most-liked public+active levels.
CREATE INDEX IF NOT EXISTS idx_levels_feed_new
    ON levels (is_public, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_levels_feed_popular
    ON levels (is_public, status, play_count DESC);
CREATE INDEX IF NOT EXISTS idx_levels_feed_liked
    ON levels (is_public, status, like_count DESC);

-- "My levels" lookups and the authors leaderboard.
CREATE INDEX IF NOT EXISTS idx_levels_author
    ON levels (author_id);
