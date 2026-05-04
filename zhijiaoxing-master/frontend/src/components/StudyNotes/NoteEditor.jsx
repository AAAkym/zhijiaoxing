import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import RichTextEditor from '@/components/ui/RichTextEditor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ArrowLeft,
  Save,
  X,
  Clock,
  Loader2,
  AlertCircle,
  Tag,
  Plus,
  Sparkles
} from 'lucide-react'
import { notes as notesApi } from '@/services/api'
import { getTagColor } from './NoteSearch'

const SUGGESTED_TAGS = [
  '重要', '待复习', '已掌握', '难点', '考点',
  '公式', '概念', '例题', '总结', '疑问',
  '笔记', '作业', '考试', '重点', '易错'
]

export default function NoteEditor({ note, myCourses, onSave, onCancel, allTags = [] }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [courseId, setCourseId] = useState('')
  const [videoId, setVideoId] = useState('')
  const [videoTimestamp, setVideoTimestamp] = useState('')
  const [tags, setTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [showTagSuggestions, setShowTagSuggestions] = useState(false)
  const [isRecommendingTags, setIsRecommendingTags] = useState(false)
  const [aiRecommendedTags, setAiRecommendedTags] = useState([])
  
  const tagInputRef = useRef(null)
  const suggestionsRef = useRef(null)

  useEffect(() => {
    if (note) {
      setTitle(note.title || '')
      setContent(note.content || '')
      setCourseId(note.course_id ? String(note.course_id) : '')
      setVideoId(note.video_id ? String(note.video_id) : '')
      setVideoTimestamp(note.video_timestamp || '')
      setTags(note.tags || [])
      setIsPublic(note.is_public || false)
    }
  }, [note])

  const handleImageUpload = useCallback(async (file) => {
    try {
      const formData = new FormData()
      formData.append('image', file)
      const response = await notesApi.uploadImage(formData)
      return response.url
    } catch (error) {
      console.error('图片上传失败:', error)
      throw error
    }
  }, [])

  const selectedCourse = myCourses.find(c => String(c.id) === courseId)
  const availableVideos = selectedCourse?.videos || []

  const filteredSuggestions = useMemo(() => {
    const input = tagInput.toLowerCase().trim()
    if (!input) {
      return [...new Set([...allTags, ...SUGGESTED_TAGS])].slice(0, 8)
    }
    
    const allSuggestions = [...new Set([...allTags, ...SUGGESTED_TAGS])]
    return allSuggestions
      .filter(tag => 
        tag.toLowerCase().includes(input) && !tags.includes(tag)
      )
      .slice(0, 6)
  }, [tagInput, allTags, tags])

  const handleAITagRecommend = useCallback(async () => {
    if (!title && !content) return
    
    setIsRecommendingTags(true)
    try {
      const response = await notesApi.recommendTags(title, content)
      if (response.recommended_tags) {
        setAiRecommendedTags(response.recommended_tags.filter(t => !tags.includes(t)))
      }
    } catch (error) {
      console.error('AI 标签推荐失败:', error)
    } finally {
      setIsRecommendingTags(false)
    }
  }, [title, content, tags])

  const addAITag = (tag) => {
    if (!tags.includes(tag)) {
      setTags([...tags, tag])
      setAiRecommendedTags(prev => prev.filter(t => t !== tag))
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!title.trim()) {
      newErrors.title = '请输入标题'
    }
    const textContent = content.replace(/<[^>]*>/g, '').trim()
    if (!textContent) {
      newErrors.content = '请输入内容'
    }
    if (!courseId) {
      newErrors.courseId = '请选择课程'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      const noteData = {
        title: title.trim(),
        content: content.trim(),
        course_id: parseInt(courseId),
        video_id: videoId ? parseInt(videoId) : null,
        video_timestamp: videoTimestamp ? parseFloat(videoTimestamp) : null,
        tags: tags,
        is_public: isPublic
      }
      
      await onSave(noteData)
    } catch (err) {
      console.error('保存失败:', err)
      // 显示后端返回的具体错误信息，帮助用户理解失败原因
      if (err.isAuthError || err.status === 401) {
        setErrors({ submit: '登录已过期，请重新登录后再保存' })
      } else if (err.status === 400) {
        // 后端验证失败，显示具体原因
        const errorMsg = err.errorDetail || err.message || '请检查输入内容'
        // 将后端错误消息转换为更友好的中文提示
        let userFriendlyMsg = errorMsg
        if (errorMsg.toLowerCase().includes('title')) {
          userFriendlyMsg = '标题不能为空'
        } else if (errorMsg.toLowerCase().includes('content')) {
          userFriendlyMsg = '笔记内容不能为空'
        } else if (errorMsg.toLowerCase().includes('course_id') || errorMsg.toLowerCase().includes('course')) {
          userFriendlyMsg = '请选择有效的课程'
        } else if (errorMsg.toLowerCase().includes('not found')) {
          userFriendlyMsg = '关联的课程或视频不存在，请重新选择'
        }
        setErrors({ submit: userFriendlyMsg })
      } else if (err.status === 404) {
        setErrors({ submit: '关联的资源不存在，请检查课程和视频选择' })
      } else {
        setErrors({ submit: err.errorDetail || err.message || '保存失败，请重试' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = (tag) => {
    const trimmedTag = (tag || tagInput).trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setTagInput('')
      setShowTagSuggestions(false)
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredSuggestions.length > 0 && showTagSuggestions) {
        handleAddTag(filteredSuggestions[0])
      } else {
        handleAddTag(tagInput)
      }
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false)
    }
  }

  const handleTagInputChange = (e) => {
    setTagInput(e.target.value)
    setShowTagSuggestions(true)
  }

  const handleTagInputFocus = () => {
    setShowTagSuggestions(true)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(e.target) &&
        tagInputRef.current &&
        !tagInputRef.current.contains(e.target)
      ) {
        setShowTagSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onCancel}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            {note ? '编辑笔记' : '新建笔记'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="w-4 h-4 mr-2" />
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                保存
              </>
            )}
          </Button>
        </div>
      </div>

      {errors.submit && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center text-red-700">
            <AlertCircle className="w-5 h-5 mr-2" />
            {errors.submit}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>笔记内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">标题 *</Label>
                <Input
                  id="title"
                  placeholder="输入笔记标题..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && (
                  <p className="text-sm text-red-500 mt-1">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="content">内容 *</Label>
                <div className={errors.content ? 'border border-red-500 rounded-lg' : ''}>
                  <RichTextEditor
                    content={content}
                    onChange={setContent}
                    placeholder="输入笔记内容，支持富文本格式..."
                    onImageUpload={handleImageUpload}
                  />
                </div>
                {errors.content && (
                  <p className="text-sm text-red-500 mt-1">{errors.content}</p>
                )}
              </div>

              <div>
                <Label htmlFor="tags">
                  <Tag className="w-4 h-4 inline mr-1" />
                  标签
                </Label>
                <div className="relative">
                  <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                      <Input
                        ref={tagInputRef}
                        id="tags"
                        placeholder="输入标签后按回车添加..."
                        value={tagInput}
                        onChange={handleTagInputChange}
                        onKeyDown={handleTagKeyDown}
                        onFocus={handleTagInputFocus}
                      />
                      
                      {showTagSuggestions && filteredSuggestions.length > 0 && (
                        <div 
                          ref={suggestionsRef}
                          className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto"
                        >
                          {filteredSuggestions.map((suggestion, index) => {
                            const color = getTagColor(suggestion)
                            return (
                              <button
                                key={index}
                                type="button"
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 ${
                                  index === 0 ? 'bg-gray-50' : ''
                                }`}
                                onClick={() => handleAddTag(suggestion)}
                              >
                                <span className={`px-2 py-0.5 rounded text-xs ${color.bg} ${color.text}`}>
                                  {suggestion}
                                </span>
                                {allTags.includes(suggestion) && (
                                  <span className="text-xs text-gray-400">已使用</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => handleAddTag(tagInput)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleAITagRecommend}
                      disabled={isRecommendingTags || (!title && !content)}
                      title="AI 智能推荐标签"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                    >
                      {isRecommendingTags ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {aiRecommendedTags.length > 0 && (
                  <div className="mb-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-1 mb-2 text-sm text-purple-700">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-medium">AI 推荐标签</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {aiRecommendedTags.map((tag, index) => {
                        const color = getTagColor(tag)
                        return (
                          <Badge
                            key={index}
                            variant="outline"
                            className={`cursor-pointer hover:opacity-80 ${color.bg} ${color.text} ${color.border}`}
                            onClick={() => addAITag(tag)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                )}
                
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => {
                      const color = getTagColor(tag)
                      return (
                        <Badge
                          key={index}
                          variant="outline"
                          className={`cursor-pointer hover:opacity-80 ${color.bg} ${color.text} ${color.border}`}
                          onClick={() => handleRemoveTag(tag)}
                        >
                          {tag}
                          <X className="w-3 h-3 ml-1" />
                        </Badge>
                      )
                    })}
                  </div>
                )}
                
                {tags.length === 0 && aiRecommendedTags.length === 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    添加标签便于分类和搜索笔记，点击 ✨ 按钮 AI 智能推荐
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>关联信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="course">关联课程 *</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className={errors.courseId ? 'border-red-500' : ''}>
                    <SelectValue placeholder="选择课程" />
                  </SelectTrigger>
                  <SelectContent>
                    {myCourses.map(course => (
                      <SelectItem key={course.id} value={String(course.id)}>
                        {course.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.courseId && (
                  <p className="text-sm text-red-500 mt-1">{errors.courseId}</p>
                )}
              </div>

              {courseId && availableVideos.length > 0 && (
                <div>
                  <Label htmlFor="video">关联视频</Label>
                  <Select value={videoId} onValueChange={setVideoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择视频（可选）" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVideos.map(video => (
                        <SelectItem key={video.id} value={String(video.id)}>
                          {video.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {videoId && (
                <div>
                  <Label htmlFor="timestamp">
                    <Clock className="w-4 h-4 inline mr-1" />
                    视频时间戳
                  </Label>
                  <Input
                    id="timestamp"
                    placeholder="例如: 120 (秒) 或 2:30"
                    value={videoTimestamp}
                    onChange={(e) => setVideoTimestamp(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    记录笔记对应的视频时间点
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t">
                <div>
                  <Label htmlFor="public">公开笔记</Label>
                  <p className="text-xs text-gray-500">其他同学可以看到</p>
                </div>
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>提示</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• 使用清晰的标题概括笔记主题</li>
                <li>• 添加标签便于分类和搜索</li>
                <li>• 关联视频可以记录学习进度</li>
                <li>• 公开笔记可以帮助其他同学</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
