'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Task, User, supabase } from '@/lib/supabase'
import { getCurrentUser, signOut, onAuthStateChange } from '@/lib/auth'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { DraggableKanbanBoard } from '@/components/DraggableKanbanBoard'
import { MobileKanban } from '@/components/MobileKanban'
import { ConfirmDialog } from '@/components/ConfirmDialog'
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
  const [newTaskStatus, setNewTaskStatus] = useState<Task['status'] | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [listViewLimit, setListViewLimit] = useState(20)
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete' | 'duplicate'
    task: Task | string
  } | null>(null)
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
          if (!parent.subtasks) parent.subtasks = []
          parent.subtasks.push(task)
        } else {
          rootTasks.push(task)
        }
      })
      
      // Debug: Log tasks with subtasks
      console.log('Root tasks:', rootTasks.length)
      const tasksWithSubtasks = rootTasks.filter(t => t.subtasks && t.subtasks.length > 0)
      console.log('Tasks with subtasks:', tasksWithSubtasks.map(t => ({
        title: t.title,
        subtaskCount: t.subtasks?.length
      })))
      
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

  // Request delete confirmation
  const requestDeleteTask = (id: string) => {
    setConfirmDialog({ type: 'delete', task: id })
  }

  // Request duplicate confirmation
  const requestDuplicateTask = (task: Task) => {
    setConfirmDialog({ type: 'duplicate', task })
  }

  // Actually delete task (after confirmation)
  const handleDeleteTask = async (id: string) => {
    setError(null)
    
    const { error} = await supabase
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
    setConfirmDialog(null)
  }

  // Actually duplicate task (after confirmation)
  const handleDuplicateTask = async (task: Task) => {
    setError(null)
    
    const { error } = await supabase
      .from('tasks')
      .insert({
        title: `${task.title} (copy)`,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignee_id: task.assignee_id,
        due_date: task.due_date,
        parent_id: task.parent_id
      })
    
    if (error) {
      console.error('Error duplicating task:', error)
      setError(`Failed to duplicate task: ${error.message}`)
      return
    }
    
    fetchData()
    setConfirmDialog(null)
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
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-600/30 rounded-lg">
                  <Hexagon size={20} className="text-purple-400 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold">HexTask</h1>
                  <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">J + Hex Co-working</p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <a
                  href="/"
                  className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-purple-600 text-white"
                >
                  Tasks
                </a>
                <a
                  href="/documents"
                  className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  Docs
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Current user indicator */}
              {currentUser && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
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
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-sm"
              >
                <Plus size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">New Task</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="glass p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[120px] sm:min-w-[200px]">
            <Search size={16} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-2 sm:pr-4 py-1.5 sm:py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
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
            className="px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
          >
            <option value="all">All</option>
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
              className={`p-1.5 sm:p-2 rounded ${viewMode === 'list' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
              title="List view"
            >
              <List size={16} className="sm:w-[18px] sm:h-[18px]" />
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 sm:p-2 rounded ${viewMode === 'board' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
              title="Board view"
            >
              <LayoutGrid size={16} className="sm:w-[18px] sm:h-[18px]" />
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
              <>
                {filteredTasks.slice(0, listViewLimit).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    users={users}
                    onUpdate={handleUpdateTask}
                    onSelect={(t) => setModalTask(t)}
                    onDelete={requestDeleteTask}
                    onDuplicate={requestDuplicateTask}
                  />
                ))}
                
                {/* Load more button for list view */}
                {filteredTasks.length > listViewLimit && (
                  <div className="py-4 text-center">
                    <button
                      onClick={() => setListViewLimit(limit => limit + 20)}
                      className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm transition-colors"
                    >
                      Load more ({filteredTasks.length - listViewLimit} hidden)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          /* Board View */
          <>
            {/* Mobile: Vertical Accordion */}
            <div className="md:hidden px-2 py-4">
              <MobileKanban
                statusGroups={statusGroups}
                statusLabels={statusLabels}
                users={users}
                onUpdate={handleUpdateTask}
                onSelect={(t) => setModalTask(t)}
                onDelete={requestDeleteTask}
                onDuplicate={requestDuplicateTask}
              />
            </div>

            {/* Desktop: Horizontal Draggable Board */}
            <div className="hidden md:block">
              <DraggableKanbanBoard
                statusGroups={statusGroups}
                statusLabels={statusLabels}
                users={users}
                onUpdate={handleUpdateTask}
                onSelect={(t) => setModalTask(t)}
                onQuickCreate={(status) => {
                  setNewTaskStatus(status)
                  setModalTask('new')
                }}
                onDelete={requestDeleteTask}
                onDuplicate={requestDuplicateTask}
              />
            </div>
          </>
        )}
      </div>

      {/* Task Modal */}
      {modalTask && (
        <TaskModal
          task={modalTask === 'new' ? null : modalTask}
          users={users}
          onClose={() => { setModalTask(null); setNewTaskStatus(null); }}
          onSave={handleSaveTask}
          onDelete={requestDeleteTask}
          initialStatus={newTaskStatus}
        />
      )}

      {/* Confirmation dialogs */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.type === 'delete' ? 'Delete Task?' : 'Duplicate Task?'}
          message={
            confirmDialog.type === 'delete'
              ? 'Are you sure you want to delete this task? This action cannot be undone.'
              : 'Create a copy of this task with the same properties?'
          }
          confirmText={confirmDialog.type === 'delete' ? 'Delete' : 'Duplicate'}
          variant={confirmDialog.type === 'delete' ? 'danger' : 'default'}
          onConfirm={() => {
            if (confirmDialog.type === 'delete') {
              handleDeleteTask(confirmDialog.task as string)
            } else {
              handleDuplicateTask(confirmDialog.task as Task)
            }
          }}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </main>
  )
}
