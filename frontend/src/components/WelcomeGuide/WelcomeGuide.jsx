import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Sparkles,
  Users,
  BookOpen,
  BarChart3,
  Shield,
  GraduationCap,
  Brain,
  Orbit,
  Zap,
  Target,
  Rocket
} from 'lucide-react'

// 场景配置
const scenes = [
  {
    id: 1,
    type: 'opening',
    title: '智教星',
    subtitle: 'ZHIJIAOXING',
    description: '2026 · AI教学数字孪生'
  },
  {
    id: 2,
    type: 'concept',
    title: '重新定义',
    subtitle: '教学的可能性',
    description: '基于Spark4.0 Ultra大模型，我们为每位教师创建数字孪生。',
    features: [
      { icon: Brain, label: '教学风格智能分析', desc: 'AI学习您的教学风格' },
      { icon: BarChart3, label: '学情精准预测', desc: '提前预警学习风险' },
      { icon: Orbit, label: '跨班级知识迁移', desc: '经验自动适配复制' }
    ]
  },
  {
    id: 3,
    type: 'features',
    title: '核心能力',
    subtitle: 'CORE CAPABILITIES',
    features: [
      { icon: Zap, label: 'AI智能备课', desc: '10分钟生成完整教案', color: 'from-cyan-500/20 to-blue-500/20', borderColor: 'border-cyan-500/30', iconColor: 'text-cyan-400' },
      { icon: Target, label: '个性化学习', desc: '千人千面的学习路径', color: 'from-purple-500/20 to-pink-500/20', borderColor: 'border-purple-500/30', iconColor: 'text-purple-400' },
      { icon: Rocket, label: '实时互动', desc: '课堂即时反馈系统', color: 'from-emerald-500/20 to-teal-500/20', borderColor: 'border-emerald-500/30', iconColor: 'text-emerald-400' }
    ]
  },
  {
    id: 4,
    type: 'roles',
    title: '选择你的维度',
    subtitle: 'SELECT YOUR ROLE',
    roles: [
      {
        icon: Shield,
        title: '管理员',
        titleEn: 'ADMINISTRATOR',
        desc: '系统管理 · 数据洞察 · 权限控制',
        color: 'from-blue-500/20 to-cyan-500/20',
        borderColor: 'border-blue-500/30',
        hoverBorder: 'group-hover:border-blue-400',
        iconColor: 'text-blue-400',
        glowColor: 'shadow-blue-500/20'
      },
      {
        icon: Users,
        title: '教师',
        titleEn: 'TEACHER',
        desc: '智能备课 · 学情分析 · AI助教',
        color: 'from-purple-500/20 to-pink-500/20',
        borderColor: 'border-purple-500/30',
        hoverBorder: 'group-hover:border-purple-400',
        iconColor: 'text-purple-400',
        glowColor: 'shadow-purple-500/20'
      },
      {
        icon: GraduationCap,
        title: '学生',
        titleEn: 'STUDENT',
        desc: '个性化路径 · 智能练习 · 答疑辅导',
        color: 'from-emerald-500/20 to-teal-500/20',
        borderColor: 'border-emerald-500/30',
        hoverBorder: 'group-hover:border-emerald-400',
        iconColor: 'text-emerald-400',
        glowColor: 'shadow-emerald-500/20'
      }
    ]
  },
  {
    id: 5,
    type: 'launch',
    title: '智教星',
    subtitle: '正在初始化你的教学宇宙...',
    progressDuration: 2500
  }
]

// 动画配置
const transitions = {
  enter: { opacity: 0, y: 40, scale: 0.95 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 1.05 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.3 }
  }
}

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

