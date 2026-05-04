import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Camera, 
  Target, 
  Bot, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Upload
} from 'lucide-react'
import { studentSettings } from '../services/api'

const AI_STYLES = [
  { id: 'academic', name: '严谨学术型', description: '准确、专业、严谨，提供详细的理论依据和知识点解释' },
  { id: 'humorous', name: '幽默风趣型', description: '用生动有趣的比喻和例子解释概念，让学习变得轻松愉快' },
  { id: 'encouraging', name: '鼓励引导型', description: '给予充分肯定和鼓励，循序渐进地引导思考' },
  { id: 'concise', name: '简洁直接型', description: '直接回答问题，重点突出，条理清晰' }
]

export function StudentSettings({ onSettingsChange, initialSettings }) {
  const [settings, setSettings] = useState({
    id: null,
    username: '',
    email: '',
    real_name: '',
    avatar: '',
    learning_goal: '',
    ai_style: 'academic',
    ai_style_name: '严谨学术型'
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState({
    profile: false,
    avatar: false,
    learningGoal: false,
    aiStyle: false
  })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')
  const [avatarPreview, setAvatarPreview] = useState('')

  useEffect(() => {
    if (initialSettings) {
      setSettings(initialSettings)
      if (initialSettings.avatar) {
        setAvatarPreview(initialSettings.avatar)
      }
    }
  }, [initialSettings])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const response = await studentSettings.getSettings()
      setSettings(response.settings)
      if (response.settings.avatar) {
        setAvatarPreview(response.settings.avatar)
      }
      if (onSettingsChange) {
        onSettingsChange(response.settings)
      }
    } catch (error) {
      console.error('加载设置失败:', error)
    } finally {
      setLoading(false)
    }
  }, [onSettingsChange])

  useEffect(() => {
    if (!initialSettings) {
      loadSettings()
    }
  }, [loadSettings, initialSettings])

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, avatar: '图片大小不能超过5MB' }))
        return
      }

      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        setErrors(prev => ({ ...prev, avatar: '只支持 PNG、JPG、GIF、WEBP 格式' }))
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        setAvatarPreview(reader.result)
        setErrors(prev => ({ ...prev, avatar: null }))
      }
      reader.readAsDataURL(file)
    }
  }

  const uploadAvatar = async () => {
    if (!avatarPreview || avatarPreview === settings.avatar) return

    setSaving(prev => ({ ...prev, avatar: true }))
    setErrors(prev => ({ ...prev, avatar: null }))
    setSuccess('')

    try {
      const response = await studentSettings.uploadAvatar(avatarPreview)
      setSettings(response.user)
      setAvatarPreview(response.user.avatar)
      setSuccess('头像上传成功！')
      if (onSettingsChange) {
        onSettingsChange(response.user)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setErrors(prev => ({ ...prev, avatar: error.message || '头像上传失败' }))
    } finally {
      setSaving(prev => ({ ...prev, avatar: false }))
    }
  }

  const saveProfile = async () => {
    setSaving(prev => ({ ...prev, profile: true }))
    setErrors(prev => ({ ...prev, profile: null }))
    setSuccess('')

    try {
      const response = await studentSettings.updateProfile({
        real_name: settings.real_name
      })
      setSettings(response.user)
      setSuccess('个人信息保存成功！')
      if (onSettingsChange) {
        onSettingsChange(response.user)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setErrors(prev => ({ ...prev, profile: error.message || '保存失败' }))
    } finally {
      setSaving(prev => ({ ...prev, profile: false }))
    }
  }

  const saveLearningGoal = async () => {
    setSaving(prev => ({ ...prev, learningGoal: true }))
    setErrors(prev => ({ ...prev, learningGoal: null }))
    setSuccess('')

    try {
      const response = await studentSettings.updateLearningGoal(settings.learning_goal)
      setSettings(response.user)
      setSuccess('学习目标保存成功！')
      if (onSettingsChange) {
        onSettingsChange(response.user)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setErrors(prev => ({ ...prev, learningGoal: error.message || '保存失败' }))
    } finally {
      setSaving(prev => ({ ...prev, learningGoal: false }))
    }
  }

  const deleteLearningGoal = async () => {
    if (!confirm('确定要删除学习目标吗？')) return

    setSaving(prev => ({ ...prev, learningGoal: true }))
    setErrors(prev => ({ ...prev, learningGoal: null }))
    setSuccess('')

    try {
      const response = await studentSettings.updateLearningGoal('')
      setSettings(response.user)
      setSuccess('学习目标已删除！')
      if (onSettingsChange) {
        onSettingsChange(response.user)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setErrors(prev => ({ ...prev, learningGoal: error.message || '删除失败' }))
    } finally {
      setSaving(prev => ({ ...prev, learningGoal: false }))
    }
  }

  const saveAIStyle = async (style) => {
    setSaving(prev => ({ ...prev, aiStyle: true }))
    setErrors(prev => ({ ...prev, aiStyle: null }))
    setSuccess('')

    try {
      const response = await studentSettings.updateAIStyle(style)
      setSettings(response.user)
      setSuccess('AI助手风格设置成功！')
      if (onSettingsChange) {
        onSettingsChange(response.user)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setErrors(prev => ({ ...prev, aiStyle: error.message || '保存失败' }))
    } finally {
      setSaving(prev => ({ ...prev, aiStyle: false }))
    }
  }

  if (loading && !initialSettings) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">加载中...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {success && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            个人信息
          </TabsTrigger>
          <TabsTrigger value="goal">
            <Target className="w-4 h-4 mr-2" />
            学习目标
          </TabsTrigger>
          <TabsTrigger value="ai">
            <Bot className="w-4 h-4 mr-2" />
            AI风格
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>个人信息设置</CardTitle>
              <CardDescription>更新你的头像和姓名信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarPreview || settings.avatar} alt={settings.real_name || settings.username} />
                    <AvatarFallback className="text-2xl">
                      {(settings.real_name || settings.username || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2 cursor-pointer hover:bg-blue-700 transition-colors">
                    <Camera className="h-4 w-4 text-white" />
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">头像</p>
                  <p className="text-sm text-gray-500">点击相机图标上传新头像</p>
                  {avatarPreview && avatarPreview !== settings.avatar && (
                    <Button
                      size="sm"
                      onClick={uploadAvatar}
                      disabled={saving.avatar}
                    >
                      {saving.avatar ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          确认上传
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {errors.avatar && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.avatar}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">用户名</Label>
                  <Input
                    id="username"
                    value={settings.username}
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">用户名不可修改</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    value={settings.email}
                    type="email"
                    disabled
                    className="bg-gray-50"
                  />
                  <p className="text-sm text-gray-500">邮箱不可修改</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="real_name">姓名</Label>
                  <Input
                    id="real_name"
                    value={settings.real_name || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, real_name: e.target.value }))}
                    placeholder="请输入你的姓名"
                    maxLength={100}
                  />
                </div>

                {errors.profile && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.profile}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={saveProfile}
                  disabled={saving.profile}
                >
                  {saving.profile ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存信息
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="goal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>学习目标设置</CardTitle>
              <CardDescription>设定你的学习目标，激励自己不断进步</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Textarea
                  value={settings.learning_goal || ''}
                  onChange={(e) => setSettings(prev => ({ ...prev, learning_goal: e.target.value }))}
                  placeholder="写下你的学习目标，例如：\n• 本学期完成Python基础课程\n• 每天学习2小时\n• 完成10个编程项目"
                  rows={8}
                  maxLength={1000}
                  className="resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {settings.learning_goal?.length || 0}/1000
                  </span>
                  <div className="space-x-2">
                    {settings.learning_goal && (
                      <Button
                        variant="outline"
                        onClick={deleteLearningGoal}
                        disabled={saving.learningGoal}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </Button>
                    )}
                    <Button
                      onClick={saveLearningGoal}
                      disabled={saving.learningGoal}
                    >
                      {saving.learningGoal ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          保存目标
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {errors.learningGoal && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.learningGoal}</AlertDescription>
                </Alert>
              )}

              {settings.learning_goal && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg text-blue-800">当前学习目标</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-blue-900">
                      {settings.learning_goal}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI助手风格设置</CardTitle>
              <CardDescription>选择你喜欢的AI助手回答风格</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup
                value={settings.ai_style}
                onValueChange={(value) => {
                  setSettings(prev => ({ ...prev, ai_style: value }))
                  saveAIStyle(value)
                }}
              >
                {AI_STYLES.map((style) => (
                  <div key={style.id} className="flex items-start space-x-3 space-y-0 border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <RadioGroupItem value={style.id} id={`style-${style.id}`} />
                    <div className="grid gap-1.5">
                      <Label
                        htmlFor={`style-${style.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {style.name}
                        {saving.aiStyle && settings.ai_style === style.id && (
                          <Loader2 className="w-4 h-4 ml-2 inline animate-spin" />
                        )}
                      </Label>
                      <p className="text-sm text-gray-500">
                        {style.description}
                      </p>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {errors.aiStyle && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.aiStyle}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default StudentSettings
