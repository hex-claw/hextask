'use client'

import { Task, User, supabase } from '@/lib/supabase'
import { useState, useRef, useEffect } from 'react'
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { 
  Calendar, 
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  Bot,
  User as UserIcon,
  ChevronDown,
  Clock,
  MoreVertical,
  Edit,
  Eye,
  Copy,
  Trash2
} from 'lucide-react'

const priorityConfig = {
  urgent: { icon: AlertCircle, label: 'Urgent', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  high: { icon: ArrowUp, label: 'High', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { icon: Minus, label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  low: { icon: ArrowDown, label: 'Low', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

interface BoardCardProps {
  task: Task
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
}

function DropdownBadge({ 
  children, 
  isOpen, 
  onToggle, 
  className = '' 
}: { 
  children: React.ReactNode
  isOpen: boolean
  onToggle: () => void
  className?: string 
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle() }}
      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-all hover:scale-105 ${className}`}
    >
      {children}
      <ChevronDown size={10} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

function Dropdown({ 
  children, 
  isOpen, 
  onClose 
}: { 
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void 
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div 
      ref={ref}
      className="absolute z-50 mt-1 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[140px]"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

export function BoardCard({ task, users, onUpdate, onSelect, onDelete, onDuplicate }: BoardCardProps) {
  const [openDropdown, setOpenDropdown] = useState<'priority' | 'assignee' | 'due' | 'menu' | null>(null)
  const priority = priorityConfig[task.priority]
  const PriorityIcon = priority.icon
  const assignee = users.find(u => u.id === task.assignee_id)

  const handlePriorityChange = async (newPriority: Task['priority']) => {
    onUpdate({ id: task.id, priority: newPriority })
    setOpenDropdown(null)
  }

  const handleAssigneeChange = async (assigneeId: string | null) => {
    onUpdate({ id: task.id, assignee_id: assigneeId })
    setOpenDropdown(null)
  }

  const handleDueDateChange = async (dueDate: string | null) => {
    onUpdate({ id: task.id, due_date: dueDate })
    setOpenDropdown(null)
  }

  const getDueDateDisplay = () => {
    if (!task.due_date) return null
    const date = new Date(task.due_date)
    if (isToday(date)) return { text: 'Today', urgent: true }
    if (isTomorrow(date)) return { text: 'Tomorrow', urgent: false }
    if (isPast(date)) return { text: format(date, 'MMM d'), urgent: true }
    return { text: format(date, 'MMM d'), urgent: false }
  }

  const dueDateDisplay = getDueDateDisplay()

  return (
    <div
      onClick={() => onSelect(task)}
      className="p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all group relative"
    >
      {/* Quick Actions Menu */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === 'menu' ? null : 'menu') }}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <MoreVertical size={16} className="text-gray-400" />
        </button>
        <Dropdown isOpen={openDropdown === 'menu'} onClose={() => setOpenDropdown(null)}>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(task); setOpenDropdown(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
          >
            <Eye size={12} />
            View
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(task); setOpenDropdown(null) }}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
          >
            <Edit size={12} />
            Edit
          </button>
          {onDuplicate && (
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(task); setOpenDropdown(null) }}
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
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); setOpenDropdown(null) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/20 text-red-400"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </>
          )}
        </Dropdown>
      </div>

      {/* Title */}
      <h4 className="font-medium text-sm mb-3 group-hover:text-purple-300 transition-colors pr-6">
        {task.title}
      </h4>

      {/* Subtask indicator */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="flex items-center gap-1 mb-2 text-xs text-gray-400">
          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
            {task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length} subtasks
          </span>
        </div>
      )}

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Priority Badge */}
        <div className="relative">
          <DropdownBadge
            isOpen={openDropdown === 'priority'}
            onToggle={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
            className={priority.color}
          >
            <PriorityIcon size={12} />
            <span>{priority.label}</span>
          </DropdownBadge>
          <Dropdown isOpen={openDropdown === 'priority'} onClose={() => setOpenDropdown(null)}>
            {(Object.keys(priorityConfig) as Task['priority'][]).map((p) => {
              const config = priorityConfig[p]
              const Icon = config.icon
              return (
                <button
                  key={p}
                  onClick={() => handlePriorityChange(p)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 ${task.priority === p ? 'bg-white/5' : ''}`}
                >
                  <Icon size={12} className={config.color.split(' ')[1]} />
                  {config.label}
                </button>
              )
            })}
          </Dropdown>
        </div>

        {/* Due Date Badge */}
        <div className="relative">
          <DropdownBadge
            isOpen={openDropdown === 'due'}
            onToggle={() => setOpenDropdown(openDropdown === 'due' ? null : 'due')}
            className={dueDateDisplay?.urgent 
              ? 'bg-red-500/20 text-red-400 border-red-500/30' 
              : task.due_date 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-white/5 text-gray-400 border-white/10'
            }
          >
            <Calendar size={12} />
            <span>{dueDateDisplay?.text || 'No date'}</span>
          </DropdownBadge>
          <Dropdown isOpen={openDropdown === 'due'} onClose={() => setOpenDropdown(null)}>
            <button
              onClick={() => handleDueDateChange(new Date().toISOString())}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
            >
              <Clock size={12} /> Today
            </button>
            <button
              onClick={() => handleDueDateChange(addDays(new Date(), 1).toISOString())}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
            >
              <Clock size={12} /> Tomorrow
            </button>
            <button
              onClick={() => handleDueDateChange(addDays(new Date(), 7).toISOString())}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
            >
              <Calendar size={12} /> Next week
            </button>
            <div className="border-t border-white/10 my-1" />
            <div className="px-3 py-2">
              <input
                type="date"
                onChange={(e) => handleDueDateChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs"
              />
            </div>
            {task.due_date && (
              <>
                <div className="border-t border-white/10 my-1" />
                <button
                  onClick={() => handleDueDateChange(null)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 text-red-400"
                >
                  Remove date
                </button>
              </>
            )}
          </Dropdown>
        </div>

        {/* Assignee Badge */}
        <div className="relative">
          <DropdownBadge
            isOpen={openDropdown === 'assignee'}
            onToggle={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
            className={assignee?.is_ai 
              ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' 
              : assignee 
                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                : 'bg-white/5 text-gray-400 border-white/10'
            }
          >
            {assignee?.is_ai ? <Bot size={12} /> : <UserIcon size={12} />}
            <span>{assignee?.name || 'Unassigned'}</span>
          </DropdownBadge>
          <Dropdown isOpen={openDropdown === 'assignee'} onClose={() => setOpenDropdown(null)}>
            <button
              onClick={() => handleAssigneeChange(null)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 ${!task.assignee_id ? 'bg-white/5' : ''}`}
            >
              <UserIcon size={12} className="text-gray-400" />
              Unassigned
            </button>
            <div className="border-t border-white/10 my-1" />
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleAssigneeChange(user.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 ${task.assignee_id === user.id ? 'bg-white/5' : ''}`}
              >
                {user.is_ai ? (
                  <Bot size={12} className="text-purple-400" />
                ) : (
                  <UserIcon size={12} className="text-blue-400" />
                )}
                {user.name}
              </button>
            ))}
          </Dropdown>
        </div>
      </div>
    </div>
  )
}
