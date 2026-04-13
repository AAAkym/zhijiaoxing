import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Upload, Play, Edit, Trash2, Plus, Video, Eye, Clock, Users } from 'lucide-react'
import { videos } from '../services/api'
import VideoPlayer from './VideoPlayer'

export default function VideoLessonManager({ courseId }) {
  const [videoList, setVideoList] = useState([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingVideo, setEditingVideo] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewVideo, setPreviewVideo] = useState(null)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration: '',
    is_free: false,
    status: 'published'
  })

  useEffect(() => {
    if (courseId) {
      loadVideos()
    }
  }, [courseId])

  const loadVideos = async () => {
    try {
      setIsLoading(true)
      const response = await videos.getByCourse(courseId)
      setVideoList(response.videos || [])
    } catch (error) {
      console.error('加载视频列表失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      setIsUploading(true)
      const response = await videos.uploadFile(file)
      setFormData(prev => ({
        ...prev,
        video_url: response.video_url
      }))
      alert('视频上传成功！')
    } catch (error) {
      console.error('视频上传失败:', error)
      alert('视频上传失败: ' + (error.message || '未知错误'))
    } finally {
      setIsUploading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setIsLoading(true)
      const data = {
        ...formData,
        duration: formData.duration ? parseInt(formData.duration) : null
      }

      if (editingVideo) {
        await videos.update(editingVideo.id, data)
        alert('视频更新成功！')
      } else {
        await videos.create(courseId, data)
        alert('视频创建成功！')
      }

      setIsAddDialogOpen(false)
      resetForm()
      loadVideos()
    } catch (error) {
      console.error('保存视频失败:', error)
      alert('保存视频失败: ' + (error.message || '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (video) => {
    setEditingVideo(video)
    setFormData({
      title: video.title,
      description: video.description || '',
      video_url: video.video_url,
      thumbnail_url: video.thumbnail_url || '',
      duration: video.duration?.toString() || '',
      is_free: video.is_free || false,
      status: video.status || 'published'
    })
    setIsAddDialogOpen(true)
  }

  const handleDelete = async (videoId) => {
    if (!confirm('确定要删除这个视频吗？此操作不可撤销。')) return

    try {
      setIsLoading(true)
      await videos.delete(videoId)
      alert('视频删除成功！')
      loadVideos()
    } catch (error) {
      console.error('删除视频失败:', error)
      alert('删除视频失败: ' + (error.message || '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEditingVideo(null)
    setFormData({
      title: '',
      description: '',
      video_url: '',
      thumbnail_url: '',
      duration: '',
      is_free: false,
      status: 'published'
    })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusBadge = (status) => {
    const styles = {
      published: 'bg-green-100 text-green-700',
      draft: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-700'
    }
    const labels = {
      published: '已发布',
      draft: '草稿',
      archived: '已归档'
    }
    return (
      <span className={`px-2 py-1 rounded text-xs ${styles[status] || styles.draft}`}>
        {labels[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">视频课程管理</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="w-4 h-4 mr-2" />
              添加视频
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingVideo ? '编辑视频' : '添加视频'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>视频标题 *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="输入视频标题"
                  required
                />
              </div>

              <div>
                <Label>视频描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="输入视频描述"
                  rows={3}
                />
              </div>

              <div>
                <Label>上传视频文件</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                  />
                </div>
                {isUploading && (
                  <p className="text-sm text-gray-500 mt-2">正在上传视频...</p>
                )}
              </div>

              <div>
                <Label>视频URL *</Label>
                <Input
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="或输入视频URL"
                  required
                />
              </div>

              <div>
                <Label>缩略图URL</Label>
                <Input
                  value={formData.thumbnail_url}
                  onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                  placeholder="输入缩略图URL"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>时长（秒）</Label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="视频时长"
                  />
                </div>
                <div>
                  <Label>状态</Label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-10 px-3 border rounded-md"
                  >
                    <option value="published">发布</option>
                    <option value="draft">草稿</option>
                    <option value="archived">归档</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_free}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_free: checked })}
                />
                <Label>免费观看</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddDialogOpen(false)}
                >
                  取消
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '保存中...' : '保存'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8">加载中...</div>
      ) : videoList.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Video className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">暂无视频课程</p>
            <p className="text-sm text-gray-400 mt-2">点击"添加视频"开始创建</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {videoList.map((video, index) => (
            <Card key={video.id}>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-40 h-24 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-40 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Video className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-lg">{video.title}</h4>
                        {video.description && (
                          <p className="text-gray-600 text-sm mt-1 line-clamp-2">{video.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {formatDuration(video.duration)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {video.views_count || 0} 次观看
                          </span>
                          {video.is_free && (
                            <span className="text-green-600 font-medium">免费</span>
                          )}
                          {getStatusBadge(video.status)}
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewVideo(video)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          预览
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(video)}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          编辑
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(video.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {previewVideo && (
        <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{previewVideo.title}</DialogTitle>
            </DialogHeader>
            <VideoPlayer
              videoUrl={previewVideo.video_url}
              title={previewVideo.title}
            />
            {previewVideo.description && (
              <p className="text-gray-600">{previewVideo.description}</p>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
