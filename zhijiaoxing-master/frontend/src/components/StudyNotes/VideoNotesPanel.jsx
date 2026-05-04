import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  FileText,
  Edit3,
  Trash2,
  Play,
  Loader2,
  CheckCircle,
  BookOpen
} from 'lucide-react'
import { notes } from '@/services/api'

export default function VideoNotesPanel({
  courseId,
  courseTitle,
  videoId,
  videoTitle,
  currentTimestamp = 0,
  onSeekTo,
  onPauseVideo,
  isExpanded = true,
  onToggleExpand
}) {
  const [notesList, setNotesList] = useState([])
  const [loading, setLoading] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [noteTimestamp, setNoteTimestamp] = useState(0)
  const [saving, setSaving] = useState(false)
  const [expandedNoteId, setExpandedNoteId] = useState(null)

  const fetchNotes = useCallback(async () => {
    if (!videoId) return
    
    setLoading(true)
    try {
      const response = await notes.getNotes({
        video_id: videoId,
        per_page: 100,
        sort_by: 'video_timestamp',
        sort_order: 'asc'
      })
      setNotesList(response.notes || [])
    } catch (err) {
      console.error('获取笔记失败:', err)
    } finally {
      setLoading(false)
    }
  }, [videoId])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return ''
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const parseTimestamp = (str) => {
    if (!str) return 0
    if (str.includes(':')) {
      const parts = str.split(':')
      return parseInt(parts[0]) * 60 + parseInt(parts[1])
    }
    return parseInt(str) || 0
  }

  const handleAddNote = () => {
    onPauseVideo?.()
    setEditingNote(null)
    setNoteTitle('')
    setNoteContent('')
    setNoteTimestamp(currentTimestamp)
    setShowEditor(true)
  }

  const handleEditNote = (note) => {
    setEditingNote(note)
    setNoteTitle(note.title || '')
    setNoteContent(note.content || '')
    setNoteTimestamp(note.video_timestamp || 0)
    setShowEditor(true)
  }

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return

    setSaving(true)
    try {
      const noteData = {
        title: noteTitle.trim() || `笔记 - ${formatTimestamp(noteTimestamp)}`,
        content: noteContent.trim(),
        course_id: courseId,
        video_id: videoId,
        video_timestamp: noteTimestamp
      }

      if (editingNote) {
        await notes.updateNote(editingNote.id, noteData)
      } else {
        await notes.createNote(noteData)
      }

      setShowEditor(false)
      fetchNotes()
    } catch (err) {
      console.error('保存笔记失败:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (!confirm('确定要删除这条笔记吗？')) return

    try {
      await notes.deleteNote(noteId)
      fetchNotes()
    } catch (err) {
      console.error('删除笔记失败:', err)
      alert('删除失败')
    }
  }

  const handleSeekToNote = (timestamp) => {
    if (onSeekTo && timestamp !== null && timestamp !== undefined) {
      onSeekTo(timestamp)
    }
  }

  const sortedNotes = [...notesList].sort((a, b) => {
    return (a.video_timestamp || 0) - (b.video_timestamp || 0)
  })

  if (!isExpanded) {
    return (
      <div className="bg-white border-l border-gray-200 w-64 flex flex-col">
        <div className="p-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-gray-700">笔记</span>
            {notesList.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {notesList.length}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onToggleExpand}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          {sortedNotes.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-xs">暂无笔记</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {sortedNotes.map((note) => (
                <div
                  key={note.id}
                  className={`p-2 rounded-lg cursor-pointer transition-colors ${
                    currentTimestamp >= (note.video_timestamp || 0) &&
                    currentTimestamp < ((note.video_timestamp || 0) + 30)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => handleSeekToNote(note.video_timestamp)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Play className="w-3 h-3 text-blue-500" />
                      <span className="text-xs text-blue-600">
                        {formatTimestamp(note.video_timestamp)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-gray-800 truncate">
                      {note.title || '无标题'}
                    </p>
                  </button>
                  <div className="mt-1">
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {note.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    )
  }

  return (
    <div className="bg-white border-l border-gray-200 w-full flex flex-col" style={{ maxHeight: '100%' }}>
      <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">视频笔记</h3>
          {notesList.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {notesList.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onToggleExpand}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 border-b border-gray-200 flex-shrink-0">
        <Button
          className="w-full"
          size="sm"
          onClick={handleAddNote}
          disabled={!videoId}
        >
          <Plus className="w-4 h-4 mr-2" />
          添加笔记
          {currentTimestamp > 0 && (
            <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
              {formatTimestamp(currentTimestamp)}
            </Badge>
          )}
        </Button>
      </div>

      {showEditor && (
        <div className="p-3 border-b border-gray-200 bg-blue-50 flex-shrink-0">
          <div className="space-y-3">
            <Input
              placeholder="笔记标题（可选）"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              className="bg-white"
            />
            
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="时间戳 (如: 2:30)"
                value={formatTimestamp(noteTimestamp)}
                onChange={(e) => setNoteTimestamp(parseTimestamp(e.target.value))}
                className="flex-1 bg-white"
              />
            </div>

            <Textarea
              placeholder="记录你的学习心得..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              rows={4}
              className="bg-white resize-none"
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditor(false)}
                className="flex-1"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={!noteContent.trim() || saving}
                className="flex-1"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  '保存'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto" style={{ minHeight: '200px' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : sortedNotes.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">暂无笔记</p>
            <p className="text-xs mt-1">点击上方按钮添加笔记</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {sortedNotes.map((note) => {
              const isNoteExpanded = expandedNoteId === note.id
              const hasLongContent = (note.content || '').length > 100
              return (
                <Card
                  key={note.id}
                  className={`group relative hover:shadow-md transition-shadow overflow-hidden ${
                    currentTimestamp >= (note.video_timestamp || 0) &&
                    currentTimestamp < ((note.video_timestamp || 0) + 30)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <button
                        className="flex items-center gap-2 focus:outline-none"
                        onClick={() => handleSeekToNote(note.video_timestamp)}
                      >
                        {note.video_timestamp !== null && note.video_timestamp !== undefined && (
                          <Badge
                            variant="outline"
                            className="text-blue-600 border-blue-200 hover:bg-blue-100 transition-colors"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            {formatTimestamp(note.video_timestamp)}
                          </Badge>
                        )}
                      </button>
                      <div className="flex gap-1">
                        {hasLongContent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => setExpandedNoteId(isNoteExpanded ? null : note.id)}
                          >
                            {isNoteExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleEditNote(note)}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteNote(note.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <button
                      className="w-full text-left focus:outline-none"
                      onClick={() => handleSeekToNote(note.video_timestamp)}
                    >
                      <p className="text-sm font-medium text-gray-800 line-clamp-1">
                        {note.title || '无标题'}
                      </p>
                      <p className={`text-xs text-gray-600 mt-1 ${
                        hasLongContent && !isNoteExpanded ? 'line-clamp-2' : ''
                      }`}>
                        {note.content}
                      </p>
                    </button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {videoTitle && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-500 truncate">
            📹 {videoTitle}
          </p>
        </div>
      )}
    </div>
  )
}
