'use client'

import { Task, User } from '@/lib/supabase'
import { BoardCard } from './BoardCard'
import { Plus } from 'lucide-react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners
} from '@dnd-kit/core'
import { useState } from 'react'

type StatusGroups = {
  [K in Task['status']]: Task[]
}

interface DraggableKanbanBoardProps {
  statusGroups: StatusGroups
  statusLabels: { [K in Task['status']]: string }
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onQuickCreate: (status: Task['status']) => void
}

export function DraggableKanbanBoard({
  statusGroups,
  statusLabels,
  users,
  onUpdate,
  onSelect,
  onQuickCreate
}: DraggableKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.id as string
    // Find the task in all status groups
    for (const status of Object.keys(statusGroups) as Task['status'][]) {
      const task = statusGroups[status].find(t => t.id === taskId)
      if (task) {
        setActiveTask(task)
        break
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    if (!over || !activeTask) {
      setActiveTask(null)
      return
    }

    const newStatus = over.id as Task['status']
    
    // If the status changed, update the task
    if (activeTask.status !== newStatus) {
      onUpdate({
        id: activeTask.id,
        status: newStatus
      })
    }
    
    setActiveTask(null)
  }

  const handleDragCancel = () => {
    setActiveTask(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex justify-center overflow-x-auto">
        <div className="flex gap-4 min-h-[calc(100vh-220px)] pb-4">
          {(Object.keys(statusGroups) as Task['status'][]).map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              label={statusLabels[status]}
              tasks={statusGroups[status]}
              users={users}
              onUpdate={onUpdate}
              onSelect={onSelect}
              onQuickCreate={onQuickCreate}
              isOver={false}
            />
          ))}
        </div>
      </div>
      
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-50">
            <BoardCard
              task={activeTask}
              users={users}
              onUpdate={() => {}}
              onSelect={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

interface DroppableColumnProps {
  status: Task['status']
  label: string
  tasks: Task[]
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onQuickCreate: (status: Task['status']) => void
  isOver: boolean
}

function DroppableColumn({
  status,
  label,
  tasks,
  users,
  onUpdate,
  onSelect,
  onQuickCreate,
}: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className="glass p-4 w-[280px] flex-shrink-0 flex flex-col"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'backlog' ? 'bg-gray-400' :
            status === 'todo' ? 'bg-blue-400' :
            status === 'in_progress' ? 'bg-purple-400' :
            status === 'review' ? 'bg-yellow-400' :
            'bg-green-400'
          }`} />
          <h3 className="font-medium text-gray-300">{label}</h3>
        </div>
        <span className="text-sm text-gray-500 bg-white/5 px-2 py-0.5 rounded">{tasks.length}</span>
      </div>
      
      <div className="space-y-3 flex-1 overflow-y-auto">
        {tasks.map((task) => (
          <DraggableTask
            key={task.id}
            task={task}
            users={users}
            onUpdate={onUpdate}
            onSelect={onSelect}
          />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center py-8 text-gray-600 text-sm border border-dashed border-white/10 rounded-lg">
            No tasks
          </div>
        )}
        
        {/* Quick create button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onQuickCreate(status)
          }}
          className="mt-2 w-full p-3 text-sm text-gray-400 hover:text-white border border-dashed border-white/10 hover:border-purple-500/50 rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Add task
        </button>
      </div>
    </div>
  )
}

import { useDraggable, useDroppable } from '@dnd-kit/core'

interface DraggableTaskProps {
  task: Task
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
}

function DraggableTask({ task, users, onUpdate, onSelect }: DraggableTaskProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <BoardCard
        task={task}
        users={users}
        onUpdate={onUpdate}
        onSelect={onSelect}
      />
    </div>
  )
}
