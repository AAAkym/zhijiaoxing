import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sparkles, ArrowLeft, User, Mail, Lock, UserCheck } from 'lucide-react'
import { auth } from '../services/api'

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 登录表单状态
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  })

  // 注册表单状态
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'student',
    real_name: ''
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 前端验证：检查用户名和密码是否为空
    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setError('用户名和密码不能为空')
      setLoading(false)
      return
    }

    try {
      const response = await auth.login(loginForm)
      
      // 保存用户信息到localStorage
      localStorage.setItem('currentUser', JSON.stringify(response.user))
      
      onLogin(response.user)
      
      // 根据用户角色跳转
      const dashboardPath = getDashboardPath(response.user.role)
      navigate(dashboardPath)
    } catch (err) {
      // 本地化错误消息
      if (err.message.includes('Username and password are required')) {
        setError('用户名和密码不能为空')
      } else if (err.message.includes('Invalid username or password')) {
        setError('用户名或密码错误')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    // 验证密码
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('密码确认不匹配')
      setLoading(false)
      return
    }

    try {
      await auth.register({
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
        real_name: registerForm.real_name
      })
      
      setSuccess('注册成功！请登录。')
      setActiveTab('login')
      setRegisterForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'student',
        real_name: ''
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const quickLogin = async (username, password) => {
    setActiveTab('login')
    
    // 使用函数式更新确保状态同步
    setLoginForm(prevForm => ({
      ...prevForm,
      username,
      password
    }))
    
    // 等待状态更新完成后再提交登录
    setTimeout(() => {
      // 再次验证表单数据
      const currentForm = { username, password }
      if (currentForm.username && currentForm.password) {
        handleLogin({ preventDefault: () => {} })
      }
    }, 150)
  }

  function getDashboardPath(role) {
    switch (role) {
      case 'admin':
        return '/admin'
      case 'teacher':
        return '/teacher'
      case 'student':
        return '/student'
      default:
        return '/'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* 左侧：登录/注册表单 */}
        <div className="w-full max-w-md mx-auto">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Link>
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">智教星</span>
            </div>
            <p className="text-gray-600">请登录或注册以使用系统功能</p>
          </div>

          <Card className="shadow-lg">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">登录</TabsTrigger>
                  <TabsTrigger value="register">注册</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert className="mb-4 border-red-200 bg-red-50">
                  <AlertDescription className="text-red-800">{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="mb-4 border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">{success}</AlertDescription>
                </Alert>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">用户名</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="请输入用户名"
                          value={loginForm.username}
                          onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">密码</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="请输入密码（至少6位）"
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      disabled={loading}
                    >
                      {loading ? '登录中...' : '登录'}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">真实姓名</label>
                      <div className="relative">
                        <UserCheck className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="请输入真实姓名"
                          value={registerForm.real_name}
                          onChange={(e) => setRegisterForm({ ...registerForm, real_name: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">用户名</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="请输入用户名"
                          value={registerForm.username}
                          onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">邮箱</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="email"
                          placeholder="请输入邮箱地址"
                          value={registerForm.email}
                          onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">角色</label>
                      <Select 
                        value={registerForm.role} 
                        onValueChange={(value) => setRegisterForm({ ...registerForm, role: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">学生</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">密码</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="请输入密码（至少6位）"
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">确认密码</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="请再次输入密码"
                          value={registerForm.confirmPassword}
                          onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                          className="pl-10"
                          required
                          minLength={6}
                        />
                      </div>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                      disabled={loading}
                    >
                      {loading ? '注册中...' : '注册'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：演示账号 */}
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">演示账号</h2>
            <p className="text-gray-600">点击下方按钮可以快速体验不同角色的功能</p>
          </div>
          
          <div className="space-y-4">
            <DemoAccountCard
              title="系统管理员"
              username="admin"
              password="admin123"
              description="用户管理、系统配置、数据分析"
              color="red"
              icon="👨‍💼"
              onQuickLogin={() => quickLogin('admin', 'admin123')}
            />
            <DemoAccountCard
              title="示例教师"
              username="teacher"
              password="teacher123"
              description="课程管理、内容生成、学情分析"
              color="blue"
              icon="👩‍🏫"
              onQuickLogin={() => quickLogin('teacher', 'teacher123')}
            />
            <DemoAccountCard
              title="示例学生"
              username="student"
              password="student123"
              description="在线学习、练习评测、AI问答"
              color="green"
              icon="👨‍🎓"
              onQuickLogin={() => quickLogin('student', 'student123')}
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">功能说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>管理员</strong>：用户管理、系统配置、数据分析</li>
              <li>• <strong>教师</strong>：课程管理、内容生成、学情分析</li>
              <li>• <strong>学生</strong>：在线学习、练习评测、AI问答</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function DemoAccountCard({ title, username, password, description, color, icon, onQuickLogin }) {
  const colorClasses = {
    red: 'border-red-200 bg-red-50 hover:bg-red-100',
    blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    green: 'border-green-200 bg-green-50 hover:bg-green-100'
  }

  return (
    <Card className={`${colorClasses[color]} border-2 cursor-pointer transition-all hover:shadow-md`} onClick={onQuickLogin}>
      <CardContent className="p-4">
        <div className="flex items-center space-x-4">
          <div className="text-3xl">{icon}</div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <div className="text-sm text-gray-600 space-x-4">
              <span><strong>用户名：</strong>{username}</span>
              <span><strong>密码：</strong>{password}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onQuickLogin(); }}>
            快速登录
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

