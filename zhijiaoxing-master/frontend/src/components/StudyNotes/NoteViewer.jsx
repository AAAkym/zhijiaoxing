import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft,
  Edit3,
  BookOpen,
  Video,
  Clock,
  Calendar,
  Tag,
  Bot,
  Globe,
  Lock,
  Play
} from 'lucide-react'
import '@/styles/rich-text-editor.css'

export default function NoteViewer({ note, onBack, onEdit }) {
  if (!note) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">未找到笔记</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>
            返回列表
          </Button>
        </CardContent>
      </Card>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatTimestamp = (seconds) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleJumpToVideo = () => {
    if (note.video_id && note.video_timestamp) {
      console.log(`跳转到视频 ${note.video_id} 的 ${note.video_timestamp} 秒`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">笔记详情</h2>
        </div>
        <Button onClick={onEdit}>
          <Edit3 className="w-4 h-4 mr-2" />
          编辑
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {note.is_auto_generated && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    <Bot className="w-3 h-3 mr-1" />
                    AI生成
                  </Badge>
                )}
                {note.is_public ? (
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    <Globe className="w-3 h-3 mr-1" />
                    公开
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-600 border-gray-200">
                    <Lock className="w-3 h-3 mr-1" />
                    私有
                  </Badge>
                )}
              </div>
              <CardTitle className="text-xl">{note.title}</CardTitle>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {note.course_title && (
              <div className="flex items-center gap-2 text-gray-600">
                <BookOpen className="w-4 h-4 text-blue-500" />
                <span className="truncate">{note.course_title}</span>
              </div>
            )}
            {note.video_title && (
              <div className="flex items-center gap-2 text-gray-600">
                <Video className="w-4 h-4 text-green-500" />
                <span className="truncate">{note.video_title}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>{formatDate(note.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4 text-purple-500" />
              <span>更新于 {formatDate(note.updated_at)}</span>
            </div>
          </div>

          {note.video_id && note.video_timestamp && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-800">
                      视频时间点: {formatTimestamp(note.video_timestamp)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleJumpToVideo}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    跳转播放
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          <div>
            <h3 className="font-medium text-gray-900 mb-3">笔记内容</h3>
            <div className="bg-white rounded-lg border p-4">
              <div 
                className="prose prose-sm sm:prose lg:prose-lg max-w-none note-content"
                dangerouslySetInnerHTML={{ __html: note.content || '' }}
              />
            </div>
          </div>

          {note.tags && note.tags.length > 0 && (
            <div>
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" />
                标签
              </h3>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, idx) => (
                  <Badge key={idx} variant="secondary" className="text-sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {note.video_id && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Video className="w-5 h-5" />
              关联视频
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{note.video_title || '未知视频'}</p>
                <p className="text-sm text-gray-500">
                  来自课程: {note.course_title || '未知课程'}
                </p>
              </div>
              <Button onClick={handleJumpToVideo}>
                <Play className="w-4 h-4 mr-2" />
                播放视频
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
