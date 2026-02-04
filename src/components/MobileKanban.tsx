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
}

export function MobileKanban({
  statusGroups,
  statusLabels,
  users,
  onUpdate,
  onSelect
}: MobileKanbanProps) {
  const [collapsed, setCollapsed] = useState<{ [K in Task['status']]?: boolean }>({
    done: true // Collapse done by default
  })

  const toggleCollapse = (status: Task['status']) => {
    setCollapsed(prev => ({ ...prev, [status]: !prev[status] }))
  }

  return (
    <div className="space-y-3">
      {(Object.keys(statusGroups) as Task['status'][]).map((status) => {
        const isCollapsed = collapsed[status]
        const taskCount = statusGroups[status].length

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
                  statusGroups[status].map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      users={users}
                      onUpdate={onUpdate}
                      onSelect={onSelect}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
