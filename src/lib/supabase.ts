import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type User = {
  id: string
  name: string
  email: string | null
  avatar_url: string | null
  is_ai: boolean
  created_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
  priority: 'urgent' | 'high' | 'medium' | 'low'
  assignee_id: string | null
  parent_id: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  position: number
  // Joined data
  assignee?: User
  subtasks?: Task[]
}
