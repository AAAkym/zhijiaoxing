import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Save,
  X,
  Clock,
  Loader2,
  Video,
  BookOpen,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { notes } from '@/services/api'

export default function QuickNote({
  courseId,
  courseTitle,
  videoId,
  videoTitle,
  currentTimestamp = 0,
  onSave,
  onCancel,
  isMinimized = false
}) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [minimized, setMinimized] = useState(isMinimized)
  const [saved, setSaved] = useState(false)

  const formatTimestamp = (seconds) => {
    if (!seconds) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSave = async () => {
    if (!content.trim()) return

    setSaving(true)
    try {
      const noteData = {
        title: `快速笔记 - ${formatTimestamp(currentTimestamp)}`,
        content: content.trim(),
        course_id: courseId,
        video_id: videoId,
        video_timestamp: currentTimestamp,
        is_public: false
      }

      const result = await notes.createNote(noteData)
      setSaved(true)
      setContent('')
      
      if (onSave) {
        onSave(result.note)
      }

      setTimeout(() => {
        setSaved(false)
      }, 2000)
    } catch (err) {
      console.error('保存快速笔记失败:', err)
      alert('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setContent('')
    if (onCancel) {
      onCancel()
    }
  }

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="shadow-lg w-64">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">快速笔记</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMinimized(false)}
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>
            {currentTimestamp > 0 && (
              <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3" />
                当前时间: {formatTimestamp(currentTimestamp)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card className="shadow-lg w-full max-w-md">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            快速笔记
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMinimized(true)}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {videoTitle && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Video className="w-4 h-4 text-green-500" />
            <span className="truncate">{videoTitle}</span>
          </div>
        )}
        
        {courseTitle && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="truncate">{courseTitle}</span>
          </div>
        )}
        
        {currentTimestamp > 0 && (
          <Badge variant="outline" className="text-blue-600 border-blue-200">
            <Clock className="w-3 h-3 mr-1" />
            {formatTimestamp(currentTimestamp)}
          </Badge>
        )}

        <Textarea
          placeholder="快速记录学习心得..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="resize-none"
          autoFocus
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {content.length} 字
          </span>
          <div className="flex gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={handleCancel}>
                取消
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!content.trim() || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  保存中
                </>
              ) : saved ? (
                <>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    已保存
                  </Badge>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
