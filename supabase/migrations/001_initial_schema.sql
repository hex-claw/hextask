-- HexTask Database Schema

-- Users table (simple - just J and Hex)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  avatar_url TEXT,
  is_ai BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Insert our two users
INSERT INTO users (name, email, is_ai) VALUES 
  ('J', 'j@hextask.app', false),
  ('Hex', 'hexclaw@proton.me', true);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
  assignee_id UUID REFERENCES users(id),
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  position INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (simple setup)
CREATE POLICY "Allow all for users" ON users FOR ALL USING (true);
CREATE POLICY "Allow all for tasks" ON tasks FOR ALL USING (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Indexes for performance
CREATE INDEX tasks_assignee_idx ON tasks(assignee_id);
CREATE INDEX tasks_status_idx ON tasks(status);
CREATE INDEX tasks_parent_idx ON tasks(parent_id);
CREATE INDEX tasks_due_date_idx ON tasks(due_date);
