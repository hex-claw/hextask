'use client'

import { useState, useEffect, useRef } from 'react'
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
  Trash2,
  Eye,
  ChevronDown,
  Search,
  Filter,
  X
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

type DocumentGroup = {
  baseName: string
  displayName: string
  description: string | null
  formats: Document[]
  creator?: User
  created_at: string
}

export default function DocumentsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [documentGroups, setDocumentGroups] = useState<DocumentGroup[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<{ id: string, type: 'download' | 'preview' | 'mobile' } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

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
      
      // Group documents by base name
      const groups = groupDocuments(docsWithCreators)
      setDocumentGroups(groups)
    }

    setLoading(false)
  }

  // Group documents by base name (ignore file extensions)
  const groupDocuments = (docs: Document[]): DocumentGroup[] => {
    const groupMap = new Map<string, DocumentGroup>()

    docs.forEach(doc => {
      // Extract base name (remove file extension)
      const baseName = doc.file_name.replace(/\.(md|html|pdf|docx|doc|txt)$/i, '')
      
      if (groupMap.has(baseName)) {
        const group = groupMap.get(baseName)!
        group.formats.push(doc)
      } else {
        groupMap.set(baseName, {
          baseName,
          displayName: doc.name,
          description: doc.description,
          formats: [doc],
          creator: doc.creator,
          created_at: doc.created_at
        })
      }
    })

    return Array.from(groupMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  }

  // Get file extension
  const getExtension = (filename: string): string => {
    const ext = filename.match(/\.([^.]+)$/)?.[1]?.toLowerCase()
    return ext || 'file'
  }

  // Format labels for display
  const formatLabel = (ext: string): string => {
    const labels: Record<string, string> = {
      pdf: 'PDF',
      html: 'HTML',
      md: 'Markdown',
      docx: 'Word',
      doc: 'Word',
      txt: 'Text'
    }
    return labels[ext] || ext.toUpperCase()
  }

  // Get priority for sorting formats (PDF first, HTML last)
  const getFormatPriority = (ext: string): number => {
    const priority: Record<string, number> = {
      pdf: 1,
      docx: 2,
      doc: 3,
      md: 4,
      html: 5,
      txt: 6
    }
    return priority[ext] || 999
  }

  // Sort formats by priority
  const sortFormats = (formats: Document[]): Document[] => {
    return [...formats].sort((a, b) => {
      const extA = getExtension(a.file_name)
      const extB = getExtension(b.file_name)
      return getFormatPriority(extA) - getFormatPriority(extB)
    })
  }

  // Get best format for preview (PDF > DOCX > Markdown > HTML)
  const getBestFormat = (formats: Document[]): Document => {
    return sortFormats(formats)[0]
  }

  // Filter groups based on search query
  const filteredGroups = documentGroups.filter(group =>
    group.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.creator?.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Pagination calculations
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedGroups = filteredGroups.slice(startIndex, endIndex)

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
      setError('File upload is being set up. Please wait for the next deployment.')
    } catch (err) {
      console.error('Upload error:', err)
      setError('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (groupId: string) => {
    setDeleteConfirm(groupId)
  }

  const confirmDelete = async (groupId: string) => {
    const group = documentGroups.find(g => g.baseName === groupId)
    if (!group) return

    // Delete all formats
    for (const doc of group.formats) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id)

      if (error) {
        console.error('Error deleting document:', error)
        setError('Failed to delete document')
        setDeleteConfirm(null)
        return
      }
    }

    setDeleteConfirm(null)
    fetchData()
  }

  const handlePreview = (doc: Document) => {
    const url = `https://ffsgkiozmvkyirrrzofx.supabase.co/storage/v1/object/public/documents/${doc.file_path}`
    window.open(url, '_blank')
  }

  const handleDownload = (doc: Document) => {
    const url = `https://ffsgkiozmvkyirrrzofx.supabase.co/storage/v1/object/public/documents/${doc.file_path}`
    const link = document.createElement('a')
    link.href = url
    link.download = doc.file_name
    link.click()
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

  // Mobile Actions - combines preview and download into single dropdown
  function MobileActions({ group }: { group: DocumentGroup }) {
    const dropdownRef = useRef<HTMLDivElement>(null)
    const sortedFormats = sortFormats(group.formats)
    const isOpen = openDropdown?.id === group.baseName && openDropdown?.type === 'mobile'

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setOpenDropdown(null)
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    return (
      <div className="relative sm:hidden" ref={dropdownRef}>
        <button
          onClick={() => setOpenDropdown(isOpen ? null : { id: group.baseName, type: 'mobile' })}
          className="flex items-center justify-center p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors min-h-[36px] min-w-[36px]"
        >
          <Eye size={16} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[140px] z-50">
            {sortedFormats.map((doc) => {
              const ext = getExtension(doc.file_name)
              return (
                <div key={doc.id} className="border-b border-white/5 last:border-0">
                  <button
                    onClick={() => { handlePreview(doc); setOpenDropdown(null) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
                  >
                    <Eye size={12} />
                    Preview {formatLabel(ext)}
                  </button>
                  <button
                    onClick={() => { handleDownload(doc); setOpenDropdown(null) }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/10"
                  >
                    <Download size={12} />
                    Download {formatLabel(ext)}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Dropdown component
  function FormatDropdown({ group, type }: { group: DocumentGroup, type: 'download' | 'preview' }) {
    const dropdownRef = useRef<HTMLDivElement>(null)
    const sortedFormats = sortFormats(group.formats)
    const isOpen = openDropdown?.id === group.baseName && openDropdown?.type === type

    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setOpenDropdown(null)
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    return (
      <div className="relative hidden sm:block" ref={dropdownRef}>
        <button
          onClick={() => setOpenDropdown(isOpen ? null : { id: group.baseName, type })}
          className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            type === 'preview'
              ? 'bg-purple-600 hover:bg-purple-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {type === 'preview' ? <Eye size={16} /> : <Download size={16} />}
          <span>{type === 'preview' ? 'Preview' : 'Download'}</span>
          <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 py-1 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl min-w-[160px] z-50">
            {sortedFormats.map((doc) => {
              const ext = getExtension(doc.file_name)
              return (
                <button
                  key={doc.id}
                  onClick={() => {
                    if (type === 'preview') {
                      handlePreview(doc)
                    } else {
                      handleDownload(doc)
                    }
                    setOpenDropdown(null)
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-white/10 transition-colors min-h-[44px]"
                >
                  <span>{formatLabel(ext)}</span>
                  <span className="text-gray-500 text-xs">{formatFileSize(doc.file_size)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
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
    <main className="h-screen gradient-bg flex flex-col overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/50 text-red-300 px-4 py-2 text-center flex-shrink-0">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Unified Header */}
      <header className="glass flex-shrink-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
          {/* Top Row: Logo, Actions, Nav */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-600/30 rounded-lg">
                  <Hexagon size={18} className="text-purple-400" />
                </div>
                <span className="font-bold text-base sm:text-lg">HexTask</span>
              </div>

              {/* Desktop Nav */}
              <nav className="hidden sm:flex items-center gap-1 bg-white/5 rounded-lg p-1 ml-2">
                <a href="/" className="px-3 py-1.5 rounded-md text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Tasks</a>
                <a href="/documents" className="px-3 py-1.5 rounded-md text-sm font-medium bg-purple-600 text-white">Docs</a>
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {/* Upload button */}
              <label className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors cursor-pointer text-sm">
                <Upload size={16} />
                <span className="hidden sm:inline">Upload</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              {/* Mobile Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="sm:hidden p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                {showFilters ? <X size={18} /> : <Filter size={18} />}
              </button>

              {/* Mobile Nav - Rightmost */}
              <nav className="flex sm:hidden items-center gap-1 bg-white/5 rounded-lg p-1">
                <a href="/" className="px-2 py-1.5 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Tasks</a>
                <a href="/documents" className="px-2 py-1.5 rounded text-xs font-medium bg-purple-600 text-white">Docs</a>
              </nav>
            </div>
          </div>

          {/* Desktop Filters Row */}
          <div className="hidden sm:flex items-center gap-3 mt-3 pt-3 border-t border-white/10">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Mobile Filters Panel */}
          {showFilters && (
            <div className="sm:hidden mt-3 pt-3 border-t border-white/10 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto px-2 sm:px-4 py-4">
        <div className="max-w-7xl mx-auto">
          {/* Page Title - Desktop only */}
          <div className="hidden sm:block mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Document Center</h2>
            <p className="text-sm sm:text-base text-gray-400">
              Market research, presentations, data analysis, and other files generated during our work together.
            </p>
          </div>

        {documentGroups.length === 0 ? (
          <div className="glass p-8 sm:p-12 text-center">
            <Upload size={40} className="mx-auto mb-4 text-gray-600 sm:w-12 sm:h-12" />
            <h3 className="text-base sm:text-lg font-medium mb-2">No documents yet</h3>
            <p className="text-sm sm:text-base text-gray-400">
              Documents will appear here when Hex generates files for you.
            </p>
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-400">Document</th>
                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-400 hidden md:table-cell">Formats</th>
                  <th className="text-left px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-400 hidden lg:table-cell">By</th>
                  <th className="text-right px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-400 w-[120px] sm:w-auto">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedGroups.map((group) => {
                  const bestFormat = getBestFormat(group.formats)
                  return (
                    <tr key={group.baseName} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <button
                          onClick={() => handlePreview(bestFormat)}
                          className="text-left hover:text-purple-400 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-white/5 rounded-lg text-purple-400 flex-shrink-0">
                              {getFileIcon(bestFormat.mime_type)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px] md:max-w-[300px]">{group.displayName}</div>
                              <div className="text-[10px] sm:text-xs text-gray-400 line-clamp-1">
                                {group.formats.map(f => getExtension(f.file_name).toUpperCase()).join(', ')}
                                <span className="hidden sm:inline"> • {group.creator?.name}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
                        <span className="text-xs sm:text-sm text-gray-400">
                          {group.formats.map(f => getExtension(f.file_name).toUpperCase()).join(', ')}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3 hidden lg:table-cell">
                        {group.creator && (
                          <span className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                            {group.creator.is_ai ? <Bot size={12} /> : <UserIcon size={12} />}
                            {group.creator.name}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center justify-end gap-1">
                          <MobileActions group={group} />
                          <button
                            onClick={() => handleDelete(group.baseName)}
                            className="p-1.5 sm:p-2 text-red-400 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                  })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredGroups.length)} of {filteredGroups.length} documents
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i
                  if (pageNum > totalPages) return null
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-2">Delete Document?</h3>
            <p className="text-gray-300 mb-6">
              This will permanently delete all formats of &quot;{documentGroups.find(g => g.baseName === deleteConfirm)?.displayName}&quot;. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(deleteConfirm)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
