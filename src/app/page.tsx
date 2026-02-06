'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Task, User, supabase } from '@/lib/supabase'
import { getCurrentUser, signOut, onAuthStateChange } from '@/lib/auth'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { DraggableKanbanBoard } from '@/components/DraggableKanbanBoard'
import { MobileKanban } from '@/components/MobileKanban'
import { ListView } from '@/components/ListView'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { 
  Plus, 
  Search,
  LayoutGrid,
  List,
  Bot,
  User as UserIcon,
  Hexagon,
  LogOut,
  Filter,
  X
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
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'delete' | 'duplicate'
    task: Task | string
  } | null>(null)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterAssignee, setFilterAssignee] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

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

  // Sync modalTask when tasks change (for subtask updates)
  useEffect(() => {
    if (modalTask && modalTask !== 'new') {
      // Find the updated task in tasks array
      const updatedTask = tasks.find(t => t.id === modalTask.id)
      if (updatedTask) {
        setModalTask(updatedTask)
      }
    }
  }, [tasks])

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

  // Save task - with optimistic updates for subtasks
  const handleSaveTask = async (taskData: Partial<Task>) => {
    setError(null)
    
    // Determine if this is a subtask operation BEFORE the try block
    const isSubtask = taskData.id 
      ? tasks.some(t => t.subtasks?.some(st => st.id === taskData.id))
      : !!taskData.parent_id
    
    try {
      if (taskData.id) {
        // Update existing task
        const { id, subtasks, assignee, ...updateData } = taskData as Task
        
        // Optimistic update for subtasks
        if (isSubtask) {
          setTasks(prevTasks => prevTasks.map(task => {
            if (task.subtasks?.some(st => st.id === id)) {
              return {
                ...task,
                subtasks: task.subtasks.map(st => 
                  st.id === id ? { ...st, ...updateData } : st
                )
              }
            }
            return task
          }))
        }
        
        const { error } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', id)
        
        if (error) {
          console.error('Error updating task:', error)
          setError(`Failed to update task: ${error.message}`)
          fetchData() // Revert on error
          return
        }
      } else {
        // Create new task
        const { id, subtasks, assignee, ...insertData } = taskData as Task
        
        // Optimistic update for subtask creation
        if (taskData.parent_id) {
          const tempId = `temp-${Date.now()}`
          const optimisticSubtask: Task = {
            id: tempId,
            title: insertData.title || '',
            description: insertData.description || '',
            status: (insertData.status || 'todo') as Task['status'],
            priority: (insertData.priority || 'medium') as Task['priority'],
            assignee_id: insertData.assignee_id || null,
            due_date: insertData.due_date || null,
            completed_at: null,
            parent_id: insertData.parent_id,
            position: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            subtasks: []
          }
          
          setTasks(prevTasks => prevTasks.map(task => {
            if (task.id === insertData.parent_id) {
              return {
                ...task,
                subtasks: [...(task.subtasks || []), optimisticSubtask]
              }
            }
            return task
          }))
          
          // API call
          const { data, error } = await supabase
            .from('tasks')
            .insert([insertData])
            .select()
            .single()
          
          if (error) {
            console.error('Error creating task:', error)
            setError(`Failed to create task: ${error.message}`)
            fetchData() // Revert on error
            return
          }
          
          // Replace temp id with real id
          if (data) {
            setTasks(prevTasks => prevTasks.map(task => {
              if (task.id === insertData.parent_id) {
                return {
                  ...task,
                  subtasks: task.subtasks?.map(st => 
                    st.id === tempId ? { ...st, id: data.id } : st
                  ) || []
                }
              }
              return task
            }))
          }
          return // Don't close modal for subtask creation
        }
        
        // Regular task creation (not subtask)
        const { error } = await supabase
          .from('tasks')
          .insert([insertData])
        
        if (error) {
          console.error('Error creating task:', error)
          setError(`Failed to create task: ${error.message}`)
          return
        }
      }
      
      // Only fetch and close for non-subtask operations
      if (!isSubtask) {
        fetchData()
        setModalTask(null)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      fetchData() // Revert on error
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

  // Actually delete task (after confirmation) - with optimistic updates
  const handleDeleteTask = async (id: string) => {
    setError(null)
    
    // Check if it's a subtask (has parent)
    const isSubtask = tasks.some(t => t.subtasks?.some(st => st.id === id))
    
    if (isSubtask) {
      // Optimistic delete for subtask
      setTasks(prevTasks => prevTasks.map(task => ({
        ...task,
        subtasks: task.subtasks?.filter(st => st.id !== id) || []
      })))
    }
    
    const { error} = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.error('Error deleting task:', error)
      setError(`Failed to delete task: ${error.message}`)
      fetchData() // Revert on error
      return
    }
    
    if (!isSubtask) {
      fetchData()
      setModalTask(null)
    }
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

  // Update task (quick update from card) - optimistic updates
  const handleUpdateTask = async (taskData: Partial<Task> & { id: string }) => {
    const { subtasks, assignee, ...updateData } = taskData as Task & { id: string }
    
    // Optimistic update: update local state immediately
    setTasks(prevTasks => {
      return prevTasks.map(task => {
        if (task.id === taskData.id) {
          return { ...task, ...updateData }
        }
        // Check in subtasks
        if (task.subtasks) {
          return {
            ...task,
            subtasks: task.subtasks.map(subtask => 
              subtask.id === taskData.id ? { ...subtask, ...updateData } : subtask
            )
          }
        }
        return task
      })
    })
    
    // API call in background
    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskData.id)
    
    if (error) {
      console.error('Error updating task:', error)
      setError(`Failed to update task: ${error.message}`)
      // Revert on error by refetching
      fetchData()
    }
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
    <main className="h-screen gradient-bg flex flex-col overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/50 text-red-300 px-4 py-2 text-center flex-shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Unified Header + Toolbar */}
      <header className="glass flex-shrink-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          {/* Top Row: Logo, Nav, Actions */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-600/30 rounded-lg">
                  <Hexagon size={18} className="text-purple-400" />
                </div>
                <span className="font-bold text-base sm:text-lg">HexTask</span>
              </div>

              {/* Desktop Nav */}
              <nav className="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-1 ml-2">
                <a href="/" className="px-3 py-1.5 rounded-md text-sm font-medium bg-purple-600 text-white">Tasks</a>
                <a href="/documents" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Docs</a>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile Nav */}
              <nav className="flex sm:hidden items-center gap-1 bg-white/5 rounded-lg p-1 mr-1">
                <a href="/" className="px-2 py-1.5 rounded text-xs font-medium bg-purple-600 text-white">Tasks</a>
                <a href="/documents" className="px-2 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Docs</a>
              </nav>

              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                {showFilters ? <X size={18} /> : <Filter size={18} />}
              </button>

              {/* View Toggle - Desktop */}
              <div className="hidden sm:flex items-center bg-white/5 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
                  title="List view"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`p-1.5 rounded ${viewMode === 'board' ? 'bg-purple-600' : 'hover:bg-white/10'}`}
                  title="Board view"
                >
                  <LayoutGrid size={16} />
                </button>
              </div>

              <button
                onClick={() => setModalTask('new')}
                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">New Task</span>
              </button>
            </div>
          </div>

          {/* Desktop Filters Row */}
          <div className="hidden sm:flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Status</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>

            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          </div>

          {/* Mobile Filters Panel */}
          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-white/10 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Status</option>
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
                <select
                  value={filterAssignee}
                  onChange={(e) => setFilterAssignee(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                >
                  <option value="all">All Users</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${viewMode === 'list' ? 'bg-purple-600' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <List size={16} /> List
                </button>
                <button
                  onClick={() => setViewMode('board')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm ${viewMode === 'board' ? 'bg-purple-600' : 'bg-white/5 hover:bg-white/10'}`}
                >
                  <LayoutGrid size={16} /> Board
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content - fills remaining height */}
      <div className="flex-1 overflow-auto px-2 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto h-full">
          {loading ? (
            <div className="glass p-8 text-center text-gray-400">
              Loading tasks...
            </div>
          ) : viewMode === 'list' ? (
            /* List View */
            <ListView
              tasks={filteredTasks}
              users={users}
              onUpdate={handleUpdateTask}
              onSelect={(t) => setModalTask(t)}
              onDelete={requestDeleteTask}
              onDuplicate={requestDuplicateTask}
            />
          ) : (
            /* Board View */
            <>
              {/* Mobile: Vertical Accordion */}
              <div className="lg:hidden h-full">
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
              <div className="hidden lg:block h-full">
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
