-- ============================================================
-- Latthe RAG Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create anon role if it does not exist (for local PostgreSQL compatibility)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END
$$;

-- Q&A documents table
CREATE TABLE IF NOT EXISTS documents (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  type        text        NOT NULL,        -- 'tarot' | 'gieoque'
  question    text        NOT NULL,
  context     text,                        -- card/hexagram raw context
  answer      text        NOT NULL,
  embedding   vector(768),                 -- nomic-embed-text output
  is_followup boolean     DEFAULT false,   -- true = follow-up chat, excluded from cache
  source      text        NOT NULL DEFAULT 'qa',  -- 'qa' = Q&A cache | 'kb' = Thư Viện knowledge chunk
  created_at  timestamptz DEFAULT now()
);

-- Vector similarity index (IVFFlat — fast approximate search)
CREATE INDEX IF NOT EXISTS documents_embedding_idx
  ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Index on type and followup flag for filtered queries
CREATE INDEX IF NOT EXISTS documents_type_idx ON documents (type);
CREATE INDEX IF NOT EXISTS documents_followup_idx ON documents (is_followup);

-- Supports the Tier-1 exact-match cache lookup in api/interpret.js
-- (filters by type = ... AND question = ...). Keeps that GET fast as the table grows.
CREATE INDEX IF NOT EXISTS documents_exact_lookup_idx ON documents (type, question);

-- Separates the Q&A cache ('qa') from Thư Viện knowledge chunks ('kb')
CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source);

-- RLS: allow backend (anon key from serverless function) to read/write
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON documents FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert" ON documents FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- Tử Vi birth profiles (written by api/save-profile.js)
-- ============================================================
CREATE TABLE IF NOT EXISTS tuvi_profiles (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text        NOT NULL,
  birth_date  date        NOT NULL,
  birth_hour  integer     NOT NULL,        -- chi-hour index (0–11) or hour
  gender      integer     NOT NULL,        -- 0 / 1
  lunar_date  text,
  lunar_hour  text,
  chart_json  jsonb,                        -- full computed chart
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tuvi_profiles_created_idx ON tuvi_profiles (created_at DESC);

-- ============================================================
-- RPC function: vector similarity search
-- Called from api/interpret.js for retrieval
-- ============================================================
-- Drop the old 4-arg signature first so adding filter_source doesn't create an overload.
DROP FUNCTION IF EXISTS match_documents(vector, float, int, text);

CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(768),
  match_threshold  float   DEFAULT 0.75,
  match_count      int     DEFAULT 3,
  filter_type      text    DEFAULT NULL,
  filter_source    text    DEFAULT 'qa'   -- 'qa' = cache (default, unchanged) | 'kb' = Thư Viện
)
RETURNS TABLE (
  id         uuid,
  question   text,
  context    text,
  answer     text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    question,
    context,
    answer,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE
    embedding IS NOT NULL
    AND is_followup = false
    AND source = filter_source
    AND (filter_type IS NULL OR type = filter_type)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- MIGRATION for an existing database (run once if your DB predates the
-- `source` column). Safe to run repeatedly.
-- ============================================================
-- ALTER TABLE documents ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'qa';
-- CREATE INDEX IF NOT EXISTS documents_source_idx ON documents (source);
-- (then re-run the DROP FUNCTION + CREATE FUNCTION match_documents block above)
