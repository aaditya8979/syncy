-- ═══════════════════════════════════════════════════════════════════════════════
-- Syncy Rooms — Supabase Schema
-- Run this in the SQL Editor at: https://supabase.com/dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Rooms table ──────────────────────────────────────────────────────────
create table if not exists public.rooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 100),
  host_id      uuid not null references auth.users(id) on delete cascade,
  passcode     text default null,
  status       text not null default 'idle' check (status in ('idle','playing','paused','ended')),
  queue        jsonb not null default '[]'::jsonb,
  current_song jsonb default null,
  updated_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Auto-update `updated_at` on any row change (heartbeat for admin disconnect detection)
create or replace function public.rooms_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists rooms_updated_at on public.rooms;
create trigger rooms_updated_at
  before update on public.rooms
  for each row execute function public.rooms_touch_updated_at();

-- ── 2. Room Members (presence fallback + history) ───────────────────────────
create table if not exists public.room_members (
  id        bigint generated always as identity primary key,
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  username  text not null default 'Guest',
  joined_at timestamptz not null default now(),
  unique(room_id, user_id)
);

-- ── 3. Room Queue (suggestion box — users push, admin promotes) ─────────────
create table if not exists public.room_queue (
  id          bigint generated always as identity primary key,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  song_data   jsonb not null,
  status      text not null default 'suggested' check (status in ('suggested','queued','played','skipped')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_room_queue_room on public.room_queue(room_id, status);

-- ── 4. Room Polls ───────────────────────────────────────────────────────────
create table if not exists public.room_polls (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  question     text not null,
  options_json jsonb not null default '[]'::jsonb,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ── 5. Room Poll Votes ──────────────────────────────────────────────────────
create table if not exists public.room_poll_votes (
  id        bigint generated always as identity primary key,
  poll_id   uuid not null references public.room_polls(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  option_idx int not null,
  created_at timestamptz not null default now(),
  unique(poll_id, user_id)  -- one vote per user per poll
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_queue enable row level security;
alter table public.room_polls enable row level security;
alter table public.room_poll_votes enable row level security;

-- Rooms: anyone authenticated can read; only host can update/delete
create policy "rooms_select"  on public.rooms for select using (true);
create policy "rooms_insert"  on public.rooms for insert with check (auth.uid() = host_id);
create policy "rooms_update"  on public.rooms for update using (auth.uid() = host_id);
create policy "rooms_delete"  on public.rooms for delete using (auth.uid() = host_id);

-- Room members: anyone can join; only self can delete own membership
create policy "members_select" on public.room_members for select using (true);
create policy "members_insert" on public.room_members for insert with check (auth.uid() = user_id);
create policy "members_delete" on public.room_members for delete using (auth.uid() = user_id);

-- Room queue: anyone can suggest; host can update status
create policy "queue_select"  on public.room_queue for select using (true);
create policy "queue_insert"  on public.room_queue for insert with check (auth.uid() = user_id);
create policy "queue_update"  on public.room_queue for update using (
  auth.uid() = (select host_id from public.rooms where id = room_id)
);

-- Polls: anyone can read; host creates
create policy "polls_select" on public.room_polls for select using (true);
create policy "polls_insert" on public.room_polls for insert with check (
  auth.uid() = (select host_id from public.rooms where id = room_id)
);
create policy "polls_update" on public.room_polls for update using (
  auth.uid() = (select host_id from public.rooms where id = room_id)
);

-- Poll votes: anyone can vote once
create policy "votes_select" on public.room_poll_votes for select using (true);
create policy "votes_insert" on public.room_poll_votes for insert with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Enable Realtime for rooms table (broadcasts state changes to all listeners)
-- ═══════════════════════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_queue;
alter publication supabase_realtime add table public.room_polls;
alter publication supabase_realtime add table public.room_poll_votes;

-- ═══════════════════════════════════════════════════════════════════════════════
-- User Activity table (if not already created)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.user_activity (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id),
  email      text,
  action     text,
  created_at timestamptz not null default now()
);
-- Allow any extra columns via jsonb or just ignore unknown cols
alter table public.user_activity enable row level security;
create policy "activity_insert" on public.user_activity for insert with check (true);
create policy "activity_select" on public.user_activity for select using (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Playlist Tracks (Security Hardening)
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  id          bigint generated always as identity primary key,
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id     text not null,
  song_data   jsonb not null,
  created_at  timestamptz not null default now()
);

alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;

-- Only the owner can view/modify their playlists
create policy "playlists_select" on public.playlists for select using (auth.uid() = user_id);
create policy "playlists_insert" on public.playlists for insert with check (auth.uid() = user_id);
create policy "playlists_delete" on public.playlists for delete using (auth.uid() = user_id);

-- Playlist tracks RLS (via join to playlists)
create policy "playlist_tracks_select" on public.playlist_tracks for select using (
  auth.uid() = (select user_id from public.playlists where id = playlist_id)
);
create policy "playlist_tracks_insert" on public.playlist_tracks for insert with check (
  auth.uid() = (select user_id from public.playlists where id = playlist_id)
);
create policy "playlist_tracks_delete" on public.playlist_tracks for delete using (
  auth.uid() = (select user_id from public.playlists where id = playlist_id)
);
