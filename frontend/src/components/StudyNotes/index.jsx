import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  FileText,
  Loader2,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Calendar
} from 'lucide-react'
import { notes } from '@/services/api'
import NoteCard from './NoteCard'
import NoteEditor from './NoteEditor'
import NoteViewer from './NoteViewer'
import NoteSearch, { highlightText, TAG_COLORS } from './NoteSearch'
import TagCloud from './TagCloud'
import { NotesOrganizePanel, WeeklyReportPanel } from './NoteAIPanel'

export default function StudyNotes({ myCourses = [] }) {
  const [viewMode, setViewMode] = useState('card')
  const [notesList, setNotesList] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentView, setCurrentView] = useState('list')
  const [selectedNote, setSelectedNote] = useState(null)
  const [stats, setStats] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [selectedTags, setSelectedTags] = useState([])
  const [tagColors, setTagColors] = useState({})
  const [showSidebar, setShowSidebar] = useState(true)
  const [selectedNoteIds, setSelectedNoteIds] = useState([])
  
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    course_id: null,
    date_range: null,
    tags: []
  })
  
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 12,
    total: 0,
    total_pages: 0
  })

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = {
        page: pagination.page,
        per_page: pagination.per_page
      }
      
      if (searchParams.course_id) {
        params.course_id = searchParams.course_id
      }
      
      const response = await notes.getNotes(params)
      let notesData = response.notes || []
      
      if (searchParams.keyword) {
        notesData = notesData.filter(note => 
          note.title?.toLowerCase().includes(searchParams.keyword.toLowerCase()) ||
          note.content?.toLowerCase().includes(searchParams.keyword.toLowerCase())
        )
      }
      
      if (searchParams.tags && searchParams.tags.length > 0) {
        notesData = notesData.filter(note => 
          note.tags && searchParams.tags.some(tag => note.tags.includes(tag))
        )
      }
      
      if (searchParams.date_range && searchParams.date_range !== 'all') {
        const now = new Date()
        const ranges = {
          today: 1,
          week: 7,
          month: 30,
          quarter: 90,
          year: 365
        }
        const days = ranges[searchParams.date_range] || 0
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
        
        notesData = notesData.filter(note => 
          new Date(note.updated_at || note.created_at) >= cutoff
        )
      }
      
      setNotesList(notesData)
      setPagination(prev => ({
        ...prev,
        total: notesData.length,
        total_pages: Math.ceil(notesData.length / pagination.per_page)
      }))
    } catch (err) {
      console.error('获取笔记失败:', err)
      // 区分认证错误和其他错误，提供更友好的提示
      if (err.isAuthError || err.status === 401) {
        setError('登录已过期，请重新登录后再查看笔记')
      } else {
        setError(err.errorDetail || err.message || '加载笔记失败，请稍后重试')
      }
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.per_page, searchParams])

  const fetchStats = useCallback(async () => {
    try {
      const response = await notes.getStats()
      setStats(response.stats)
    } catch (err) {
      console.error('获取统计失败:', err)
    }
  }, [])

  const fetchAllTags = useCallback(async () => {
    try {
      const response = await notes.getAllTags()
      setAllTags(response.tags || [])
    } catch (err) {
      console.error('获取标签失败:', err)
    }
  }, [])

  useEffect(() => {
    fetchNotes()
    fetchStats()
    fetchAllTags()
  }, [fetchNotes, fetchStats, fetchAllTags])

  const tagsWithCount = useMemo(() => {
    return stats?.by_tag || {}
  }, [stats])

  const handleSearch = useCallback((params) => {
    setSearchParams(prev => ({
      ...prev,
      keyword: params.keyword || '',
      course_id: params.course_id || null,
      date_range: params.date_range || null,
      tags: params.tags || []
    }))
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  const handleTagFilter = useCallback((tags) => {
    if (tags === null) {
      setSelectedTags([])
      setSearchParams(prev => ({ ...prev, tags: [] }))
    } else if (Array.isArray(tags)) {
      setSelectedTags(tags)
      setSearchParams(prev => ({ ...prev, tags }))
    } else {
      const tag = tags
      const newTags = selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag]
      setSelectedTags(newTags)
      setSearchParams(prev => ({ ...prev, tags: newTags }))
    }
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [selectedTags])

  const handleTagColorChange = useCallback((tag, color) => {
    setTagColors(prev => ({
      ...prev,
      [tag]: color
    }))
  }, [])

  const handleCreateNote = () => {
    setSelectedNote(null)
    setCurrentView('editor')
  }

  const handleEditNote = (note) => {
    setSelectedNote(note)
    setCurrentView('editor')
  }

  const handleViewNote = (note) => {
    setSelectedNote(note)
    setCurrentView('viewer')
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('确定要删除这条笔记吗？')) return
    
    try {
      await notes.deleteNote(noteId)
      fetchNotes()
      fetchStats()
      fetchAllTags()
    } catch (err) {
      console.error('删除失败:', err)
      alert('删除失败')
    }
  }

  const handleSaveNote = async (noteData) => {
    try {
      if (selectedNote) {
        await notes.updateNote(selectedNote.id, noteData)
      } else {
        await notes.createNote(noteData)
      }
      setCurrentView('list')
      fetchNotes()
      fetchStats()
      fetchAllTags()
    } catch (err) {
      console.error('保存失败:', err)
      throw err
    }
  }

  const handleBack = () => {
    setCurrentView('list')
    setSelectedNote(null)
  }

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }))
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedNoteIds(notesList.map(n => n.id))
    } else {
      setSelectedNoteIds([])
    }
  }

  const handleSelectNote = (noteId, checked) => {
    if (checked) {
      setSelectedNoteIds(prev => [...prev, noteId])
    } else {
      setSelectedNoteIds(prev => prev.filter(id => id !== noteId))
    }
  }

  const selectedNotes = useMemo(() => {
    return notesList.filter(n => selectedNoteIds.includes(n.id))
  }, [notesList, selectedNoteIds])

  const notesWithHighlight = useMemo(() => {
    if (!searchParams.keyword) return notesList
    
    return notesList.map(note => ({
      ...note,
      highlightedTitle: highlightText(note.title, searchParams.keyword),
      highlightedContent: highlightText(
        note.content?.replace(/<[^>]*>/g, '').slice(0, 200),
        searchParams.keyword
      )
    }))
  }, [notesList, searchParams.keyword])

  if (currentView === 'editor') {
    return (
      <NoteEditor
        note={selectedNote}
        myCourses={myCourses}
        onSave={handleSaveNote}
        onCancel={handleBack}
        allTags={allTags}
      />
    )
  }

  if (currentView === 'viewer' && selectedNote) {
    return (
      <NoteViewer
        note={selectedNote}
        onBack={handleBack}
        onEdit={() => handleEditNote(selectedNote)}
      />
    )
  }

  return (
    <div className="flex gap-6">
      {showSidebar && (
        <div className="w-64 shrink-0 hidden lg:block">
          <TagCloud
            tagsWithCount={tagsWithCount}
            selectedTags={selectedTags}
            onTagSelect={handleTagFilter}
            onTagColorChange={handleTagColorChange}
            tagColors={tagColors}
            showCreate={false}
          />
        </div>
      )}
      
      <div className="flex-1 min-w-0 space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden lg:flex"
            >
              {showSidebar ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">学习笔记</h2>
              <p className="text-gray-600">记录学习心得，整理知识要点</p>
            </div>
          </div>
          <div className="flex gap-2">
            <WeeklyReportPanel />
            {selectedNoteIds.length > 0 && (
              <NotesOrganizePanel selectedNotes={selectedNotes} />
            )}
            <Button variant="outline" onClick={() => { fetchNotes(); fetchStats(); fetchAllTags(); }} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button onClick={handleCreateNote}>
              <Plus className="w-4 h-4 mr-2" />
              新建笔记
            </Button>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">总笔记</p>
                    <p className="text-xl font-bold">{stats.total_notes || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">公开笔记</p>
                    <p className="text-xl font-bold">{stats.public_notes || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">AI生成</p>
                    <p className="text-xl font-bold">{stats.auto_generated || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-gray-600">标签数</p>
                    <p className="text-xl font-bold">{Object.keys(stats.by_tag || {}).length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex-1 min-w-0">
                <NoteSearch
                  myCourses={myCourses}
                  allTags={allTags}
                  onSearch={handleSearch}
                  onTagFilter={handleTagFilter}
                  loading={loading}
                  initialKeyword={searchParams.keyword}
                  initialCourse={searchParams.course_id || 'all'}
                  initialDateRange={searchParams.date_range || 'all'}
                  initialTags={selectedTags}
                />
              </div>
              
              <div className="flex border rounded-lg overflow-hidden shrink-0">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className="rounded-none"
                >
                  <LayoutGrid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-none"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:hidden">
          <TagCloud
            tagsWithCount={tagsWithCount}
            selectedTags={selectedTags}
            onTagSelect={handleTagFilter}
            onTagColorChange={handleTagColorChange}
            tagColors={tagColors}
            compact
          />
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center text-red-500">
              {error}
            </CardContent>
          </Card>
        ) : notesWithHighlight.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 text-lg mb-2">
                {searchParams.keyword || selectedTags.length > 0 ? '没有找到匹配的笔记' : '暂无笔记'}
              </p>
              <p className="text-gray-400 text-sm mb-4">
                {searchParams.keyword || selectedTags.length > 0 ? '尝试调整搜索条件' : '点击上方"新建笔记"开始记录'}
              </p>
              {(searchParams.keyword || selectedTags.length > 0) ? (
                <Button variant="outline" onClick={() => {
                  setSearchParams({ keyword: '', course_id: null, date_range: null, tags: [] })
                  setSelectedTags([])
                }}>
                  清除筛选
                </Button>
              ) : (
                <Button onClick={handleCreateNote}>
                  <Plus className="w-4 h-4 mr-2" />
                  创建第一条笔记
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Checkbox
                id="select-all-notes"
                checked={selectedNoteIds.length === notesList.length && notesList.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <label htmlFor="select-all-notes" className="text-sm text-gray-600 cursor-pointer">
                全选当前页
              </label>
              {selectedNoteIds.length > 0 && (
                <span className="text-sm text-purple-600 ml-2">
                  已选择 {selectedNoteIds.length} 篇笔记
                </span>
              )}
            </div>

            {viewMode === 'card' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {notesWithHighlight.map(note => (
                  <div key={note.id} className="relative">
                    <div 
                      className="absolute top-3 left-3 z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedNoteIds.includes(note.id)}
                        onCheckedChange={(checked) => handleSelectNote(note.id, checked)}
                      />
                    </div>
                    <NoteCard
                      note={note}
                      highlightedTitle={note.highlightedTitle}
                      highlightedContent={note.highlightedContent}
                      onView={() => handleViewNote(note)}
                      onEdit={() => handleEditNote(note)}
                      onDelete={() => handleDeleteNote(note.id)}
                      className={selectedNoteIds.includes(note.id) ? 'ring-2 ring-purple-300' : ''}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {notesWithHighlight.map(note => (
                  <div 
                    key={note.id} 
                    className={`flex items-start gap-3 p-4 bg-white rounded-lg border ${
                      selectedNoteIds.includes(note.id) ? 'ring-2 ring-purple-300 bg-purple-50/30' : ''
                    }`}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedNoteIds.includes(note.id)}
                        onCheckedChange={(checked) => handleSelectNote(note.id, checked)}
                      />
                    </div>
                    <div className="flex-1">
                      <NoteCard
                        note={note}
                        variant="list"
                        highlightedTitle={note.highlightedTitle}
                        highlightedContent={note.highlightedContent}
                        onView={() => handleViewNote(note)}
                        onEdit={() => handleEditNote(note)}
                        onDelete={() => handleDeleteNote(note.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pagination.total_pages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-6">
                <Button
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </Button>
                <span className="text-sm text-gray-600">
                  第 {pagination.page} / {pagination.total_pages} 页
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
