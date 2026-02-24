-- SYNCY v7 — Full DB setup. Paste into Supabase SQL Editor and Run.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DROP TABLE IF EXISTS public.room_members  CASCADE;
DROP TABLE IF EXISTS public.rooms         CASCADE;
DROP TABLE IF EXISTS public.user_activity CASCADE;

CREATE TABLE public.rooms (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  host_id      UUID NOT NULL,
  passcode     TEXT,
  current_song JSONB,
  queue        JSONB DEFAULT '[]',
  status       TEXT DEFAULT 'idle',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.room_members (
  room_id   UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  username  TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(room_id, user_id)
);

CREATE TABLE public.user_activity (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID,
  email         TEXT,
  action        TEXT NOT NULL,
  password_hint TEXT,
  username      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.rooms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_rooms"     ON public.rooms         FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY "open_members"   ON public.room_members  FOR ALL USING(true) WITH CHECK(true);
CREATE POLICY "ins_activity"   ON public.user_activity FOR INSERT WITH CHECK(true);
CREATE POLICY "sel_activity"   ON public.user_activity FOR SELECT USING(true);

SELECT 'Syncy v7 DB ready ✓' AS status;
