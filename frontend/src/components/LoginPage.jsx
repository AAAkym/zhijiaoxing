/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sparkles, ArrowLeft, User, Mail, Lock, UserCheck, Shield, Users, GraduationCap, Eye, EyeOff, BookOpen, Brain, BarChart3 } from 'lucide-react'
import { auth } from '../services/api'
import zhijiaoXingSymbol from '@/assets/zhijiaoxing-symbol.svg'

const easeOut = [0.22, 1, 0.36, 1]

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [registerForm, setRegisterForm] = useState({
    username: '', email: '', password: '', confirmPassword: '', role: 'student', real_name: ''
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
      setRegisterForm({ username: '', email: '', password: '', confirmPassword: '', role: 'student', real_name: '' })
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
    <div className="min-h-screen bg-[#faf8f5] text-[#2d2a26] flex" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* 左栏 - 品牌展示区 55% */}
      <div
        className="hidden lg:flex w-[55%] relative overflow-hidden flex-col items-center justify-center px-12"
        style={{ background: '#faf8f5' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 50% 45%, rgba(212,168,83,0.12) 0%, rgba(212,168,83,0.04) 40%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 30% 70%, rgba(196,154,74,0.08) 0%, transparent 50%)',
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center text-center max-w-lg"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
        >
          <motion.div
            className="flex items-center justify-center mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6, ease: easeOut }}
          >
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-[#d4a853]/20 border border-[#eadfca]">
              <img src={zhijiaoXingSymbol} alt="智教星标志" className="w-10 h-10" width="40" height="40" />
            </div>
          </motion.div>

          <h1
            className="text-[36px] font-bold tracking-tight text-[#2d2a26] mb-2"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            智教星
          </h1>
          <p className="text-[11px] text-[#9a9590] tracking-[0.3em] uppercase mb-8">
            ZHIJIAOXING
          </p>

          <p
            className="text-lg font-semibold text-[#2d2a26] mb-3"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            让教育更智能
          </p>
          <p className="text-sm text-[#6b6560] leading-relaxed mb-12">
            基于Spark4.0 Ultra大模型的智能教学管理平台
          </p>

          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4a853]/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-[#d4a853]" />
              </div>
              <span className="text-xs text-[#6b6560] font-medium">AI智能备课</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4a853]/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-[#d4a853]" />
              </div>
              <span className="text-xs text-[#6b6560] font-medium">个性化学习</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#d4a853]/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-[#d4a853]" />
              </div>
              <span className="text-xs text-[#6b6560] font-medium">数据驱动</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 右栏 - 登录表单区 45% */}
      <div className="w-full lg:w-[45%] bg-[#ffffff] flex flex-col min-h-screen relative">
        {/* 移动端顶部品牌小条 */}
        <div className="lg:hidden flex items-center gap-3 px-6 py-4 border-b border-[#e8e4df] bg-[#faf8f5]">
          <div className="w-8 h-8 rounded-lg bg-white border border-[#eadfca] flex items-center justify-center">
            <img src={zhijiaoXingSymbol} alt="智教星标志" className="w-5 h-5" width="20" height="20" />
          </div>
          <div>
            <span
              className="text-base font-bold text-[#2d2a26]"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              智教星
            </span>
            <span className="text-[9px] text-[#9a9590] tracking-[0.2em] ml-2">ZHIJIAOXING</span>
          </div>
        </div>

        {/* 返回首页 */}
        <div className="px-8 pt-6 lg:px-12 lg:pt-8">
          <Link
            to="/"
            className="inline-flex items-center text-[#9a9590] hover:text-[#d4a853] transition-colors duration-300 group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="text-sm">返回首页</span>
          </Link>
        </div>

        {/* 表单主体 */}
        <div className="flex-1 flex items-center justify-center px-8 lg:px-12 py-8">
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
          >
            <div className="mb-8">
              <h2
                className="text-[24px] font-bold text-[#2d2a26] mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                欢迎回来
              </h2>
              <p className="text-sm text-[#6b6560]">登录以继续使用智教星——自适应错题诊疗系统</p>
            </div>

            {/* 标签切换 - 胶囊样式 */}
            <div className="flex mb-8 bg-[#faf8f5] rounded-full p-1 border border-[#e8e4df]">
              <button
                onClick={() => { setActiveTab('login'); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'login'
                    ? 'bg-[#d4a853] text-white shadow-md shadow-[#d4a853]/20'
                    : 'text-[#9a9590] hover:text-[#6b6560]'
                }`}
              >
                登录
              </button>
              <button
                onClick={() => { setActiveTab('register'); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'register'
                    ? 'bg-[#d4a853] text-white shadow-md shadow-[#d4a853]/20'
                    : 'text-[#9a9590] hover:text-[#6b6560]'
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
                  className="mb-6 p-4 rounded-[10px] bg-red-50 border border-red-200 text-red-600 text-sm"
                >
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 rounded-[10px] bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm"
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
                  transition={{ duration: 0.3, ease: easeOut }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">用户名</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type="text"
                        placeholder="请输入用户名"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-12 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'username' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码（至少6位）"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                        onFocus={() => setFocusedField('password')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 pr-12 h-12 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'password' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9a9590] hover:text-[#6b6560] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-[#d4a853] hover:bg-[#c49a4a] text-white rounded-[10px] text-base font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#d4a853]/25 disabled:opacity-50"
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
                  transition={{ duration: 0.3, ease: easeOut }}
                  onSubmit={handleRegister}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">真实姓名</label>
                    <div className="relative">
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type="text"
                        placeholder="请输入真实姓名"
                        value={registerForm.real_name}
                        onChange={(e) => setRegisterForm({ ...registerForm, real_name: e.target.value })}
                        onFocus={() => setFocusedField('real_name')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-11 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'real_name' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">用户名</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type="text"
                        placeholder="请输入用户名"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                        onFocus={() => setFocusedField('reg_username')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-11 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'reg_username' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">邮箱</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type="email"
                        placeholder="请输入邮箱地址"
                        value={registerForm.email}
                        onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-11 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'email' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请输入密码（至少6位）"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                        onFocus={() => setFocusedField('reg_password')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 pr-12 h-11 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'reg_password' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9a9590] hover:text-[#6b6560] transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-[#6b6560] font-medium">确认密码</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9a9590]" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="请再次输入密码"
                        value={registerForm.confirmPassword}
                        onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                        onFocus={() => setFocusedField('confirmPassword')}
                        onBlur={() => setFocusedField(null)}
                        className={`pl-12 h-11 bg-white border-[#e8e4df] text-[#2d2a26] placeholder:text-[#9a9590] rounded-[10px] transition-all duration-300 ${
                          focusedField === 'confirmPassword' ? 'border-[#d4a853] shadow-[0_0_0_3px_rgba(212,168,83,0.1)]' : ''
                        }`}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-[#d4a853] hover:bg-[#c49a4a] text-white rounded-[10px] text-base font-medium transition-all duration-300 hover:shadow-lg hover:shadow-[#d4a853]/25 disabled:opacity-50"
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

            {/* 演示账号快速登录区 */}
            <div className="mt-10 pt-8 border-t border-[#e8e4df]">
              <p className="text-xs text-[#9a9590] mb-4 font-medium uppercase tracking-wider">演示账号快速登录</p>
              <div className="grid grid-cols-3 gap-3">
                <DemoAccountCard
                  title="管理员"
                  username="admin"
                  password="admin123"
                  icon={Shield}
                  onQuickLogin={() => quickLogin('admin', 'admin123')}
                />
                <DemoAccountCard
                  title="教师"
                  username="teacher"
                  password="teacher123"
                  icon={Users}
                  onQuickLogin={() => quickLogin('teacher', 'teacher123')}
                />
                <DemoAccountCard
                  title="学生"
                  username="student"
                  password="student123"
                  icon={GraduationCap}
                  onQuickLogin={() => quickLogin('student', 'student123')}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

function DemoAccountCard({ title, username, password, icon: Icon, onQuickLogin }) {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="bg-[#faf8f5] border border-[#e8e4df] rounded-[10px] cursor-pointer transition-all duration-300 hover:border-[#d4a853]/30 hover:shadow-md hover:shadow-[#d4a853]/8 p-4 flex flex-col items-center text-center"
      onClick={onQuickLogin}
    >
      <div className="w-10 h-10 rounded-xl bg-[#d4a853]/10 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-[#d4a853]" />
      </div>
      <h4 className="text-sm font-semibold text-[#2d2a26] mb-1">{title}</h4>
      <p className="text-[10px] text-[#9a9590] leading-relaxed">
        {username} / {password}
      </p>
    </motion.div>
  )
}
