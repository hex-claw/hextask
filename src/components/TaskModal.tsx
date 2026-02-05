'use client'

import { Task, User, supabase } from '@/lib/supabase'
import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Bot, User as UserIcon } from 'lucide-react'
import { format } from 'date-fns'

interface TaskModalProps {
  task: Task | null
  users: User[]
  onClose: () => void
  onSave: (task: Partial<Task>) => void
  onDelete: (id: string) => void
  parentId?: string | null
  initialStatus?: Task['status'] | null
}

export function TaskModal({ task, users, onClose, onSave, onDelete, parentId, initialStatus }: TaskModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: (initialStatus || 'backlog') as Task['status'],
    priority: 'medium' as Task['priority'],
    assignee_id: null as string | null,
    due_date: null as string | null,
    parent_id: parentId || null,
  })

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        assignee_id: task.assignee_id,
        due_date: task.due_date ? format(new Date(task.due_date), 'yyyy-MM-dd') : null,
        parent_id: task.parent_id,
      })
    }
  }, [task])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ...form,
      id: task?.id,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="glass max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-xl font-semibold">
            {task ? 'Edit Task' : 'New Task'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              placeholder="What needs to be done?"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500 min-h-[120px]"
              placeholder="Add details, context, acceptance criteria..."
            />
          </div>

          {/* Subtasks (if any) */}
          {task?.subtasks && task.subtasks.length > 0 && (
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Subtasks ({task.subtasks.filter(s => s.status === 'done').length}/{task.subtasks.length} completed)
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                    onClick={() => {
                      // Could open the subtask in a new modal, but for now just show info
                    }}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                      subtask.status === 'done' 
                        ? 'bg-green-500/30 border-green-500' 
                        : 'border-white/30'
                    }`}>
                      {subtask.status === 'done' && (
                        <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium ${subtask.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                        {subtask.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          subtask.status === 'done' ? 'bg-green-500/20 text-green-400' :
                          subtask.status === 'in_progress' ? 'bg-purple-500/20 text-purple-400' :
                          subtask.status === 'review' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {subtask.status.replace('_', ' ')}
                        </span>
                        {subtask.assignee_id && (
                          <span className="text-xs text-gray-500">
                            {users.find(u => u.id === subtask.assignee_id)?.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Task['status'] })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Assignee</label>
              <select
                value={form.assignee_id || ''}
                onChange={(e) => setForm({ ...form, assignee_id: e.target.value || null })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              >
                <option value="">Unassigned</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.is_ai ? '🤖' : '👤'} {user.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date || ''}
                onChange={(e) => setForm({ ...form, due_date: e.target.value || null })}
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            {task && (
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                className="px-4 py-2 text-red-400 hover:bg-red-500/20 rounded-lg flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium"
              >
                {task ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
