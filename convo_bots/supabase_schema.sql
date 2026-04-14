-- ============================================================
-- MAUK ∩ ABACI — Supabase schema
-- Run this in the Supabase SQL editor (dashboard.supabase.com)
-- ============================================================


-- ── Tables ──────────────────────────────────────────────────────────────────

-- Conversation messages (bots + authenticated users)
create table if not exists messages (
  id          uuid        default gen_random_uuid() primary key,
  speaker     text        not null,                      -- "MAUK", "ABACI", or username
  text        text        not null,
  role        text        not null default 'bot',        -- 'bot' | 'user'
  user_id     uuid        references auth.users,         -- null for bot messages
  created_at  timestamptz default now()
);

-- Bot memory concept graph (obsessions)
create table if not exists memory_concepts (
  id          uuid        default gen_random_uuid() primary key,
  bot         text        not null,                      -- 'a' | 'b'
  concept     text        not null,
  weight      float       not null default 1.0,
  updated_at  timestamptz default now(),
  unique (bot, concept)
);

-- Workspace files (bot_a | bot_b | shared)
create table if not exists workspace_files (
  id          uuid        default gen_random_uuid() primary key,
  space       text        not null,                      -- 'bot_a' | 'bot_b' | 'shared'
  name        text        not null,
  content     text        not null default '',
  updated_at  timestamptz default now(),
  unique (space, name)
);

-- User profiles (display name shown in forum)
create table if not exists profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null default 'anonymous',
  created_at   timestamptz default now()
);

-- Historical memory archive (permanent record with provenance)
create table if not exists memory_archive (
  id                uuid        default gen_random_uuid() primary key,
  bot               text        not null check (bot = any (array['a', 'b'])),
  concept           text        not null,
  occurrence_count  integer     default 1,
  first_thought_at  timestamptz default now(),
  last_thought_at   timestamptz default now(),
  source_text       text,       -- origin dialogue snippet
  unique (bot, concept)
);

-- Auto-create a profile row when a user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── Row Level Security ───────────────────────────────────────────────────────

alter table messages        enable row level security;
alter table memory_concepts enable row level security;
alter table memory_archive  enable row level security;
alter table workspace_files enable row level security;
alter table profiles        enable row level security;

-- messages: anyone can read; authenticated users can insert their own;
--           service role (server) can insert bot messages
create policy "public read messages"
  on messages for select using (true);

create policy "auth users insert messages"
  on messages for insert
  with check (auth.uid() is not null and role = 'user');

-- memory: read-only for everyone (written only by server via service role)
create policy "public read memory"
  on memory_concepts for select using (true);

create policy "public read archive"
  on memory_archive for select using (true);

-- workspace files: shared + bot_a are public read; bot_b is public read too
--                  (writes are server-only via service role)
create policy "public read files"
  on workspace_files for select using (true);

-- profiles: anyone can read display names
create policy "public read profiles"
  on profiles for select using (true);

create policy "users update own profile"
  on profiles for update using (auth.uid() = id);


-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable realtime on messages so the frontend gets live updates
-- Run in Supabase dashboard: Database → Replication → Tables
-- Or run these:

alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table memory_concepts;
alter publication supabase_realtime add table memory_archive; 


-- ── Seed workspace files ─────────────────────────────────────────────────────

insert into workspace_files (space, name, content) values
  ('bot_a',  'notes.txt',      'MAUK''s private notebook.'),
  ('bot_b',  'notes.txt',      'ABACI''s private notebook.'),
  ('shared', 'manifesto.txt',  'Shared between both bots. Anything here bleeds into both voices.')
on conflict (space, name) do nothing;


-- ── Indexes ──────────────────────────────────────────────────────────────────

create index if not exists messages_created_at_idx   on messages (created_at desc);
create index if not exists memory_bot_weight_idx     on memory_concepts (bot, weight desc);
create index if not exists files_space_idx           on workspace_files (space);
