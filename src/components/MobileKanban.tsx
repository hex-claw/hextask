'use client'

import { Task, User } from '@/lib/supabase'
import { TaskCard } from './TaskCard'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

type StatusGroups = {
  [K in Task['status']]: Task[]
}

interface MobileKanbanProps {
  statusGroups: StatusGroups
  statusLabels: { [K in Task['status']]: string }
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
}

export function MobileKanban({
  statusGroups,
  statusLabels,
  users,
  onUpdate,
  onSelect,
  onDelete,
  onDuplicate
}: MobileKanbanProps) {
  const [collapsed, setCollapsed] = useState<{ [K in Task['status']]?: boolean }>({
    done: true // Collapse done by default
  })
  const [expanded, setExpanded] = useState<{ [K in Task['status']]?: boolean }>({})

  const toggleCollapse = (status: Task['status']) => {
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }))
  }

  const INITIAL_LOAD = 10

  return (
    <div className="space-y-3">
      {(Object.keys(statusGroups) as Task['status'][]).map((status) => {
        const isCollapsed = collapsed[status]
        const isExpanded = expanded[status]
        const allTasks = statusGroups[status]
        const taskCount = allTasks.length
        const visibleTasks = isExpanded || taskCount <= INITIAL_LOAD ? allTasks : allTasks.slice(0, INITIAL_LOAD)
        const hasMore = taskCount > INITIAL_LOAD

        return (
          <div key={status} className="glass overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggleCollapse(status)}
              className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  status === 'backlog' ? 'bg-gray-400' :
                  status === 'todo' ? 'bg-blue-400' :
                  status === 'in_progress' ? 'bg-purple-400' :
                  status === 'review' ? 'bg-yellow-400' :
                  'bg-green-400'
                }`} />
                <h3 className="font-medium text-gray-300">{statusLabels[status]}</h3>
                <span className="text-sm text-gray-500 bg-white/5 px-2 py-0.5 rounded">
                  {taskCount}
                </span>
              </div>
              
              {isCollapsed ? (
                <ChevronRight size={20} className="text-gray-400" />
              ) : (
                <ChevronDown size={20} className="text-gray-400" />
              )}
            </button>

            {/* Tasks */}
            {!isCollapsed && (
              <div className="p-4 pt-0 space-y-3 border-t border-white/10">
                {taskCount === 0 ? (
                  <div className="text-center py-8 text-gray-600 text-sm">
                    No tasks
                  </div>
                ) : (
                  <>
                    {visibleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        users={users}
                        onUpdate={onUpdate}
                        onSelect={onSelect}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                      />
                    ))}
                    
                    {/* Load more button */}
                    {hasMore && !isExpanded && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpanded(prev => ({ ...prev, [status]: true }))
                        }}
                        className="w-full p-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-white/10"
                      >
                        Load more ({taskCount - INITIAL_LOAD} hidden)
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
