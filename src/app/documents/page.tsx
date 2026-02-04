'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, User } from '@/lib/supabase'
import { getCurrentUser, signOut } from '@/lib/auth'
import { 
  Hexagon,
  LogOut,
  Upload,
  Download,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Film,
  Bot,
  User as UserIcon,
  Calendar,
  Trash2
} from 'lucide-react'
import { format } from 'date-fns'

type Document = {
  id: string
  name: string
  description: string | null
  file_name: string
  file_path: string
  file_size: number | null
  mime_type: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  creator?: User
}

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const user = await getCurrentUser()
    if (!user) {
      router.push('/login')
      return
    }
    setCurrentUser(user)
    setAuthChecked(true)
    fetchData()
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    // Fetch users
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*')

    if (usersError) {
      console.error('Error fetching users:', usersError)
    }

    // Fetch documents
    const { data: docsData, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (docsError) {
      console.error('Error fetching documents:', docsError)
      setError('Failed to load documents')
    }

    if (usersData) setUsers(usersData)
    if (docsData) {
      const docsWithCreators = docsData.map(doc => ({
        ...doc,
        creator: usersData?.find(u => u.id === doc.created_by)
      }))
      setDocuments(docsWithCreators)
    }

    setLoading(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)

    try {
      // For now, show a message that this feature is coming soon
      // In production, this would upload to Supabase Storage
      setError('File upload is being set up. Please wait for the next deployment.')
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting document:', error)
      setError('Failed to delete document')
      return
    }

    fetchData()
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getFileIcon = (mimeType: string | null) => {
    if (!mimeType) return <FileIcon size={20} />
    if (mimeType.startsWith('image/')) return <ImageIcon size={20} />
    if (mimeType.startsWith('video/')) return <Film size={20} />
    return <FileText size={20} />
  }

  // Loading/auth check
  if (!authChecked || loading) {
    return (
      <main className="min-h-screen gradient-bg flex items-center justify-center">
        <div className="glass p-8 text-center">
          <div className="animate-pulse">Loading...</div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen gradient-bg">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-2 text-center">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <header className="glass border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-6 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-purple-600/30 rounded-lg">
                  <Hexagon size={20} className="text-purple-400 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold">HexTask</h1>
                  <p className="text-xs sm:text-sm text-gray-400 hidden sm:block">J + Hex Co-working</p>
                </div>
              </div>

              {/* Navigation */}
              <nav className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
                <a
                  href="/"
                  className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Tasks
                </a>
                <a
                  href="/documents"
                  className="px-2 sm:px-4 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium bg-purple-600 text-white whitespace-nowrap"
                >
                  Docs
                </a>
              </nav>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              {/* Current user indicator */}
              {currentUser && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                  <div className={`p-1 rounded-full ${currentUser.is_ai ? 'bg-purple-500/30' : 'bg-blue-500/30'}`}>
                    {currentUser.is_ai ? (
                      <Bot size={14} className="text-purple-400" />
                    ) : (
                      <UserIcon size={14} className="text-blue-400" />
                    )}
                  </div>
                  <span className="text-sm">{currentUser.name}</span>
                  <button onClick={handleLogout} className="ml-2 text-gray-400 hover:text-white">
                    <LogOut size={14} />
                  </button>
                </div>
              )}

              {/* Upload button */}
              <label className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors cursor-pointer text-sm">
                <Upload size={18} className="sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Upload Document</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">Document Center</h2>
          <p className="text-sm sm:text-base text-gray-400">
            Market research, presentations, data analysis, and other files generated during our work together.
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="glass p-8 sm:p-12 text-center">
            <Upload size={40} className="mx-auto mb-4 text-gray-600 sm:w-12 sm:h-12" />
            <h3 className="text-base sm:text-lg font-medium mb-2">No documents yet</h3>
            <p className="text-sm sm:text-base text-gray-400">
              Documents will appear here when Hex generates files for you.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4">
            {documents.map((doc) => (
              <div key={doc.id} className="glass p-3 sm:p-4 hover:border-purple-500/30 transition-all">
                <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  {/* Icon */}
                  <div className="p-2 sm:p-3 bg-white/5 rounded-lg text-purple-400">
                    {getFileIcon(doc.mime_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm sm:text-base font-medium mb-1">{doc.name}</h3>
                    {doc.description && (
                      <p className="text-xs sm:text-sm text-gray-400 mb-2">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500">
                      <span className="truncate max-w-[200px] sm:max-w-none">{doc.file_name}</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      {doc.creator && (
                        <span className="flex items-center gap-1">
                          {doc.creator.is_ai ? <Bot size={12} /> : <UserIcon size={12} />}
                          <span className="hidden sm:inline">{doc.creator.name}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <a
                      href={doc.file_path}
                      download={doc.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-initial"
                    >
                      <Download size={14} className="sm:w-4 sm:h-4" />
                      Download
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} className="sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
