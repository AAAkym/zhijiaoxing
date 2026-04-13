import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen,
  Video,
  Clock,
  Edit3,
  Trash2,
  Eye,
  Calendar,
  Bot
} from 'lucide-react'
import { getTagColor } from './NoteSearch'

export default function NoteCard({ 
  note, 
  variant = 'card', 
  onView, 
  onEdit, 
  onDelete,
  highlightedTitle,
  highlightedContent
}) {
  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatTimestamp = (seconds) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const truncateText = (html, maxLength = 150) => {
    if (!html) return ''
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
  }

  const renderTitle = () => {
    if (highlightedTitle) {
      return <span className="font-semibold text-gray-900 truncate">{highlightedTitle}</span>
    }
    return <span className="font-semibold text-gray-900 truncate">{note.title}</span>
  }

  const renderContent = (maxLength) => {
    if (highlightedContent) {
      return <span className="text-sm text-gray-600 line-clamp-2">{highlightedContent}</span>
    }
    return <span className="text-sm text-gray-600 line-clamp-2">{truncateText(note.content, maxLength)}</span>
  }

  const renderTags = (maxTags = 3) => {
    if (!note.tags || note.tags.length === 0) return null
    
    return (
      <div className="flex flex-wrap gap-1">
        {note.tags.slice(0, maxTags).map((tag, idx) => {
          const color = getTagColor(tag)
          return (
            <Badge 
              key={idx} 
              variant="outline"
              className={`text-xs ${color.bg} ${color.text} ${color.border}`}
            >
              {tag}
            </Badge>
          )
        })}
        {note.tags.length > maxTags && (
          <Badge variant="secondary" className="text-xs">
            +{note.tags.length - maxTags}
          </Badge>
        )}
      </div>
    )
  }

  if (variant === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0" onClick={onView}>
              <div className="flex items-center gap-2 mb-2">
                {renderTitle()}
                {note.is_auto_generated && (
                  <Badge variant="outline" className="text-purple-600 border-purple-200">
                    <Bot className="w-3 h-3 mr-1" />
                    AI生成
                  </Badge>
                )}
                {note.is_public && (
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    公开
                  </Badge>
                )}
              </div>
              
              <div className="text-sm text-gray-600 line-clamp-2 mb-2">
                {renderContent(200)}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                {note.course_title && (
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {note.course_title}
                  </span>
                )}
                {note.video_title && (
                  <span className="flex items-center gap-1">
                    <Video className="w-3 h-3" />
                    {note.video_title}
                  </span>
                )}
                {note.video_timestamp && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(note.video_timestamp)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(note.updated_at)}
                </span>
              </div>
              
              {renderTags()}
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={onView}>
                <Eye className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit3 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow h-full flex flex-col">
      <CardContent className="p-4 flex-1 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 line-clamp-2">
            {highlightedTitle ? (
              <span className="font-semibold text-gray-900">{highlightedTitle}</span>
            ) : (
              <span className="font-semibold text-gray-900">{note.title}</span>
            )}
          </div>
          {note.is_auto_generated && (
            <Badge variant="outline" className="text-purple-600 border-purple-200 ml-2 shrink-0">
              <Bot className="w-3 h-3 mr-1" />
              AI
            </Badge>
          )}
        </div>
        
        <div className="text-sm text-gray-600 line-clamp-3 mb-3 flex-1">
          {highlightedContent ? (
            <span>{highlightedContent}</span>
          ) : (
            <span>{truncateText(note.content, 150)}</span>
          )}
        </div>
        
        <div className="space-y-2 mb-3">
          {note.course_title && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <BookOpen className="w-3 h-3" />
              <span className="truncate">{note.course_title}</span>
            </div>
          )}
          
          {note.video_title && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Video className="w-3 h-3" />
              <span className="truncate">{note.video_title}</span>
              {note.video_timestamp && (
                <Badge variant="outline" className="text-xs ml-1">
                  {formatTimestamp(note.video_timestamp)}
                </Badge>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3 h-3" />
            {formatDate(note.updated_at)}
            {note.is_public && (
              <Badge variant="outline" className="text-green-600 border-green-200 ml-2">
                公开
              </Badge>
            )}
          </div>
        </div>
        
        {renderTags()}
        
        <div className="flex items-center justify-between pt-2 border-t mt-auto">
          <Button variant="ghost" size="sm" onClick={onView}>
            <Eye className="w-4 h-4 mr-1" />
            查看
          </Button>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <Edit3 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:text-red-700">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
