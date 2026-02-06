'use client'

import { Task, User, supabase } from '@/lib/supabase'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns'
import { 
  Calendar, 
  AlertCircle,
  ArrowUp,
  Minus,
  ArrowDown,
  Bot,
  User as UserIcon,
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
  onUpdate: (updates: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (taskId: string) => void
  onDuplicate?: (task: Task) => void
}

// Portal-based dropdown that renders at document.body level
function DropdownPortal({
  children,
  isOpen,
  onClose,
  anchorRef
}: {
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const updatePosition = () => {
        if (!anchorRef.current) return
        const rect = anchorRef.current.getBoundingClientRect()
        setPosition({
          top: rect.bottom + window.scrollY + 4,
          left: rect.left + window.scrollX
        })
      }
      
      updatePosition()
      
      // Update position on scroll
      window.addEventListener('scroll', updatePosition, true)
      return () => window.removeEventListener('scroll', updatePosition, true)
    }
  }, [isOpen, anchorRef])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen || typeof window === 'undefined') return null

  return createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-2xl min-w-[140px] max-h-[200px] overflow-y-auto"
      style={{ 
        top: `${position.top}px`, 
        left: `${position.left}px`
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}

// Tooltip component using portal
function TitleTooltip({
  text,
  anchorRef
}: {
  text: string
  anchorRef: React.RefObject<HTMLElement | null>
}) {
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({
        top: rect.top + window.scrollY - 50, // Above the element
        left: rect.left + window.scrollX
      })
    }
  }, [anchorRef])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      className="fixed z-[9999] pointer-events-none"
      style={{ top: `${position.top}px`, left: `${position.left}px` }}
    >
      <div className="bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl px-3 py-2 max-w-[200px] whitespace-normal">
        <p className="text-xs text-white">{text}</p>
        <div className="absolute top-full left-4 -mt-1 border-4 border-transparent border-t-[#1a1a2e]"></div>
      </div>
    </div>,
    document.body
  )
}

export function BoardCard({ task, users, onUpdate, onSelect, onDelete, onDuplicate }: BoardCardProps) {
  const [openDropdown, setOpenDropdown] = useState<'priority' | 'assignee' | 'due' | 'menu' | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showTitleTooltip, setShowTitleTooltip] = useState(false)
  
  const priority = priorityConfig[task.priority]
  const PriorityIcon = priority.icon
  const assignee = users.find(u => u.id === task.assignee_id)
  
  const priorityRef = useRef<HTMLDivElement>(null)
  const dueRef = useRef<HTMLDivElement>(null)
  const assigneeRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

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

  // Count subtasks
  const subtaskCount = task.subtasks?.length || 0
  const completedSubtasks = task.subtasks?.filter(st => st.completed_at).length || 0

  return (
    <div
      onClick={() => onSelect(task)}
      className="p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer border border-white/5 hover:border-purple-500/30 transition-all group relative aspect-[2/1] flex flex-col gap-1"
    >
      {/* Assignee avatar - top right, always visible */}
      <div className="absolute top-2 right-2">
        <div 
          ref={assigneeRef}
          onClick={(e) => { 
            e.stopPropagation()
            setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')
          }}
          className={`w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
            assignee?.is_ai 
              ? 'bg-purple-500/20 border border-purple-500/30' 
              : assignee 
                ? 'bg-blue-500/20 border border-blue-500/30'
                : 'bg-white/5 border border-white/10'
          }`}
          title={assignee?.name || 'Unassigned'}
        >
          {assignee?.is_ai ? (
            <Bot size={12} className="text-purple-400" />
          ) : assignee ? (
            <span className="text-[10px] font-medium text-blue-400">
              {assignee.name.charAt(0).toUpperCase()}
            </span>
          ) : (
            <UserIcon size={12} className="text-gray-400" />
          )}
        </div>
      </div>

      {mounted && (
        <DropdownPortal 
          isOpen={openDropdown === 'assignee'} 
          onClose={() => setOpenDropdown(null)}
          anchorRef={assigneeRef}
        >
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
        </DropdownPortal>
      )}

      {/* Three-dot menu */}
      <div className="absolute top-2 right-9 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          ref={menuRef}
          onClick={(e) => { 
            e.stopPropagation()
            setOpenDropdown(openDropdown === 'menu' ? null : 'menu')
          }}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <MoreVertical size={14} className="text-gray-400" />
        </button>
      </div>

      {mounted && (
        <DropdownPortal 
          isOpen={openDropdown === 'menu'} 
          onClose={() => setOpenDropdown(null)}
          anchorRef={menuRef}
        >
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
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10 text-red-400"
              >
                <Trash2 size={12} />
                Delete
              </button>
            </>
          )}
        </DropdownPortal>
      )}

      {/* Title with tooltip - extra padding for assignee avatar */}
      <div 
        className="relative pr-9"
        onMouseEnter={() => setShowTitleTooltip(true)}
        onMouseLeave={() => setShowTitleTooltip(false)}
      >
        <h4 
          ref={titleRef}
          className="font-medium text-xs group-hover:text-purple-300 transition-colors leading-tight truncate"
        >
          {task.title}
        </h4>
      </div>
      
      {/* Tooltip Portal */}
      {mounted && showTitleTooltip && (
        <TitleTooltip 
          text={task.title}
          anchorRef={titleRef}
        />
      )}

      {/* Subtask count (middle section) */}
      {subtaskCount > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <div className="w-3 h-3 rounded-sm border border-white/20 flex items-center justify-center">
            <div className={`w-1.5 h-1.5 rounded-sm ${completedSubtasks === subtaskCount ? 'bg-green-500' : 'bg-white/30'}`} />
          </div>
          <span>{completedSubtasks}/{subtaskCount}</span>
        </div>
      )}

      {/* Bottom row: Priority badge + Due date (fixed width to prevent layout shift) */}
      <div className="flex items-center gap-2 mt-auto justify-start">
        {/* Priority badge - fixed min-width */}
        <div 
          ref={priorityRef}
          onClick={(e) => { 
            e.stopPropagation()
            setOpenDropdown(openDropdown === 'priority' ? null : 'priority')
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-all hover:scale-105 cursor-pointer flex-shrink-0 ${priority.color}`}
        >
          <PriorityIcon size={10} />
          <span className="hidden lg:inline w-[24px] truncate">{priority.label}</span>
        </div>

        {mounted && (
          <DropdownPortal 
            isOpen={openDropdown === 'priority'} 
            onClose={() => setOpenDropdown(null)}
            anchorRef={priorityRef}
          >
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
          </DropdownPortal>
        )}

        {/* Due date - fixed minimum width to prevent layout shift */}
        <div 
          ref={dueRef}
          onClick={(e) => { 
            e.stopPropagation()
            setOpenDropdown(openDropdown === 'due' ? null : 'due')
          }}
          className={`flex items-center gap-1 text-[10px] cursor-pointer hover:bg-white/5 px-1.5 py-0.5 rounded transition-colors min-w-[48px] ${
            dueDateDisplay?.urgent ? 'text-red-400' : task.due_date ? 'text-blue-400' : 'text-gray-500'
          }`}
        >
          <Calendar size={10} className="flex-shrink-0" />
          {dueDateDisplay?.text && <span className="whitespace-nowrap">{dueDateDisplay.text}</span>}
        </div>

        {mounted && (
          <DropdownPortal 
            isOpen={openDropdown === 'due'} 
            onClose={() => setOpenDropdown(null)}
            anchorRef={dueRef}
          >
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
                onClick={(e) => e.stopPropagation()}
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
          </DropdownPortal>
        )}
      </div>
    </div>
  )
}
