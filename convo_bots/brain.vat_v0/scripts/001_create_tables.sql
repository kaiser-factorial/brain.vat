-- brain.vat database schema
-- Messages table for the conversation feed
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  speaker TEXT NOT NULL,
  text TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('bot', 'user')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory concepts for bot obsessions
CREATE TABLE IF NOT EXISTS memory_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot TEXT NOT NULL CHECK (bot IN ('a', 'b')),
  concept TEXT NOT NULL,
  weight FLOAT DEFAULT 1.0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace files for bots' private and shared files
CREATE TABLE IF NOT EXISTS workspace_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space TEXT NOT NULL CHECK (space IN ('bot_a', 'bot_b', 'shared')),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Messages: everyone can read, authenticated users can insert their own
CREATE POLICY "messages_select_all" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (
  auth.uid() = user_id OR role = 'bot'
);

-- Memory concepts: everyone can read
CREATE POLICY "memory_concepts_select_all" ON memory_concepts FOR SELECT USING (true);

-- Workspace files: everyone can read
CREATE POLICY "workspace_files_select_all" ON workspace_files FOR SELECT USING (true);

-- Profiles: everyone can read, users can manage their own
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
