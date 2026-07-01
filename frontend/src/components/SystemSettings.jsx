import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Database, 
  Shield, 
  Bell, 
  Palette,
  Server,
  Mail,
  Key,
  Globe,
  Save
} from 'lucide-react'
import { admin } from '../services/api'

export default function SystemSettings() {
  const [settings, setSettings] = useState({
    // 基本设置
    siteName: '智教星',
    siteDescription: '智教星 - 智能教学系统',
    adminEmail: 'admin@zhijiaoxing.com',
    timezone: 'Asia/Shanghai',
    language: 'zh-CN',
    
    // 功能设置
    allowRegistration: true,
    requireEmailVerification: false,
    enableAIAssistant: true,
    enableNotifications: true,
    maxFileSize: '10',
    sessionTimeout: '30',
    
    // AI设置
    sparkApiKey: '',
    sparkApiUrl: 'https://spark-api.xf-yun.com/v1.1/chat',
    aiResponseTimeout: '30',
    maxAIRequests: '100',
    
    // 邮件设置
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpEncryption: 'tls',
    
    // 安全设置
    passwordMinLength: '6',
    enableTwoFactor: false,
    loginAttempts: '5',
    lockoutDuration: '15',
    
    // 备份设置
    autoBackup: true,
    backupFrequency: 'daily',
    backupRetention: '30'
  })
  
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [apiUnsupported, setApiUnsupported] = useState(false)
  const [aiModelStatus, setAiModelStatus] = useState(null)
  const [aiTestResult, setAiTestResult] = useState(null)
  const [emailTestResult, setEmailTestResult] = useState(null)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const response = await admin.getSystemSettings()
      setSettings({ ...settings, ...response.settings })
      setApiUnsupported(false)
    } catch (error) {
      console.error('加载系统设置失败:', error)
      setApiUnsupported(true)
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const response = await admin.updateSystemSettings(settings)
      setSettings(prev => ({ ...prev, ...response.settings }))
      if (response.model_message) {
        setAiModelStatus(response.model_message)
      }
      alert('设置保存成功！')
    } catch (error) {
      console.error('保存设置失败:', error)
      alert('设置保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const testEmailSettings = async () => {
    setEmailTestResult(null)
    try {
      const response = await admin.testEmailSettings(settings)
      setEmailTestResult({ success: true, message: response.message || '邮件测试发送成功！' })
    } catch (error) {
      console.error('邮件测试失败:', error)
      setEmailTestResult({ success: false, message: error.message || '邮件测试失败，请检查 SMTP 配置' })
    }
  }

  const testAIConnection = async () => {
    setAiTestResult(null)
    try {
      const response = await admin.testAIConnection(settings)
      setAiTestResult({ 
        success: true, 
        model: response.model, 
        message: response.message || 'AI连接测试成功！',
        response: response.response,
      })
    } catch (error) {
      console.error('AI连接测试失败:', error)
      setAiTestResult({ success: false, message: error.message || 'AI连接测试失败，请检查 AI 配置' })
    }
  }

  const createBackup = async () => {
    try {
      const response = await admin.createBackup()
      alert(`备份创建成功！文件: ${response.backup_file || ''}`)
    } catch (error) {
      console.error('创建备份失败:', error)
      alert('备份创建失败: ' + (error.message || '请稍后重试'))
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
          <p className="text-gray-600">配置系统参数和功能选项</p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          {saving ? '保存中...' : '保存设置'}
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">基本设置</TabsTrigger>
          <TabsTrigger value="features">功能设置</TabsTrigger>
          <TabsTrigger value="ai">AI设置</TabsTrigger>
          <TabsTrigger value="email">邮件设置</TabsTrigger>
          <TabsTrigger value="security">安全设置</TabsTrigger>
          <TabsTrigger value="backup">备份设置</TabsTrigger>
        </TabsList>

        {/* 基本设置 */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                基本设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="siteName">网站名称</Label>
                  <Input
                    id="siteName"
                    value={settings.siteName}
                    onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="adminEmail">管理员邮箱</Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={settings.adminEmail}
                    onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="siteDescription">网站描述</Label>
                <Textarea
                  id="siteDescription"
                  value={settings.siteDescription}
                  onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">时区</Label>
                  <Select value={settings.timezone} onValueChange={(value) => setSettings({ ...settings, timezone: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">默认语言</Label>
                  <Select value={settings.language} onValueChange={(value) => setSettings({ ...settings, language: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh-CN">简体中文</SelectItem>
                      <SelectItem value="en-US">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 功能设置 */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="h-5 w-5 mr-2" />
                功能设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="allowRegistration">允许用户注册</Label>
                  <p className="text-sm text-gray-500">是否允许新用户自主注册账号</p>
                </div>
                <Switch
                  id="allowRegistration"
                  checked={settings.allowRegistration}
                  onCheckedChange={(checked) => setSettings({ ...settings, allowRegistration: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requireEmailVerification">邮箱验证</Label>
                  <p className="text-sm text-gray-500">注册时是否需要邮箱验证</p>
                </div>
                <Switch
                  id="requireEmailVerification"
                  checked={settings.requireEmailVerification}
                  onCheckedChange={(checked) => setSettings({ ...settings, requireEmailVerification: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableAIAssistant">AI助手功能</Label>
                  <p className="text-sm text-gray-500">是否启用AI学习助手</p>
                </div>
                <Switch
                  id="enableAIAssistant"
                  checked={settings.enableAIAssistant}
                  onCheckedChange={(checked) => setSettings({ ...settings, enableAIAssistant: checked })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableNotifications">系统通知</Label>
                  <p className="text-sm text-gray-500">是否启用系统通知功能</p>
                </div>
                <Switch
                  id="enableNotifications"
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxFileSize">最大文件大小 (MB)</Label>
                  <Input
                    id="maxFileSize"
                    type="number"
                    value={settings.maxFileSize}
                    onChange={(e) => setSettings({ ...settings, maxFileSize: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="sessionTimeout">会话超时 (分钟)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={settings.sessionTimeout}
                    onChange={(e) => setSettings({ ...settings, sessionTimeout: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI设置 */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2" />
                AI设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="sparkApiKey">Spark API Key</Label>
                <Input
                  id="sparkApiKey"
                  type="password"
                  value={settings.sparkApiKey}
                  onChange={(e) => setSettings({ ...settings, sparkApiKey: e.target.value })}
                  placeholder="请输入Spark4.0 Ultra API Key"
                />
              </div>
              
              <div>
                <Label htmlFor="sparkApiUrl">Spark API URL</Label>
                <Input
                  id="sparkApiUrl"
                  value={settings.sparkApiUrl}
                  onChange={(e) => setSettings({ ...settings, sparkApiUrl: e.target.value })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="aiResponseTimeout">AI响应超时 (秒)</Label>
                  <Input
                    id="aiResponseTimeout"
                    type="number"
                    value={settings.aiResponseTimeout}
                    onChange={(e) => setSettings({ ...settings, aiResponseTimeout: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxAIRequests">每日最大请求数</Label>
                  <Input
                    id="maxAIRequests"
                    type="number"
                    value={settings.maxAIRequests}
                    onChange={(e) => setSettings({ ...settings, maxAIRequests: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Button onClick={testAIConnection} variant="outline">
                    测试AI连接
                  </Button>
                  {settings.sparkModel && (
                    <span className={`text-sm px-3 py-1 rounded-full ${
                      settings.sparkModel === '4.0Ultra'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      当前模型: {settings.sparkModel === '4.0Ultra' ? '4.0 Ultra' : 'Lite'}
                    </span>
                  )}
                </div>
                {aiModelStatus && (
                  <p className={`text-sm ${aiModelStatus.includes('回退') ? 'text-amber-600' : 'text-green-600'}`}>
                    {aiModelStatus}
                  </p>
                )}
                {aiTestResult && (
                  <div className={`p-3 rounded-lg text-sm ${
                    aiTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    <p className="font-medium">{aiTestResult.message}</p>
                    {aiTestResult.response && (
                      <p className="mt-1 text-xs opacity-75">AI回复: {aiTestResult.response}</p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 邮件设置 */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                邮件设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtpHost">SMTP服务器</Label>
                  <Input
                    id="smtpHost"
                    value={settings.smtpHost}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">SMTP端口</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={settings.smtpPort}
                    onChange={(e) => setSettings({ ...settings, smtpPort: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtpUser">SMTP用户名</Label>
                  <Input
                    id="smtpUser"
                    value={settings.smtpUser}
                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPassword">SMTP密码</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    value={settings.smtpPassword}
                    onChange={(e) => setSettings({ ...settings, smtpPassword: e.target.value })}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="smtpEncryption">加密方式</Label>
                <Select value={settings.smtpEncryption} onValueChange={(value) => setSettings({ ...settings, smtpEncryption: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3">
                <Button onClick={testEmailSettings} variant="outline">
                  测试邮件发送
                </Button>
                {emailTestResult && (
                  <p className={`text-sm ${emailTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {emailTestResult.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 安全设置 */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                安全设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="passwordMinLength">密码最小长度</Label>
                <Input
                  id="passwordMinLength"
                  type="number"
                  value={settings.passwordMinLength}
                  onChange={(e) => setSettings({ ...settings, passwordMinLength: e.target.value })}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableTwoFactor">双因素认证</Label>
                  <p className="text-sm text-gray-500">是否启用双因素认证</p>
                </div>
                <Switch
                  id="enableTwoFactor"
                  checked={settings.enableTwoFactor}
                  onCheckedChange={(checked) => setSettings({ ...settings, enableTwoFactor: checked })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loginAttempts">最大登录尝试次数</Label>
                  <Input
                    id="loginAttempts"
                    type="number"
                    value={settings.loginAttempts}
                    onChange={(e) => setSettings({ ...settings, loginAttempts: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="lockoutDuration">锁定时长 (分钟)</Label>
                  <Input
                    id="lockoutDuration"
                    type="number"
                    value={settings.lockoutDuration}
                    onChange={(e) => setSettings({ ...settings, lockoutDuration: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 备份设置 */}
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                备份设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoBackup">自动备份</Label>
                  <p className="text-sm text-gray-500">是否启用自动备份功能</p>
                </div>
                <Switch
                  id="autoBackup"
                  checked={settings.autoBackup}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoBackup: checked })}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="backupFrequency">备份频率</Label>
                  <Select value={settings.backupFrequency} onValueChange={(value) => setSettings({ ...settings, backupFrequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">每日</SelectItem>
                      <SelectItem value="weekly">每周</SelectItem>
                      <SelectItem value="monthly">每月</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="backupRetention">备份保留天数</Label>
                  <Input
                    id="backupRetention"
                    type="number"
                    value={settings.backupRetention}
                    onChange={(e) => setSettings({ ...settings, backupRetention: e.target.value })}
                  />
                </div>
              </div>
              
              <Button onClick={createBackup} variant="outline">
                立即创建备份
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

