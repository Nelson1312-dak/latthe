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
  birth_date  text        NOT NULL,        -- stored as the string the client sends
  birth_hour  int         NOT NULL,        -- chi-hour index (0–11) or hour
  gender      smallint     NOT NULL,        -- 0 / 1
  lunar_date  text,
  lunar_hour  text,
  chart_json  jsonb,                        -- full computed chart
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tuvi_profiles_created_idx ON tuvi_profiles (created_at DESC);

ALTER TABLE tuvi_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert" ON tuvi_profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon_select" ON tuvi_profiles FOR SELECT TO anon USING (true);

-- ============================================================
-- RPC function: vector similarity search
-- Called from api/interpret.js for retrieval
-- ============================================================
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(768),
  match_threshold  float   DEFAULT 0.75,
  match_count      int     DEFAULT 3,
  filter_type      text    DEFAULT NULL
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
    AND (filter_type IS NULL OR type = filter_type)
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
