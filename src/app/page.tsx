'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Task, User, supabase } from '@/lib/supabase'
import { getCurrentUser, signOut, onAuthStateChange } from '@/lib/auth'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { BoardCard } from '@/components/BoardCard'
import { 
  Plus, 
  Search,
  LayoutGrid,
  List,
  Bot,
  User as UserIcon,
  Hexagon,
  LogOut
} from 'lucide-react'

type ViewMode = 'list' | 'board'
type FilterStatus = Task['status'] | 'all'

export default function Home() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [modalTask, setModalTask] = useState<Task | null | 'new'>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterAssignee, setFilterAssignee] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Check auth on mount
  useEffect(() => {
    checkAuth()
    
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      } else if (event === 'SIGNED_IN') {
        checkAuth()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkAuth = async () => {
    const user = await getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    setAuthChecked(true)
    fetchData()
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    // Fetch users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')
    
    if (usersError) {
      console.error('Error fetching users:', usersError)
      setError('Failed to load users')
    }
    
    // Fetch tasks
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      setError('Failed to load tasks')
    }
    
    if (usersData) {
      setUsers(usersData)
    }
    
    if (tasksData) {
      // Build task tree
      const taskMap = new Map<string, Task>()
      tasksData.forEach(t => taskMap.set(t.id, { ...t, subtasks: [] }))
      
      const rootTasks: Task[] = []
      taskMap.forEach(task => {
        if (task.parent_id && taskMap.has(task.parent_id)) {
          const parent = taskMap.get(task.parent_id)!
          parent.subtasks = parent.subtasks || []
          parent.subtasks.push(task)
        } else {
          rootTasks.push(task)
        }
      })
      
      setTasks(rootTasks)
    }
    
    setLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (filterAssignee !== 'all' && task.assignee_id !== filterAssignee) return false
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  // Group by status for board view
  const statusGroups = {
    backlog: filteredTasks.filter(t => t.status === 'backlog'),
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    review: filteredTasks.filter(t => t.status === 'review'),
    done: filteredTasks.filter(t => t.status === 'done'),
  }

  // Save task
  const handleSaveTask = async (taskData: Partial<Task>) => {
    setError(null)
    
    try {
      if (taskData.id) {
        // Update
        const { id, subtasks, assignee, ...updateData } = taskData as Task
        const { error } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', id)
        
        if (error) {
          console.error('Error updating task:', error)
          setError(`Failed to update task: ${error.message}`)
          return
        }
      } else {
        // Create - exclude id field
        const { id, subtasks, assignee, ...insertData } = taskData as Task
        const { error } = await supabase
          .from('tasks')
          .insert([insertData])
        
        if (error) {
          console.error('Error creating task:', error)
          setError(`Failed to create task: ${error.message}`)
          return
        }
      }
      
      fetchData()
      setModalTask(null)
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    }
  }

  // Delete task
  const handleDeleteTask = async (id: string) => {
    setError(null)
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting task:', error)
      setError(`Failed to delete task: ${error.message}`)
      return
    }
    
    fetchData()
    setModalTask(null)
  }

  // Update task (quick update from card)
  const handleUpdateTask = async (taskData: Partial<Task> & { id: string }) => {
    const { subtasks, assignee, ...updateData } = taskData as Task & { id: string }
    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskData.id)
    
    if (error) {
      console.error('Error updating task:', error)
      setError(`Failed to update task: ${error.message}`)
      return
    }
    
    fetchData()
  }

  const statusLabels = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  }

  // Loading/auth check
  if (!authChecked || loading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass p-8 text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen gradient-bg">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 text-center">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/30 rounded-lg">
                  <Hexagon size={24} className="text-purple-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">HexTask</h1>
                  <p className="text-sm text-gray-400">J + Hex Co-working</p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <a
                  href="/"
                  className="px-4 py-2 rounded-md text-sm font-medium bg-purple-600 text-white"
                >
                  Tasks
                </a>
                <a
                  href="/documents"
                  className="px-4 py-2 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Documents
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-4">
              {/* Current user indicator */}
              {currentUser && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                  <div className={`p-1 rounded-full ${currentUser.is_ai ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
                    {currentUser.is_ai ? (
                      <Bot size={14} className="text-purple-400" />
                    ) : (
                      <UserIcon size={14} className="text-blue-400" />
                    )}
                  </div>
                  <span className="text-sm">{currentUser.name}</span>
                  <button onClick={handleLogout} className="ml-2 text-gray-400 hover:text-white">
                    <LogOut size={14} />
                  </button>
                </div>
              )}

              <button
                onClick={() => setModalTask('new')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
              >
                <Plus size={20} />
                New Task
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="glass p-4 flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Status</option>
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>

          {/* Assignee filter */}
          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Assignees</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.is_ai ? '🤖' : '👤'} {user.name}
              </option>
            ))}
          </select>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-2 rounded ${viewMode === 'board' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="glass p-8 text-center text-gray-400 max-w-7xl mx-auto">
            Loading tasks...
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="space-y-2 max-w-7xl mx-auto">
            {filteredTasks.length === 0 ? (
              <div className="glass p-8 text-center text-gray-400">
                No tasks found. Create one to get started!
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  users={users}
                  onUpdate={handleUpdateTask}
                  onSelect={(t) => setModalTask(t)}
                />
              ))
            )}
          </div>
        ) : (
          /* Board View */
          <div className="flex justify-center overflow-x-auto">
            <div className="flex gap-4 min-h-[calc(100vh-220px)] pb-4">
            {(Object.keys(statusGroups) as Task['status'][]).map((status) => (
              <div key={status} className="glass p-4 w-[280px] flex-shrink-0 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      status === 'backlog' ? 'bg-gray-400' :
                      status === 'todo' ? 'bg-blue-400' :
                      status === 'in_progress' ? 'bg-purple-400' :
                      status === 'review' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`} />
                    <h3 className="font-medium text-gray-300">{statusLabels[status]}</h3>
                  </div>
                  <span className="text-sm text-gray-500 bg-white/5 px-2 py-0.5 rounded">{statusGroups[status].length}</span>
                </div>
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {statusGroups[status].map((task) => (
                    <BoardCard
                      key={task.id}
                      task={task}
                      users={users}
                      onUpdate={handleUpdateTask}
                      onSelect={(t) => setModalTask(t)}
                    />
                  ))}
                  {statusGroups[status].length === 0 && (
                    <div className="text-center py-8 text-gray-600 text-sm border border-dashed border-white/10 rounded-lg">
                      No tasks
                    </div>
                  )}
                </div>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>

      {/* Task Modal */}
      {modalTask && (
        <TaskModal
          task={modalTask === 'new' ? null : modalTask}
          users={users}
          onClose={() => setModalTask(null)}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </main>
  )
}
