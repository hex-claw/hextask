'use client'

import { useState, useEffect } from 'react'
import { Task, User, supabase } from '@/lib/supabase'
import { TaskCard } from '@/components/TaskCard'
import { TaskModal } from '@/components/TaskModal'
import { 
  Plus, 
  Filter, 
  Search,
  LayoutGrid,
  List,
  Bot,
  User as UserIcon,
  Hexagon
} from 'lucide-react'

type ViewMode = 'list' | 'board'
type FilterStatus = Task['status'] | 'all'

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTask, setModalTask] = useState<Task | null | 'new'>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [filterAssignee, setFilterAssignee] = useState<string | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null)

  // Fetch data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // Fetch users
    const { data: usersData } = await supabase
      .from('users')
      .select('*')
    
    // Fetch tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })
    
    if (usersData) setUsers(usersData)
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
    if (taskData.id) {
      // Update
      const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskData.id)
      
      if (!error) fetchData()
    } else {
      // Create
      const { error } = await supabase
        .from('tasks')
        .insert([taskData])
      
      if (!error) fetchData()
    }
    setModalTask(null)
    setParentIdForNew(null)
  }

  // Delete task
  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    
    if (!error) fetchData()
    setModalTask(null)
  }

  // Update task (quick update from card)
  const handleUpdateTask = async (taskData: Partial<Task> & { id: string }) => {
    const { error } = await supabase
      .from('tasks')
      .update(taskData)
      .eq('id', taskData.id)
    
    if (!error) fetchData()
  }

  const statusLabels = {
    backlog: 'Backlog',
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  }

  return (
    <main className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600/30 rounded-lg">
                <Hexagon size={24} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">HexTask</h1>
                <p className="text-sm text-gray-400">J + Hex Co-working</p>
              </div>
            </div>

            <button
              onClick={() => setModalTask('new')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              New Task
            </button>
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
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="glass p-8 text-center text-gray-400">
            Loading tasks...
          </div>
        ) : viewMode === 'list' ? (
          /* List View */
          <div className="space-y-2">
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
          <div className="grid grid-cols-5 gap-4">
            {(Object.keys(statusGroups) as Task['status'][]).map((status) => (
              <div key={status} className="glass p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-300">{statusLabels[status]}</h3>
                  <span className="text-sm text-gray-500">{statusGroups[status].length}</span>
                </div>
                <div className="space-y-2">
                  {statusGroups[status].map((task) => (
                    <div
                      key={task.id}
                      onClick={() => setModalTask(task)}
                      className="p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer border border-white/5"
                    >
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      {task.assignee_id && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                          {users.find(u => u.id === task.assignee_id)?.is_ai ? (
                            <Bot size={12} />
                          ) : (
                            <UserIcon size={12} />
                          )}
                          {users.find(u => u.id === task.assignee_id)?.name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Modal */}
      {modalTask && (
        <TaskModal
          task={modalTask === 'new' ? null : modalTask}
          users={users}
          onClose={() => { setModalTask(null); setParentIdForNew(null) }}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          parentId={parentIdForNew}
        />
      )}
    </main>
  )
}
