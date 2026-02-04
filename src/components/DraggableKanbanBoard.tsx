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
  closestCorners,
  DragOverEvent,
  UniqueIdentifier
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  
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

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    setOverId(over?.id || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    setOverId(null)
    
    if (!over || !activeTask) {
      setActiveTask(null)
      return
    }

    // Check if we're over a column (status)
    const statusValues = Object.keys(statusGroups) as Task['status'][]
    let newStatus: Task['status'] | null = null
    
    if (statusValues.includes(over.id as Task['status'])) {
      // Dropped directly on a column
      newStatus = over.id as Task['status']
    } else {
      // Dropped on a task, find which column that task is in
      for (const status of statusValues) {
        if (statusGroups[status].find(t => t.id === over.id)) {
          newStatus = status
          break
        }
      }
    }
    
    // If the status changed, update the task
    if (newStatus && activeTask.status !== newStatus) {
      onUpdate({
        id: activeTask.id,
        status: newStatus
      })
    }
    
    setActiveTask(null)
  }

  const handleDragCancel = () => {
    setActiveTask(null)
    setOverId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex justify-center overflow-x-auto px-2 sm:px-0">
        <div className="flex gap-3 sm:gap-4 min-h-[calc(100vh-220px)] pb-4">
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
              isOver={overId === status}
              overId={overId}
            />
          ))}
        </div>
      </div>
      
      <DragOverlay>
        {activeTask ? (
          <div className="opacity-80 rotate-3 scale-105">
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
  overId: UniqueIdentifier | null
}

function DroppableColumn({
  status,
  label,
  tasks,
  users,
  onUpdate,
  onSelect,
  onQuickCreate,
  isOver,
  overId,
}: DroppableColumnProps) {
  const { setNodeRef } = useSortable({ id: status })
  const taskIds = tasks.map(t => t.id)

  return (
    <div
      ref={setNodeRef}
      className={`glass p-3 sm:p-4 w-[240px] sm:w-[280px] flex-shrink-0 flex flex-col transition-all ${
        isOver ? 'ring-2 ring-purple-500 bg-purple-500/10' : ''
      }`}
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
      
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 flex-1 overflow-y-auto">
          {/* Drop indicator at top when hovering over column */}
          {isOver && tasks.length > 0 && (
            <div className="h-0.5 bg-purple-500 rounded-full -mb-1.5" />
          )}
          
          {tasks.map((task, index) => (
            <SortableTask
              key={task.id}
              task={task}
              users={users}
              onUpdate={onUpdate}
              onSelect={onSelect}
              isOverFromParent={overId === task.id}
            />
          ))}
          
          {tasks.length === 0 && (
            <div className={`text-center py-8 text-gray-600 text-sm border border-dashed rounded-lg transition-all ${
              isOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10'
            }`}>
              {isOver ? 'Drop here' : 'No tasks'}
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
      </SortableContext>
    </div>
  )
}

interface SortableTaskProps {
  task: Task
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  isOverFromParent: boolean
}

function SortableTask({ task, users, onUpdate, onSelect, isOverFromParent }: SortableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div className="relative">
      {/* Drop indicator line */}
      {isOverFromParent && (
        <div className="absolute -top-1.5 left-0 right-0 h-0.5 bg-purple-500 rounded-full z-10" />
      )}
      
      <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
        <BoardCard
          task={task}
          users={users}
          onUpdate={onUpdate}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}