export default function WelcomeGuide() {
  const [currentScene, setCurrentScene] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [launchProgress, setLaunchProgress] = useState(0)
  const [isLaunching, setIsLaunching] = useState(false)
  const navigate = useNavigate()

  const handleNext = useCallback(() => {
    if (isAnimating || currentScene >= scenes.length - 1) return
    setIsAnimating(true)
    setCurrentScene(prev => prev + 1)
    setTimeout(() => setIsAnimating(false), 800)
  }, [isAnimating, currentScene])

  const handlePrev = useCallback(() => {
    if (isAnimating || currentScene <= 0) return
    setIsAnimating(true)
    setCurrentScene(prev => prev - 1)
    setTimeout(() => setIsAnimating(false), 800)
  }, [isAnimating, currentScene])

  const handleSkip = useCallback(() => {
    navigate('/login')
  }, [navigate])

  const handleRoleSelect = useCallback(() => {
    if (currentScene < scenes.length - 1) {
      handleNext()
    }
  }, [currentScene, handleNext])

  const handleLaunch = useCallback(() => {
    setIsLaunching(true)
    const duration = scenes[4].progressDuration
    const startTime = Date.now()

    const updateProgress = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min((elapsed / duration) * 100, 100)
      setLaunchProgress(progress)

      if (progress < 100) {
        requestAnimationFrame(updateProgress)
      } else {
        setTimeout(() => navigate('/login'), 600)
      }
    }

    requestAnimationFrame(updateProgress)
  }, [navigate])

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        if (currentScene === scenes.length - 1 && !isLaunching) {
          handleLaunch()
        } else {
          handleNext()
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrev()
      } else if (e.key === 'Escape') {
        handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentScene, handleNext, handlePrev, handleSkip, handleLaunch, isLaunching])

  const scene = scenes[currentScene]
  const progress = ((currentScene) / (scenes.length - 1)) * 100

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden relative selection:bg-cyan-500/30">
      {/* 增强背景粒子效果 */}
      <EnhancedParticleBackground />
      
      {/* 动态光晕背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.4, 0.7, 0.4]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-500/3 rounded-full blur-[120px]"
          animate={{
            rotate: 360
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20" />
              <Sparkles className="w-5 h-5 text-cyan-400 relative z-10" />
            </div>
            <span className="text-sm font-light tracking-wider text-white/60">智教星</span>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={handleSkip}
            className="flex items-center gap-2 text-xs text-white/40 hover:text-white/80 transition-colors duration-200 tracking-wider group"
          >
            <SkipForward className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            跳过引导
          </motion.button>
        </div>
      </nav>

      {/* 进度指示器 */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-white/10 z-40">
        <motion.div
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* 主内容区域 */}
      <main className="min-h-screen flex items-center justify-center px-4 relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScene}
            variants={transitions}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-6xl"
          >
            {/* Scene 1: 宇宙开场 */}
            {scene.type === 'opening' && (
              <OpeningScene scene={scene} onNext={handleNext} />
            )}

            {/* Scene 2: AI数字孪生概念 */}
            {scene.type === 'concept' && (
              <ConceptScene scene={scene} />
            )}

            {/* Scene 3: 核心能力展示 */}
            {scene.type === 'features' && (
              <FeaturesScene scene={scene} />
            )}

            {/* Scene 4: 角色选择 */}
            {scene.type === 'roles' && (
              <RolesScene scene={scene} onSelect={handleRoleSelect} />
            )}

            {/* Scene 5: 启动仪式 */}
            {scene.type === 'launch' && (
              <LaunchScene
                scene={scene}
                progress={launchProgress}
                isLaunching={isLaunching}
                onLaunch={handleLaunch}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* 左箭头 */}
          <button
            onClick={handlePrev}
            disabled={currentScene === 0}
            className={`w-12 h-12 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300 ${
              currentScene === 0
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:border-cyan-500/50 hover:bg-cyan-500/10 active:scale-95 hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]'
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          {/* 场景指示点 */}
          <div className="flex items-center gap-3">
            {scenes.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  if (!isAnimating && index !== currentScene) {
                    setIsAnimating(true)
                    setCurrentScene(index)
                    setTimeout(() => setIsAnimating(false), 800)
                  }
                }}
                className="relative"
              >
                <motion.div
                  className={`rounded-full transition-all duration-500 ${
                    index === currentScene
                      ? 'w-8 h-2 bg-gradient-to-r from-cyan-500 to-blue-500'
                      : 'w-2 h-2 bg-white/20 hover:bg-white/40'
                  }`}
                  whileHover={index !== currentScene ? { scale: 1.2 } : {}}
                />
              </button>
            ))}
          </div>

          {/* 右箭头 */}
          <button
            onClick={() => {
              if (currentScene === scenes.length - 1) {
                handleLaunch()
              } else {
                handleNext()
              }
            }}
            className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center hover:border-cyan-500/50 hover:bg-cyan-500/10 active:scale-95 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]"
          >
            {currentScene === scenes.length - 1 ? (
              <Sparkles className="w-5 h-5 text-cyan-400" />
            ) : (
              <ChevronRight className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// Scene 1: 宇宙开场 - 增强版
function OpeningScene({ scene, onNext }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center"
    >
      {/* 增强光环动画 */}
      <motion.div variants={staggerItem} className="relative mb-16">
        <div className="w-40 h-40 relative">
          {/* 外环 */}
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-500/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-cyan-400/40 rounded-full shadow-[0_0_10px_rgba(0,212,255,0.5)]" />
          </motion.div>
          {/* 中环 */}
          <motion.div
            className="absolute inset-4 rounded-full border border-blue-500/15"
            animate={{ rotate: -360 }}
            transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-blue-400/50 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </motion.div>
          {/* 内环 */}
          <motion.div
            className="absolute inset-8 rounded-full border border-white/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/50 rounded-full" />
          </motion.div>
          {/* 中心 */}
          <motion.div 
            className="absolute inset-12 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 backdrop-blur-sm border border-white/20 flex items-center justify-center"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="w-8 h-8 text-cyan-300" />
          </motion.div>
          
          {/* 脉冲效果 */}
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-500/20"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>

      {/* 标题 */}
      <motion.h1
        variants={staggerItem}
        className="text-8xl md:text-9xl font-extralight tracking-[0.3em] mb-6 bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent"
      >
        {scene.title}
      </motion.h1>

      <motion.p
        variants={staggerItem}
        className="text-xl tracking-[0.6em] text-white/40 mb-8 font-light"
      >
        {scene.subtitle}
      </motion.p>

      <motion.p
        variants={staggerItem}
        className="text-sm text-white/30 tracking-wider"
      >
        {scene.description}
      </motion.p>

      {/* 向下提示 */}
      <motion.div
        variants={staggerItem}
        className="mt-20"
        onClick={onNext}
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="cursor-pointer"
        >
          <div className="w-7 h-12 rounded-full border border-white/20 flex items-start justify-center p-2 hover:border-cyan-500/40 transition-colors">
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3], y: [0, 12, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1 h-3 bg-cyan-400/60 rounded-full"
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

// Scene 2: AI数字孪生概念 - 增强版
function ConceptScene({ scene }) {
  return (
    <div className="grid md:grid-cols-5 gap-12 items-center">
      {/* 左侧文字 */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="md:col-span-3"
      >
        <motion.h2
          variants={staggerItem}
          className="text-7xl md:text-8xl font-extralight tracking-wider mb-6 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent"
        >
          {scene.title}
        </motion.h2>
        <motion.p
          variants={staggerItem}
          className="text-3xl md:text-4xl font-light text-cyan-400/60 mb-10"
        >
          {scene.subtitle}
        </motion.p>
        <motion.p
          variants={staggerItem}
          className="text-xl text-white/50 leading-relaxed max-w-lg"
        >
          {scene.description}
        </motion.p>
      </motion.div>

      {/* 右侧功能列表 */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="md:col-span-2 space-y-5"
      >
        {scene.features.map((feature, index) => (
          <motion.div
            key={index}
            variants={staggerItem}
            whileHover={{ x: 12, transition: { duration: 0.3 } }}
            className="group p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]"
          >
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                <feature.icon className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white/90 font-light text-lg mb-2">{feature.label}</h3>
                <p className="text-white/40 text-sm">{feature.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

// Scene 3: 核心能力展示 - 新增
function FeaturesScene({ scene }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="text-center"
    >
      <motion.h2 variants={staggerItem} className="text-6xl md:text-7xl font-extralight tracking-wider mb-4">
        {scene.title}
      </motion.h2>
      <motion.p variants={staggerItem} className="text-sm tracking-[0.5em] text-white/30 mb-16">
        {scene.subtitle}
      </motion.p>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {scene.features.map((feature, index) => (
          <motion.div
            key={index}
            variants={staggerItem}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            className={`group relative p-10 rounded-3xl bg-gradient-to-b ${feature.color} backdrop-blur-sm border ${feature.borderColor} hover:border-cyan-500/40 transition-all duration-500 hover:shadow-[0_20px_60px_rgba(0,212,255,0.15)]`}
          >
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 ${feature.iconColor} group-hover:scale-110 transition-transform duration-300`}>
              <feature.icon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-light text-white/90 mb-3">{feature.label}</h3>
            <p className="text-white/40 leading-relaxed">{feature.desc}</p>

            {/* Hover光效 */}
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-t from-cyan-500/5 to-transparent pointer-events-none" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// Scene 4: 角色选择 - 增强版
function RolesScene({ scene, onSelect }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="text-center"
    >
      <motion.h2 variants={staggerItem} className="text-6xl md:text-7xl font-extralight tracking-wider mb-4">
        {scene.title}
      </motion.h2>
      <motion.p variants={staggerItem} className="text-sm tracking-[0.5em] text-white/30 mb-20">
        {scene.subtitle}
      </motion.p>

      <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        {scene.roles.map((role, index) => (
          <motion.button
            key={index}
            variants={staggerItem}
            whileHover={{ y: -8, transition: { duration: 0.3 } }}
            whileTap={{ scale: 0.97 }}
            onClick={onSelect}
            className={`group relative p-10 rounded-3xl bg-gradient-to-b ${role.color} backdrop-blur-sm border ${role.borderColor} ${role.hoverBorder} transition-all duration-500 text-left hover:shadow-[0_20px_60px_rgba(0,212,255,0.15)]`}
          >
            <div className={`w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 ${role.iconColor} group-hover:scale-110 transition-transform duration-300`}>
              <role.icon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-light text-white/90 mb-2">{role.title}</h3>
            <p className="text-xs tracking-[0.3em] text-white/30 mb-6">{role.titleEn}</p>
            <p className="text-white/40 leading-relaxed">{role.desc}</p>

            {/* Hover光效 */}
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
            
            {/* 底部光条 */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-gradient-to-r from-cyan-500 to-blue-500 group-hover:w-1/2 transition-all duration-500 rounded-full" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// Scene 5: 启动仪式 - 增强版
function LaunchScene({ scene, progress, isLaunching, onLaunch }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center max-w-xl mx-auto"
    >
      <motion.div variants={staggerItem} className="relative mb-16">
        {/* 增强粒子环绕效果 */}
        <div className="w-32 h-32 relative">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute inset-0"
              animate={{ rotate: 360 }}
              transition={{
                duration: 2.5 + i * 0.4,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.15
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-cyan-400/70 rounded-full shadow-[0_0_6px_rgba(0,212,255,0.8)]"
                style={{ transform: `translateX(-50%) translateY(${-16 + i * 1.5}px)` }}
              />
            </motion.div>
          ))}
          
          {/* 中心发光 */}
          <motion.div 
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center border border-cyan-500/30">
              <Sparkles className="w-10 h-10 text-cyan-300" />
            </div>
          </motion.div>
          
          {/* 外圈脉冲 */}
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-500/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>

      <motion.h2 variants={staggerItem} className="text-6xl font-extralight tracking-wider mb-8">
        {scene.title}
      </motion.h2>

      <motion.p variants={staggerItem} className="text-white/40 mb-10 text-lg">
        {isLaunching ? scene.subtitle : '准备进入智教星教学宇宙'}
      </motion.p>

      {/* 增强进度条 */}
      <motion.div variants={staggerItem} className="w-full mb-10">
        <div className="h-[3px] bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500"
            style={{ width: `${isLaunching ? progress : 0}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-xs text-white/30">
            {isLaunching ? `${Math.round(progress)}%` : '0%'}
          </span>
          <span className="text-xs text-white/30">100%</span>
        </div>
      </motion.div>

      {/* 启动按钮 */}
      {!isLaunching && (
        <motion.button
          variants={staggerItem}
          whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(0,212,255,0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onLaunch}
          className="px-16 py-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-light tracking-wider hover:from-cyan-400 hover:to-blue-400 transition-all duration-300 text-lg"
        >
          进入平台
        </motion.button>
      )}

      {isLaunching && progress >= 100 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-white/60 text-sm"
        >
          正在跳转...
        </motion.p>
      )}
    </motion.div>
  )
}

// 增强背景粒子组件
function EnhancedParticleBackground() {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    const newParticles = [...Array(80)].map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 0.5,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 8,
      opacity: Math.random() * 0.6 + 0.1,
      type: Math.random() > 0.7 ? 'glow' : 'normal'
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className={`absolute rounded-full ${particle.type === 'glow' ? 'bg-cyan-400' : 'bg-white'}`}
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
            boxShadow: particle.type === 'glow' ? `0 0 ${particle.size * 3}px rgba(0,212,255,0.5)` : 'none'
          }}
          animate={{
            y: [0, -40, 0],
            x: [0, Math.random() * 20 - 10, 0],
            opacity: [particle.opacity, particle.opacity * 0.2, particle.opacity]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut'
          }}
        />
      ))}
    </div>
  )
}
