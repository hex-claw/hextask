'use client'

import { Task, User } from '@/lib/supabase'
import { format } from 'date-fns'
import { 
  Calendar, 
  ChevronDown, 
  ChevronRight,
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  User as UserIcon,
  Bot,
  MoreVertical,
  Edit,
  Eye,
  Copy,
  Trash2
} from 'lucide-react'
import { useState } from 'react'

const priorityConfig = {
  urgent: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/20' },
  high: { icon: ArrowUp, color: 'text-orange-500', bg: 'bg-orange-500/20' },
  medium: { icon: Minus, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
  low: { icon: ArrowDown, color: 'text-green-500', bg: 'bg-green-500/20' },
}

const statusConfig = {
  backlog: { label: 'Backlog', color: 'bg-gray-500/30' },
  todo: { label: 'To Do', color: 'bg-blue-500/30' },
  in_progress: { label: 'In Progress', color: 'bg-purple-500/30' },
  review: { label: 'Review', color: 'bg-yellow-500/30' },
  done: { label: 'Done', color: 'bg-green-500/30' },
}

interface TaskCardProps {
  task: Task
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
  depth?: number
}

export function TaskCard({ task, users, onUpdate, onSelect, onDelete, onDuplicate, depth = 0 }: TaskCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [showMenu, setShowMenu] = useState(false)
  const priority = priorityConfig[task.priority]
  const status = statusConfig[task.status]
  const PriorityIcon = priority.icon
  const hasSubtasks = task.subtasks && task.subtasks.length > 0
  const assignee = users.find(u => u.id === task.assignee_id)

  return (
    <div className={`${depth > 0 ? 'ml-6 border-l border-purple-500/30 pl-4' : ''}`}>
      <div 
        className="glass p-4 mb-2 hover:border-purple-500/50 transition-all cursor-pointer group relative"
        onClick={() => onSelect(task)}
      >
        {/* Quick Actions Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <MoreVertical size={16} className="text-gray-400" />
          </button>
          {showMenu && (
            <div className="absolute right-0 mt-1 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[140px] z-50">
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(task); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
              >
                <Eye size={12} />
                View
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onSelect(task); setShowMenu(false) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
              >
                <Edit size={12} />
                Edit
              </button>
              {onDuplicate && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDuplicate(task); setShowMenu(false) }}
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
                    onClick={(e) => { e.stopPropagation(); onDelete(task.id); setShowMenu(false) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/20 text-red-400"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex items-start gap-3">
          {/* Expand/Collapse for subtasks */}
          {hasSubtasks ? (
            <button 
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
              className="mt-1 text-gray-400 hover:text-white"
            >
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <div className="w-4" />
          )}

          {/* Priority indicator */}
          <div className={`p-1.5 rounded ${priority.bg}`}>
            <PriorityIcon size={14} className={priority.color} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>
                {status.label}
              </span>
              {task.due_date && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar size={12} />
                  {format(new Date(task.due_date), 'MMM d')}
                </span>
              )}
            </div>
            
            <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
              {task.title}
            </h3>
            
            {task.description && (
              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Assignee */}
          {assignee && (
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-full ${assignee.is_ai ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
                {assignee.is_ai ? (
                  <Bot size={14} className="text-purple-400" />
                ) : (
                  <UserIcon size={14} className="text-blue-400" />
                )}
              </div>
              <span className="text-sm text-gray-400">{assignee.name}</span>
            </div>
          )}
        </div>

        {/* Subtask count */}
        {hasSubtasks && (
          <div className="mt-2 ml-7 text-xs text-gray-500">
            {task.subtasks!.filter(s => s.status === 'done').length}/{task.subtasks!.length} subtasks done
          </div>
        )}
      </div>

      {/* Subtasks */}
      {expanded && hasSubtasks && (
        <div className="mt-1">
          {task.subtasks!.map(subtask => (
            <TaskCard
              key={subtask.id}
              task={subtask}
              users={users}
              onUpdate={onUpdate}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
