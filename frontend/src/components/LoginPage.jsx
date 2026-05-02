import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, ArrowLeft, User, Mail, Lock, UserCheck, Shield, Users, GraduationCap, Eye, EyeOff } from 'lucide-react'
import { auth } from '../services/api'

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

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

    if (!loginForm.username.trim() || !loginForm.password.trim()) {
      setError('用户名和密码不能为空')
      setLoading(false)
      return
    }

    try {
      const response = await auth.login(loginForm)
      localStorage.setItem('currentUser', JSON.stringify(response.user))
      onLogin(response.user)
      const dashboardPath = getDashboardPath(response.user.role)
      navigate(dashboardPath)
    } catch (err) {
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
    setLoginForm(prevForm => ({ ...prevForm, username, password }))
    setTimeout(() => {
      const currentForm = { username, password }
      if (currentForm.username && currentForm.password) {
        handleLogin({ preventDefault: () => {} })
      }
    }, 150)
  }

  function getDashboardPath(role) {
    switch (role) {
      case 'admin': return '/admin'
      case 'teacher': return '/teacher'
      case 'student': return '/student'
      default: return '/'
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative">
      {/* 量子网格背景 */}
      <QuantumGridBackground />
      
      {/* 动态光晕 */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[120px]"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]"
          animate={{ scale: [1.3, 1, 1.3], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
          {/* 左侧：登录/注册表单 */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md mx-auto"
          >
            {/* 返回首页 */}
            <div className="mb-8">
              <Link to="/" className="inline-flex items-center text-white/40 hover:text-white transition-colors duration-300 group">
                <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                <span className="text-sm tracking-wider">返回首页</span>
              </Link>
            </div>

            {/* 品牌标识 */}
            <div className="text-center mb-10">
              <motion.div 
                className="flex items-center justify-center gap-3 mb-6"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-2xl font-light tracking-wider">智教星</span>
                  <p className="text-xs text-white/30 tracking-[0.3em]">ZHIJIAOXING</p>
                </div>
              </motion.div>
              <p className="text-white/40 text-sm">请登录或注册以使用系统功能</p>
            </div>

            {/* 标签切换 */}
            <div className="flex mb-8 bg-white/5 rounded-xl p-1 border border-white/10">
              <button
                onClick={() => { setActiveTab('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-3 rounded-lg text-sm tracking-wider transition-all duration-300 ${
                  activeTab === 'login' 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]' 
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => { setActiveTab('register'); setError(''); setSuccess('') }}
                className={`flex-1 py-3 rounded-lg text-sm tracking-wider transition-all duration-300 ${
                  activeTab === 'register' 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-[0_0_20px_rgba(0,212,255,0.3)]' 
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                注册
              </button>
            </div>

            {/* 消息提示 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm"
                >
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 登录表单 */}
            <AnimatePresence mode="wait">
              {activeTab === 'login' && (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">用户名</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type="text"
                        placeholder="请输入用户名"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'username' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码（至少6位）"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 pr-12 h-14 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'password' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-14 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl text-base tracking-wider transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] disabled:opacity-50"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : '登录'}
                  </Button>
                </motion.form>
              )}

              {/* 注册表单 */}
              {activeTab === 'register' && (
                <motion.form
                  key="register"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">真实姓名</label>
                    <div className="relative">
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type="text"
                        placeholder="请输入真实姓名"
                        value={registerForm.real_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, real_name: e.target.value })}
                        onFocus={() => setFocusedField('real_name')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'real_name' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">用户名</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type="text"
                        placeholder="请输入用户名"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                        onFocus={() => setFocusedField('reg_username')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'reg_username' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">邮箱</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type="email"
                        placeholder="请输入邮箱地址"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'email' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码（至少6位）"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        onFocus={() => setFocusedField('reg_password')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'reg_password' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-white/60 tracking-wider">确认密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请再次输入密码"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 rounded-xl transition-all duration-300 ${
                          focusedField === 'confirmPassword' ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(0,212,255,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>
                  
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="w-full h-12 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white rounded-xl text-base tracking-wider transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] disabled:opacity-50"
                  >
                    {loading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : '注册'}
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>

          {/* 右侧：演示账号 */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-light tracking-wider mb-2">演示账号</h2>
              <p className="text-white/40 text-sm">点击下方按钮可以快速体验不同角色的功能</p>
            </div>
            
            <div className="space-y-4">
              <DemoAccountCard
                title="系统管理员"
                username="admin"
                password="admin123"
                description="用户管理、系统配置、数据分析"
                icon={Shield}
                color="cyan"
                onQuickLogin={() => quickLogin('admin', 'admin123')}
              />
              <DemoAccountCard
                title="示例教师"
                username="teacher"
                password="teacher123"
                description="课程管理、内容生成、学情分析"
                icon={Users}
                color="purple"
                onQuickLogin={() => quickLogin('teacher', 'teacher123')}
              />
              <DemoAccountCard
                title="示例学生"
                username="student"
                password="student123"
                description="在线学习、练习评测、AI问答"
                icon={GraduationCap}
                color="emerald"
                onQuickLogin={() => quickLogin('student', 'student123')}
              />
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="font-light text-white/80 mb-4 tracking-wider">功能说明</h3>
              <ul className="text-sm text-white/40 space-y-3">
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400/60" />
                  <span><strong className="text-white/60">管理员</strong>：用户管理、系统配置、数据分析</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-400/60" />
                  <span><strong className="text-white/60">教师</strong>：课程管理、内容生成、学情分析</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/60" />
                  <span><strong className="text-white/60">学生</strong>：在线学习、练习评测、AI问答</span>
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function DemoAccountCard({ title, username, password, description, icon: Icon, color, onQuickLogin }) {
  const colorClasses = {
    cyan: 'border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/40',
    purple: 'border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 hover:border-purple-500/40',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40'
  }

  const iconColors = {
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    emerald: 'text-emerald-400'
  }

  return (
    <motion.div 
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`${colorClasses[color]} border rounded-2xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,255,0.1)]`}
      onClick={onQuickLogin}
    >
      <div className="p-5">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${iconColors[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="font-light text-white/90 text-lg">{title}</h3>
            <div className="text-sm text-white/40 space-x-4 mt-1">
              <span>用户名：{username}</span>
              <span>密码：{password}</span>
            </div>
            <p className="text-xs text-white/30 mt-2">{description}</p>
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={(e) => { e.stopPropagation(); onQuickLogin(); }}
            className="border-white/20 text-white/60 hover:text-white hover:bg-white/5 hover:border-cyan-500/40"
          >
            快速登录
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// 量子网格背景
function QuantumGridBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let animationId
    let time = 0

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const drawGrid = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      const gridSize = 60
      const perspective = 0.8
      
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)'
      ctx.lineWidth = 0.5

      // 垂直线
      for (let x = 0; x <= canvas.width; x += gridSize) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, canvas.height)
        ctx.stroke()
      }

      // 水平线（带透视效果）
      for (let y = 0; y <= canvas.height; y += gridSize) {
        const offset = Math.sin(time * 0.001 + y * 0.01) * 20
        ctx.beginPath()
        ctx.moveTo(0, y + offset)
        ctx.lineTo(canvas.width, y + offset)
        ctx.stroke()
      }

      // 脉冲点
      const pulseX = Math.floor(canvas.width / 2 / gridSize) * gridSize
      const pulseY = Math.floor(canvas.height / 2 / gridSize) * gridSize
      
      for (let x = pulseX - gridSize * 3; x <= pulseX + gridSize * 3; x += gridSize) {
        for (let y = pulseY - gridSize * 3; y <= pulseY + gridSize * 3; y += gridSize) {
          const distance = Math.sqrt((x - pulseX) ** 2 + (y - pulseY) ** 2)
          const maxDistance = gridSize * 3
          const intensity = Math.max(0, 1 - distance / maxDistance)
          const pulse = Math.sin(time * 0.003) * 0.5 + 0.5
          
          if (intensity > 0) {
            ctx.fillStyle = `rgba(0, 212, 255, ${intensity * pulse * 0.3})`
            ctx.beginPath()
            ctx.arc(x, y, 2 * intensity * pulse, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      time += 16
      animationId = requestAnimationFrame(drawGrid)
    }

    drawGrid()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />
}
