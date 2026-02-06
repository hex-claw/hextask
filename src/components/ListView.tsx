'use client'

import { Task, User } from '@/lib/supabase'
import { format } from 'date-fns'
import { useState, useMemo } from 'react'
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  Bot,
  User as UserIcon,
  MoreVertical,
  Edit,
  Copy,
  Trash2
} from 'lucide-react'

type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'due_date' | 'created_at'
type SortDirection = 'asc' | 'desc'

const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
const statusOrder = { backlog: 0, todo: 1, in_progress: 2, review: 3, done: 4 }

const priorityConfig = {
  urgent: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/20', label: 'Urgent' },
  high: { icon: ArrowUp, color: 'text-orange-500', bg: 'bg-orange-500/20', label: 'High' },
  medium: { icon: Minus, color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Medium' },
  low: { icon: ArrowDown, color: 'text-green-500', bg: 'bg-green-500/20', label: 'Low' },
}

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-gray-500/30 text-gray-300' },
  todo: { label: 'To Do', color: 'bg-blue-500/30 text-blue-300' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/30 text-purple-300' },
  review: { label: 'Review', color: 'bg-yellow-500/30 text-yellow-300' },
  done: { label: 'Done', color: 'bg-green-500/30 text-green-300' },
}

interface ListViewProps {
  tasks: Task[]
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
}

export function ListView({ tasks, users, onUpdate, onSelect, onDelete, onDuplicate }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  // Sort tasks
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0
      
      switch (sortField) {
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'status':
          comparison = statusOrder[a.status] - statusOrder[b.status]
          break
        case 'priority':
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority]
          break
        case 'assignee':
          const aName = users.find(u => u.id === a.assignee_id)?.name || 'zzz'
          const bName = users.find(u => u.id === b.assignee_id)?.name || 'zzz'
          comparison = aName.localeCompare(bName)
          break
        case 'due_date':
          const aDate = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const bDate = b.due_date ? new Date(b.due_date).getTime() : Infinity
          comparison = aDate - bDate
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [tasks, sortField, sortDirection, users])

  // Pagination
  const totalPages = Math.ceil(sortedTasks.length / pageSize)
  const paginatedTasks = sortedTasks.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <div className="w-4" />
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="text-purple-400" />
      : <ChevronDown size={14} className="text-purple-400" />
  }

  const getAssignee = (id: string | null) => users.find(u => u.id === id)

  return (
    <div className="glass overflow-hidden max-w-7xl mx-auto">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10 text-left text-sm text-gray-400">
              <th className="p-3 sm:p-4">
                <button 
                  onClick={() => handleSort('title')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Title <SortIcon field="title" />
                </button>
              </th>
              <th className="p-3 sm:p-4 hidden sm:table-cell">
                <button 
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Status <SortIcon field="status" />
                </button>
              </th>
              <th className="p-3 sm:p-4 hidden md:table-cell">
                <button 
                  onClick={() => handleSort('priority')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Priority <SortIcon field="priority" />
                </button>
              </th>
              <th className="p-3 sm:p-4 hidden lg:table-cell">
                <button 
                  onClick={() => handleSort('assignee')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Assignee <SortIcon field="assignee" />
                </button>
              </th>
              <th className="p-3 sm:p-4 hidden md:table-cell">
                <button 
                  onClick={() => handleSort('due_date')}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  Due <SortIcon field="due_date" />
                </button>
              </th>
              <th className="p-3 sm:p-4 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  No tasks found. Create one to get started!
                </td>
              </tr>
            ) : (
              paginatedTasks.map((task) => {
                const priority = priorityConfig[task.priority]
                const status = statusConfig[task.status]
                const PriorityIcon = priority.icon
                const assignee = getAssignee(task.assignee_id)
                
                return (
                  <tr 
                    key={task.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                    onClick={() => onSelect(task)}
                  >
                    <td className="p-3 sm:p-4">
                      {/* Mobile: Single line with all info */}
                      <div className="flex sm:hidden items-center gap-1.5">
                        {/* Priority icon */}
                        <div className={`p-1 rounded ${priority.bg} flex-shrink-0`}>
                          <PriorityIcon size={10} className={priority.color} />
                        </div>
                        
                        {/* Title - smaller and truncated */}
                        <div className={`text-xs font-medium truncate flex-1 min-w-0 ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                          {task.title}
                        </div>
                        
                        {/* Due date icon */}
                        {task.due_date && (
                          <Calendar size={10} className="text-gray-400 flex-shrink-0" />
                        )}
                        
                        {/* Assignee avatar */}
                        <div 
                          className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            assignee?.is_ai 
                              ? 'bg-purple-500/20 border border-purple-500/30' 
                              : assignee 
                                ? 'bg-blue-500/20 border border-blue-500/30'
                                : 'bg-white/5 border border-white/10'
                          }`}
                        >
                          {assignee?.is_ai ? (
                            <Bot size={10} className="text-purple-400" />
                          ) : assignee ? (
                            <span className="text-[8px] font-medium text-blue-400">
                              {assignee.name.charAt(0).toUpperCase()}
                            </span>
                          ) : (
                            <UserIcon size={10} className="text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Desktop: Original layout */}
                      <div className="hidden sm:block">
                        <div className={`font-medium truncate max-w-[300px] ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                          {task.title}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-3 sm:p-4 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${priority.bg}`}>
                          <PriorityIcon size={14} className={priority.color} />
                        </div>
                        <span className="text-sm text-gray-300">{priority.label}</span>
                      </div>
                    </td>
                    <td className="p-3 sm:p-4 hidden lg:table-cell">
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className={`p-1 rounded-full ${assignee.is_ai ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
                            {assignee.is_ai ? (
                              <Bot size={12} className="text-purple-400" />
                            ) : (
                              <UserIcon size={12} className="text-blue-400" />
                            )}
                          </div>
                          <span className="text-sm text-gray-300">{assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 hidden md:table-cell">
                      {task.due_date ? (
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <Calendar size={12} />
                          {format(new Date(task.due_date), 'MMM d')}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 relative">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation()
                          setActiveMenu(activeMenu === task.id ? null : task.id)
                        }}
                        className="p-1 hover:bg-white/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical size={16} className="text-gray-400" />
                      </button>
                      {activeMenu === task.id && (
                        <div className="absolute right-4 top-full mt-1 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[120px] z-50">
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelect(task); setActiveMenu(null) }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
                          >
                            <Edit size={12} />
                            Edit
                          </button>
                          {onDuplicate && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onDuplicate(task); setActiveMenu(null) }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
                            >
                              <Copy size={12} />
                              Duplicate
                            </button>
                          )}
                          {onDelete && (
                            <>
                              <div className="border-t border-white/10 my-1" />
                              <button
                                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setActiveMenu(null) }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/20 text-red-400"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 sm:p-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1) }}
              className="px-2 py-1 bg-white/5 border border-white/10 rounded text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>of {sortedTasks.length} tasks</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded text-sm ${
                      currentPage === pageNum 
                        ? 'bg-purple-600 text-white' 
                        : 'hover:bg-white/10 text-gray-400'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 hover:bg-white/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
