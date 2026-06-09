/* eslint-disable no-unused-vars */
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

const colors = {
  bg: '#faf8f5',
  card: '#ffffff',
  accent: '#d4a853',
  accentDeep: '#c49a4a',
  auxiliary: '#2a9d8f',
  warm: '#c45a3e',
  textPrimary: '#2d2a26',
  textSecondary: '#6b6560',
  textWeak: '#9a9590',
  divider: '#e8e4df',
}

const transitions = {
  enter: { opacity: 0, y: 40, scale: 0.95 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -40, scale: 1.05 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 }
  }
}

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}

const scenes = [
  {
    id: 1,
    type: 'opening',
    title: '智教星',
    subtitle: 'ZHIJIAOXING',
    description: '2026 · AI教学数字孪生',
    accent: colors.accent
  },
  {
    id: 2,
    type: 'concept',
    title: '重新定义',
    subtitle: '教学的可能性',
    description: '基于Spark4.0 Ultra大模型，我们为每位教师创建数字孪生。',
    features: [
      { icon: Brain, label: '教学风格智能分析', desc: 'AI学习您的教学风格', accent: colors.accent },
      { icon: BarChart3, label: '学情精准预测', desc: '提前预警学习风险', accent: colors.auxiliary },
      { icon: Orbit, label: '跨班级知识迁移', desc: '经验自动适配复制', accent: colors.warm }
    ]
  },
  {
    id: 3,
    type: 'features',
    title: '核心能力',
    subtitle: 'CORE CAPABILITIES',
    features: [
      { icon: Zap, label: 'AI智能备课', desc: '10分钟生成完整教案', accent: colors.accent },
      { icon: Target, label: '个性化学习', desc: '千人千面的学习路径', accent: colors.auxiliary },
      { icon: Rocket, label: '实时互动', desc: '课堂即时反馈系统', accent: colors.warm }
    ]
  },
  {
    id: 4,
    type: 'roles',
    title: '选择你的角色',
    subtitle: 'SELECT YOUR ROLE',
    roles: [
      {
        icon: Shield,
        title: '管理员',
        titleEn: 'ADMINISTRATOR',
        desc: '系统管理 · 数据洞察 · 权限控制',
        accent: colors.accent,
      },
      {
        icon: Users,
        title: '教师',
        titleEn: 'TEACHER',
        desc: '智能备课 · 学情分析 · AI助教',
        accent: colors.auxiliary,
      },
      {
        icon: GraduationCap,
        title: '学生',
        titleEn: 'STUDENT',
        desc: '个性化路径 · 智能练习 · 答疑辅导',
        accent: colors.warm,
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
    <div
      className="min-h-screen overflow-hidden relative selection:bg-[#d4a853]/20"
      style={{
        backgroundColor: colors.bg,
        color: colors.textPrimary,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,168,83,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="fixed top-0 left-0 right-0 h-[3px] z-40" style={{ backgroundColor: colors.divider }}>
        <motion.div
          className="h-full"
          style={{ backgroundColor: colors.accent }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3"
          >
            <div
              className="w-10 h-10 flex items-center justify-center"
              style={{
                backgroundColor: `${colors.accent}12`,
                borderRadius: '10px',
                border: `1px solid ${colors.accent}25`,
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: colors.accent }} />
            </div>
            <span className="text-sm font-medium tracking-wider" style={{ color: colors.textSecondary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>智教星</span>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            onClick={handleSkip}
            className="flex items-center gap-2 text-xs tracking-wider group transition-colors duration-300"
            style={{ color: colors.textWeak }}
            onMouseEnter={(e) => e.target.style.color = colors.textSecondary}
            onMouseLeave={(e) => e.target.style.color = colors.textWeak}
          >
            <SkipForward className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
            跳过引导
          </motion.button>
        </div>
      </nav>

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
            {scene.type === 'opening' && (
              <OpeningScene scene={scene} onNext={handleNext} />
            )}
            {scene.type === 'concept' && (
              <ConceptScene scene={scene} />
            )}
            {scene.type === 'features' && (
              <FeaturesScene scene={scene} />
            )}
            {scene.type === 'roles' && (
              <RolesScene scene={scene} onSelect={handleRoleSelect} />
            )}
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

      <div className="fixed bottom-0 left-0 right-0 z-50 px-6 py-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentScene === 0}
            className="w-11 h-11 flex items-center justify-center transition-all duration-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              borderRadius: '50%',
              border: `1.5px solid ${currentScene === 0 ? colors.divider : colors.accent}`,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              if (currentScene !== 0) {
                e.currentTarget.style.backgroundColor = `${colors.accent}10`
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <ChevronLeft className="w-4 h-4" style={{ color: currentScene === 0 ? colors.textWeak : colors.accent }} />
          </button>

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
                  className="transition-all duration-500"
                  style={{
                    borderRadius: '50%',
                    width: index === currentScene ? '2rem' : '0.5rem',
                    height: '0.5rem',
                    backgroundColor: index === currentScene ? colors.accent : colors.divider,
                  }}
                  whileHover={index !== currentScene ? { scale: 1.3 } : {}}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (currentScene === scenes.length - 1) {
                handleLaunch()
              } else {
                handleNext()
              }
            }}
            className="w-11 h-11 flex items-center justify-center transition-all duration-300 active:scale-95"
            style={{
              borderRadius: '50%',
              border: `1.5px solid ${colors.accent}`,
              backgroundColor: 'transparent',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = `${colors.accent}10`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            {currentScene === scenes.length - 1 ? (
              <Sparkles className="w-4 h-4" style={{ color: colors.accent }} />
            ) : (
              <ChevronRight className="w-4 h-4" style={{ color: colors.accent }} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function OpeningScene({ scene, onNext }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center relative"
    >
      <motion.div variants={staggerItem} className="relative mb-10">
        <div className="w-28 h-28 flex items-center justify-center relative">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${colors.accent}20` }}
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: `${colors.accent}50` }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-4 rounded-full"
            style={{ border: `1px solid ${colors.accent}15` }}
            animate={{ rotate: -360 }}
            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: `${colors.auxiliary}40` }}
            />
          </motion.div>
          <div
            className="w-16 h-16 flex items-center justify-center relative z-10"
            style={{
              backgroundColor: `${colors.accent}12`,
              borderRadius: '16px',
              border: `1px solid ${colors.accent}25`,
            }}
          >
            <Sparkles className="w-8 h-8" style={{ color: colors.accent }} />
          </div>
        </div>
      </motion.div>

      <motion.h1
        variants={staggerItem}
        className="mb-4"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: '64px',
          fontWeight: 700,
          color: colors.textPrimary,
          lineHeight: 1.1,
        }}
      >
        {scene.title}
      </motion.h1>

      <motion.p
        variants={staggerItem}
        className="text-lg tracking-[0.5em] mb-6 font-light"
        style={{ color: colors.textWeak, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {scene.subtitle}
      </motion.p>

      <motion.div
        variants={staggerItem}
        className="mb-10"
      >
        <span
          className="inline-block px-5 py-2 text-xs tracking-[0.2em] font-medium"
          style={{
            backgroundColor: `${colors.accent}12`,
            color: colors.accent,
            borderRadius: '999px',
            border: `1px solid ${colors.accent}25`,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          {scene.description}
        </span>
      </motion.div>

      <motion.div variants={staggerItem}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onNext}
          className="px-10 py-3.5 font-semibold tracking-wider text-sm transition-all duration-300"
          style={{
            backgroundColor: colors.accent,
            color: '#ffffff',
            borderRadius: '10px',
            border: 'none',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: `0 4px 20px ${colors.accent}30`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.accentDeep
            e.currentTarget.style.boxShadow = `0 6px 28px ${colors.accent}40`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent
            e.currentTarget.style.boxShadow = `0 4px 20px ${colors.accent}30`
          }}
        >
          开始探索
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

function ConceptScene({ scene }) {
  return (
    <div className="grid md:grid-cols-5 gap-8 md:gap-12 items-center">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="md:col-span-3"
      >
        <motion.h2
          variants={staggerItem}
          className="text-5xl md:text-7xl font-light tracking-tight mb-4"
          style={{ color: colors.textPrimary, lineHeight: 1.2, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {scene.title}
        </motion.h2>
        <motion.p
          variants={staggerItem}
          className="text-2xl md:text-3xl font-semibold mb-8"
          style={{ color: colors.accent, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {scene.subtitle}
        </motion.p>
        <motion.p
          variants={staggerItem}
          className="text-lg leading-[1.8] max-w-lg"
          style={{ color: colors.textSecondary }}
        >
          {scene.description}
        </motion.p>
      </motion.div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="md:col-span-2 space-y-4"
      >
        {scene.features.map((feature, index) => (
          <motion.div
            key={index}
            variants={staggerItem}
            whileHover={{ y: -4, transition: { duration: 0.3 } }}
            className="group p-5 transition-all duration-300"
            style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              border: `1px solid ${colors.divider}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${feature.accent}40`
              e.currentTarget.style.boxShadow = `0 8px 24px ${feature.accent}12`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.divider
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                style={{
                  backgroundColor: `${feature.accent}10`,
                  borderRadius: '10px',
                }}
              >
                <feature.icon className="w-5 h-5" style={{ color: feature.accent }} />
              </div>
              <div>
                <h3 className="font-semibold text-base mb-1" style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{feature.label}</h3>
                <p className="text-sm" style={{ color: colors.textSecondary }}>{feature.desc}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

function FeaturesScene({ scene }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="text-center"
    >
      <motion.h2
        variants={staggerItem}
        className="text-5xl md:text-6xl font-bold tracking-tight mb-3"
        style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {scene.title}
      </motion.h2>
      <motion.p
        variants={staggerItem}
        className="text-sm tracking-[0.4em] mb-12 font-medium"
        style={{ color: colors.textWeak, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {scene.subtitle}
      </motion.p>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {scene.features.map((feature, index) => (
          <motion.div
            key={index}
            variants={staggerItem}
            whileHover={{ y: -6, transition: { duration: 0.3 } }}
            className="group relative p-8 transition-all duration-300"
            style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              border: `1px solid ${colors.divider}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${feature.accent}40`
              e.currentTarget.style.boxShadow = `0 8px 24px ${feature.accent}12`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.divider
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div
              className="w-14 h-14 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: `${feature.accent}10`,
                borderRadius: '12px',
              }}
            >
              <feature.icon className="w-7 h-7" style={{ color: feature.accent }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{feature.label}</h3>
            <p className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

function RolesScene({ scene, onSelect }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="text-center"
    >
      <motion.h2
        variants={staggerItem}
        className="text-5xl md:text-6xl font-bold tracking-tight mb-3"
        style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {scene.title}
      </motion.h2>
      <motion.p
        variants={staggerItem}
        className="text-sm tracking-[0.4em] mb-14 font-medium"
        style={{ color: colors.textWeak, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        {scene.subtitle}
      </motion.p>

      <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {scene.roles.map((role, index) => (
          <motion.button
            key={index}
            variants={staggerItem}
            whileHover={{ y: -6, transition: { duration: 0.3 } }}
            whileTap={{ scale: 0.97 }}
            onClick={onSelect}
            className="group relative p-8 transition-all duration-300 text-left"
            style={{
              backgroundColor: colors.card,
              borderRadius: '16px',
              border: `1px solid ${colors.divider}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = `${role.accent}40`
              e.currentTarget.style.boxShadow = `0 8px 24px ${role.accent}12`
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = colors.divider
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div
              className="w-14 h-14 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: `${role.accent}10`,
                borderRadius: '12px',
              }}
            >
              <role.icon className="w-7 h-7" style={{ color: role.accent }} />
            </div>
            <h3 className="text-xl font-semibold mb-1" style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{role.title}</h3>
            <p className="text-xs tracking-[0.3em] mb-4 font-medium" style={{ color: colors.textWeak }}>{role.titleEn}</p>
            <p className="text-sm leading-relaxed" style={{ color: colors.textSecondary }}>{role.desc}</p>
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

function LaunchScene({ scene, progress, isLaunching, onLaunch }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center text-center max-w-xl mx-auto"
    >
      <motion.div variants={staggerItem} className="relative mb-10">
        <div className="w-24 h-24 flex items-center justify-center relative">
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ border: `1.5px solid ${colors.accent}20` }}
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
              style={{ backgroundColor: `${colors.accent}50` }}
            />
          </motion.div>
          <motion.div
            className="absolute inset-3 rounded-full"
            style={{ border: `1px solid ${colors.accent}12` }}
            animate={{ rotate: -360 }}
            transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: `${colors.auxiliary}40` }}
            />
          </motion.div>
          <div
            className="w-16 h-16 flex items-center justify-center relative z-10"
            style={{
              backgroundColor: `${colors.accent}12`,
              borderRadius: '16px',
              border: `1px solid ${colors.accent}25`,
            }}
          >
            <Sparkles className="w-8 h-8" style={{ color: colors.accent }} />
          </div>
        </div>
      </motion.div>

      <motion.h2
        variants={staggerItem}
        className="text-5xl font-bold tracking-tight mb-4"
        style={{ color: colors.textPrimary, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        准备开始
      </motion.h2>

      <motion.p
        variants={staggerItem}
        className="mb-8 text-lg"
        style={{ color: colors.textSecondary }}
      >
        {isLaunching ? scene.subtitle : '即将进入智教星——自适应错题诊疗系统'}
      </motion.p>

      <motion.div variants={staggerItem} className="w-full mb-10">
        <div
          className="h-[3px] rounded-full overflow-hidden"
          style={{ backgroundColor: colors.divider }}
        >
          <motion.div
            className="h-full"
            style={{
              width: `${isLaunching ? progress : 0}%`,
              backgroundColor: colors.accent,
            }}
            transition={{ duration: 0.1 }}
          />
        </div>
        <div className="flex justify-between mt-3">
          <span className="text-xs" style={{ color: colors.textWeak }}>
            {isLaunching ? `${Math.round(progress)}%` : '0%'}
          </span>
          <span className="text-xs" style={{ color: colors.textWeak }}>100%</span>
        </div>
      </motion.div>

      {!isLaunching && (
        <motion.button
          variants={staggerItem}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onLaunch}
          className="px-14 py-4 font-semibold tracking-wider transition-all duration-300 text-base"
          style={{
            backgroundColor: colors.accent,
            color: '#ffffff',
            borderRadius: '10px',
            border: 'none',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: `0 4px 20px ${colors.accent}30`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.accentDeep
            e.currentTarget.style.boxShadow = `0 6px 28px ${colors.accent}40`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent
            e.currentTarget.style.boxShadow = `0 4px 20px ${colors.accent}30`
          }}
        >
          进入平台
        </motion.button>
      )}

      {isLaunching && progress >= 100 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm"
          style={{ color: colors.textSecondary }}
        >
          正在跳转...
        </motion.p>
      )}
    </motion.div>
  )
}
