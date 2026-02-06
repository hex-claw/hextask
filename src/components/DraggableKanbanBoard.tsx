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
  rectIntersection,
  DragOverEvent,
  UniqueIdentifier,
  useDroppable,
  useDraggable
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
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
}

export function DraggableKanbanBoard({
  statusGroups,
  statusLabels,
  users,
  onUpdate,
  onSelect,
  onQuickCreate,
  onDelete,
  onDuplicate
}: DraggableKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [overId, setOverId] = useState<UniqueIdentifier | null>(null)
  const [expandedColumns, setExpandedColumns] = useState<Set<Task['status']>>(new Set())
  
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
    if (!over) {
      setOverId(null)
      return
    }
    
    // If over a column directly, use that
    const statusValues = Object.keys(statusGroups) as Task['status'][]
    if (statusValues.includes(over.id as Task['status'])) {
      setOverId(over.id)
      return
    }
    
    // If over a task, find which column it belongs to and highlight that column
    for (const status of statusValues) {
      if (statusGroups[status].find(t => t.id === over.id)) {
        setOverId(status)
        return
      }
    }
    
    setOverId(null)
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
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex justify-start overflow-x-auto px-2 sm:px-4 pb-4">
        <div className="flex gap-3 lg:gap-4 min-h-[calc(100vh-220px)] w-full">
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
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              isExpanded={expandedColumns.has(status)}
              onToggleExpand={() => {
                const newSet = new Set(expandedColumns)
                if (newSet.has(status)) {
                  newSet.delete(status)
                } else {
                  newSet.add(status)
                }
                setExpandedColumns(newSet)
              }}
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
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
  isExpanded: boolean
  onToggleExpand: () => void
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
  onDelete,
  onDuplicate,
  isExpanded,
  onToggleExpand,
}: DroppableColumnProps) {
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({ 
    id: status,
    data: {
      status: status
    }
  })
  const INITIAL_LOAD = 10
  const visibleTasks = isExpanded || tasks.length <= INITIAL_LOAD ? tasks : tasks.slice(0, INITIAL_LOAD)
  const hasMore = tasks.length > INITIAL_LOAD

  return (
    <div
      ref={setNodeRef}
      className={`glass p-2 sm:p-3 lg:p-4 flex-1 min-w-[200px] max-w-[320px] flex flex-col transition-all duration-200 ${
        isOverDroppable ? 'scale-[1.02] ring-2 ring-purple-400 bg-purple-500/10 shadow-lg shadow-purple-500/30' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
            status === 'backlog' ? 'bg-gray-400' :
            status === 'todo' ? 'bg-blue-400' :
            status === 'in_progress' ? 'bg-purple-400' :
            status === 'review' ? 'bg-yellow-400' :
            'bg-green-400'
          }`} />
          <h3 className="font-medium text-gray-300 text-sm sm:text-base truncate">{label}</h3>
        </div>
        <span className="text-xs sm:text-sm text-gray-500 bg-white/5 px-1.5 sm:px-2 py-0.5 rounded flex-shrink-0">{tasks.length}</span>
      </div>
      
      <div className="space-y-2 sm:space-y-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)] sm:max-h-[calc(100vh-320px)] lg:max-h-[calc(100vh-340px)] scrollbar-thin scrollbar-glass pr-1">
        {visibleTasks.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-600 text-sm border-2 border-dashed border-white/10 rounded-lg">
            No tasks
          </div>
        ) : (
          <>
            {visibleTasks.map((task) => (
              <DraggableTask
                key={task.id}
                task={task}
                users={users}
                onUpdate={onUpdate}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
              />
            ))}
            
            {hasMore && !isExpanded && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleExpand() }}
                className="w-full p-2 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all border border-white/10"
              >
                Load more ({tasks.length - INITIAL_LOAD} hidden)
              </button>
            )}
          </>
        )}
      </div>
      
      {/* Quick create button - outside scrollable area */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onQuickCreate(status)
        }}
        className="mt-3 w-full p-3 text-sm text-gray-400 hover:text-white border border-dashed border-white/10 hover:border-purple-500/50 rounded-lg transition-all flex items-center justify-center gap-2 flex-shrink-0"
      >
        <Plus size={16} />
        Add task
      </button>
    </div>
  )
}

interface DraggableTaskProps {
  task: Task
  users: User[]
  onUpdate: (task: Partial<Task> & { id: string }) => void
  onSelect: (task: Task) => void
  onDelete?: (id: string) => void
  onDuplicate?: (task: Task) => void
}

function DraggableTask({ task, users, onUpdate, onSelect, onDelete, onDuplicate }: DraggableTaskProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging
  } = useDraggable({ id: task.id })

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
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    </div>
  )
}
