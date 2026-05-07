import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Users, BookOpen, Brain, GraduationCap, BarChart3,
  MessageSquare, Shield, Clock, Star,
  Play, ChevronDown, Menu, X, Globe,
  LayoutDashboard, PenTool,
  Share2, CheckCircle, ArrowRight, Target, Lightbulb,
  Zap, Rocket, Eye, TrendingUp, Award, Cpu,
  Heart, Coffee, Feather, Leaf, Sun, Moon
} from 'lucide-react'

// ============================================
// 设计系统 - 人文温度色彩
// ============================================
const colors = {
  // 主色调 - 温暖的深靛蓝，替代冷峻的纯黑
  primary: {
    bg: '#1a1a2e',
    surface: '#16213e',
    elevated: '#0f3460',
  },
  // 强调色 - 温暖的琥珀和珊瑚
  accent: {
    warm: '#e9c46a',
    coral: '#f4a261',
    rose: '#e76f51',
    sage: '#2a9d8f',
    sky: '#87ceeb',
  },
  // 文字色
  text: {
    primary: '#f8f9fa',
    secondary: '#dee2e6',
    muted: '#adb5bd',
    subtle: '#6c757d',
  }
}

// ============================================
// 数据定义
// ============================================
const features = [
  {
    icon: Brain,
    title: 'AI智能备课',
    description: '基于大语言模型的智能内容生成，辅助教师快速创建高质量教学内容',
    color: 'bg-[#e9c46a]/10',
    borderColor: 'border-[#e9c46a]/20',
    iconColor: 'text-[#e9c46a]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(233,196,106,0.15)]'
  },
  {
    icon: GraduationCap,
    title: '个性化学习',
    description: '根据学生学习进度和能力水平，智能推荐个性化学习路径',
    color: 'bg-[#f4a261]/10',
    borderColor: 'border-[#f4a261]/20',
    iconColor: 'text-[#f4a261]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(244,162,97,0.15)]'
  },
  {
    icon: BarChart3,
    title: '数据驱动决策',
    description: '实时数据分析面板，为管理者提供全面的教学质量监控',
    color: 'bg-[#2a9d8f]/10',
    borderColor: 'border-[#2a9d8f]/20',
    iconColor: 'text-[#2a9d8f]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(42,157,143,0.15)]'
  },
  {
    icon: MessageSquare,
    title: 'AI智能问答',
    description: '24/7在线AI助教，随时解答学生疑问，提供个性化辅导',
    color: 'bg-[#e76f51]/10',
    borderColor: 'border-[#e76f51]/20',
    iconColor: 'text-[#e76f51]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(231,111,81,0.15)]'
  },
  {
    icon: Shield,
    title: '内容审核',
    description: '三重审核机制确保教育内容合规、安全、高质量',
    color: 'bg-[#87ceeb]/10',
    borderColor: 'border-[#87ceeb]/20',
    iconColor: 'text-[#87ceeb]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(135,206,235,0.15)]'
  },
  {
    icon: Clock,
    title: '实时互动',
    description: '支持课堂实时互动、在线答疑、作业提交与批改',
    color: 'bg-[#e9c46a]/10',
    borderColor: 'border-[#e9c46a]/20',
    iconColor: 'text-[#e9c46a]',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(233,196,106,0.15)]'
  }
]

const testimonials = [
  {
    name: '张老师',
    role: '高中数学教师',
    content: '智教星的AI备课功能让我的备课时间减少了60%，可以更专注于课堂教学！',
    avatar: 'Z',
    rating: 5,
    accent: '#e9c46a'
  },
  {
    name: '李同学',
    role: '高三学生',
    content: '个性化学习路径和AI问答功能帮我快速提升了数学成绩，太赞了！',
    avatar: 'L',
    rating: 5,
    accent: '#f4a261'
  },
  {
    name: '王校长',
    role: '学校管理员',
    content: '数据面板让我能够实时掌握全校教学情况，管理效率大幅提升。',
    avatar: 'W',
    rating: 5,
    accent: '#2a9d8f'
  }
]

const stats = [
  { number: 50000, suffix: '+', label: '注册用户', icon: Users, color: 'text-[#e9c46a]' },
  { number: 2000, suffix: '+', label: '精品课程', icon: BookOpen, color: 'text-[#2a9d8f]' },
  { number: 98.5, suffix: '%', label: '用户满意度', icon: Heart, color: 'text-[#e76f51]' },
  { number: 1000000, suffix: '+', label: 'AI交互次数', icon: Brain, color: 'text-[#f4a261]' }
]

const useCases = [
  {
    role: '教师',
    icon: PenTool,
    color: 'bg-[#e9c46a]/10',
    borderColor: 'border-[#e9c46a]/20',
    iconColor: 'text-[#e9c46a]',
    features: ['智能备课助手', '课程内容管理', '学情数据分析', '作业智能批改']
  },
  {
    role: '学生',
    icon: GraduationCap,
    color: 'bg-[#2a9d8f]/10',
    borderColor: 'border-[#2a9d8f]/20',
    iconColor: 'text-[#2a9d8f]',
    features: ['个性化学习路径', '智能练习推荐', 'AI助教答疑', '学习进度追踪']
  },
  {
    role: '管理员',
    icon: LayoutDashboard,
    color: 'bg-[#f4a261]/10',
    borderColor: 'border-[#f4a261]/20',
    iconColor: 'text-[#f4a261]',
    features: ['用户权限管理', '教学质量监控', '数据统计分析', '系统配置管理']
  }
]

const howItWorks = [
  {
    step: '01',
    title: '输入需求',
    description: '教师输入教学目标、学生水平和课程要求',
    icon: Target,
    color: 'text-[#e9c46a]'
  },
  {
    step: '02',
    title: 'AI分析',
    description: 'Spark4.0 Ultra大模型智能分析并生成个性化方案',
    icon: Brain,
    color: 'text-[#f4a261]'
  },
  {
    step: '03',
    title: '智能输出',
    description: '自动生成教案、练习题、学情报告等完整教学材料',
    icon: Lightbulb,
    color: 'text-[#2a9d8f]'
  }
]

const pricingPlans = [
  {
    name: '基础版',
    nameEn: 'BASIC',
    price: '免费',
    period: '',
    description: '适合个人教师体验',
    features: ['AI智能备课（10次/月）', '基础学情分析', '在线答疑', '作业管理'],
    cta: '免费开始',
    highlighted: false
  },
  {
    name: '专业版',
    nameEn: 'PRO',
    price: '¥299',
    period: '/月',
    description: '适合专业教师团队',
    features: ['无限AI智能备课', '高级学情分析', '个性化学习路径', '班级管理', '数据导出', '优先技术支持'],
    cta: '立即升级',
    highlighted: true
  },
  {
    name: '机构版',
    nameEn: 'ENTERPRISE',
    price: '定制',
    period: '',
    description: '适合学校和教育机构',
    features: ['全功能访问', '多校区管理', 'API接口', '私有化部署', '专属客服', '定制开发'],
    cta: '联系销售',
    highlighted: false
  }
]

// ============================================
// 动画配置 - 有机、非机械感
// ============================================
const organicEase = [0.34, 1.56, 0.64, 1] // 弹性缓动

const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] } 
  }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 }
  }
}

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } 
  }
}

// ============================================
// 手工感装饰组件
// ============================================
function HandDrawnCircle({ className, color = '#e9c46a' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none">
      <path
        d="M50 5 C75 5, 95 25, 95 50 C95 75, 75 95, 50 95 C25 95, 5 75, 5 50 C5 25, 25 5, 50 5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="4 6"
        opacity="0.4"
      />
    </svg>
  )
}

function OrganicBlob({ className, color = '#e9c46a' }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none">
      <path
        d="M45.7,-76.3C58.9,-69.3,69.1,-55.6,76.3,-41.2C83.5,-26.8,87.7,-11.7,85.8,2.3C83.9,16.3,75.9,29.2,66.3,40.1C56.7,51,45.5,59.9,33.1,66.3C20.7,72.7,7.1,76.6,-6.2,75.8C-19.5,75,-32.5,69.5,-44.3,61.8C-56.1,54.1,-66.7,44.2,-73.3,32.1C-79.9,20,-82.5,5.7,-79.6,-7.2C-76.7,-20.1,-68.3,-31.6,-58.1,-40.8C-47.9,-50,-35.9,-56.9,-23.3,-64.3C-10.7,-71.7,2.5,-79.6,16.3,-79.8C30.1,-80,44.5,-72.5,45.7,-76.3Z"
        fill={color}
        opacity="0.08"
      />
    </svg>
  )
}

function WavyLine({ className, color = '#e9c46a' }) {
  return (
    <svg className={className} viewBox="0 0 200 20" fill="none" preserveAspectRatio="none">
      <path
        d="M0 10 Q25 0, 50 10 T100 10 T150 10 T200 10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  )
}

// ============================================
// 数字动画组件
// ============================================
function AnimatedCounter({ target, suffix = '' }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true })

  useEffect(() => {
    if (isInView) {
      const duration = 2000
      const startTime = Date.now()
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // 使用更自然的缓动
        const eased = 1 - Math.pow(1 - progress, 4)
        setCount(Math.floor(eased * target))
        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }
  }, [isInView, target])

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

// ============================================
// 增强背景粒子 - 有机运动
// ============================================
function OrganicParticleBackground() {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    const newParticles = [...Array(40)].map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 25 + 15,
      delay: Math.random() * 8,
      opacity: Math.random() * 0.3 + 0.05,
      drift: Math.random() * 20 - 10,
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-[#e9c46a]"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            opacity: particle.opacity,
          }}
          animate={{
            y: [0, -30, 10, -20, 0],
            x: [0, particle.drift, -particle.drift * 0.5, particle.drift * 0.8, 0],
            opacity: [particle.opacity, particle.opacity * 0.3, particle.opacity * 0.6, particle.opacity * 0.2, particle.opacity],
            scale: [1, 1.2, 0.8, 1.1, 1],
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            delay: particle.delay,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

// ============================================
// 主组件
// ============================================
export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, 150])
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (id) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
    setIsMenuOpen(false)
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-[#f8f9fa] overflow-x-hidden font-light">
      {/* 有机粒子背景 */}
      <OrganicParticleBackground />
      
      {/* 有机光晕背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          className="absolute top-1/4 left-1/4 w-[700px] h-[700px] bg-[#e9c46a]/5 rounded-full blur-[150px]"
          animate={{
            scale: [1, 1.4, 1],
            x: [0, 30, -20, 0],
            y: [0, -20, 30, 0],
            opacity: [0.15, 0.35, 0.15]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/3 right-1/4 w-[500px] h-[500px] bg-[#f4a261]/5 rounded-full blur-[120px]"
          animate={{
            scale: [1.3, 1, 1.3],
            x: [0, -40, 20, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-[#2a9d8f]/3 rounded-full blur-[180px]"
          animate={{
            rotate: 360,
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* 导航栏 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
        scrolled ? 'bg-[#1a1a2e]/90 backdrop-blur-xl border-b border-white/5' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex justify-between items-center">
            {/* Logo - 有机排列 */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-[#e9c46a]/10 backdrop-blur-sm border border-[#e9c46a]/20 flex items-center justify-center rotate-3 hover:rotate-0 transition-transform duration-500">
                  <Sparkles className="w-5 h-5 text-[#e9c46a]" />
                </div>
                <HandDrawnCircle className="absolute -inset-2 w-14 h-14 animate-spin" style={{ animationDuration: '20s' }} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-normal tracking-wide text-[#f8f9fa]">智教星</span>
                <span className="text-[10px] tracking-[0.2em] text-[#6c757d] -mt-0.5">EDUSTAR</span>
              </div>
            </div>

            {/* 桌面导航 - 非对称间距 */}
            <div className="hidden md:flex items-center gap-10">
              {[
                { id: 'features', label: '功能', offset: 0 },
                { id: 'howitworks', label: '原理', offset: 4 },
                { id: 'usecases', label: '场景', offset: -2 },
                { id: 'testimonials', label: '评价', offset: 3 },
                { id: 'pricing', label: '价格', offset: -1 },
              ].map((item) => (
                <button 
                  key={item.id}
                  onClick={() => scrollToSection(item.id)} 
                  className="text-sm text-[#adb5bd] hover:text-[#f8f9fa] transition-colors duration-300 tracking-wider relative group"
                  style={{ marginTop: item.offset }}
                >
                  {item.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1.5px] bg-[#e9c46a] group-hover:w-full transition-all duration-500" />
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-[#adb5bd] hover:text-[#f8f9fa] hover:bg-white/5 text-sm tracking-wider">
                  登录
                </Button>
              </Link>
              <Link to="/welcome">
                <Button className="bg-[#e9c46a] text-[#1a1a2e] hover:bg-[#f4a261] text-sm tracking-wider px-6 transition-all duration-500 hover:shadow-[0_0_25px_rgba(233,196,106,0.3)] font-normal">
                  开始使用
                </Button>
              </Link>
            </div>

            {/* 移动端菜单按钮 */}
            <button
              className="md:hidden p-2 text-[#adb5bd] hover:text-[#f8f9fa]"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#1a1a2e]/95 backdrop-blur-xl border-t border-white/5"
          >
            <div className="px-6 py-6 space-y-4">
              {['features', 'howitworks', 'usecases', 'testimonials', 'pricing'].map((section) => (
                <button 
                  key={section}
                  onClick={() => scrollToSection(section)} 
                  className="block w-full text-left text-[#adb5bd] hover:text-[#f8f9fa] text-sm tracking-wider py-2"
                >
                  {section === 'features' && '功能特性'}
                  {section === 'howitworks' && '工作原理'}
                  {section === 'usecases' && '使用场景'}
                  {section === 'testimonials' && '用户评价'}
                  {section === 'pricing' && '价格方案'}
                </button>
              ))}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <Link to="/login">
                  <Button variant="outline" className="w-full border-white/10 text-[#f8f9fa] hover:bg-white/5">登录</Button>
                </Link>
                <Link to="/welcome">
                  <Button className="w-full bg-[#e9c46a] text-[#1a1a2e] hover:bg-[#f4a261]">开始使用</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section - 非对称布局 */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center px-6 overflow-hidden pt-20">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 overflow-hidden pointer-events-none">
          <OrganicBlob className="absolute top-1/4 right-1/4 w-96 h-96 opacity-60" color="#e9c46a" />
          <OrganicBlob className="absolute bottom-1/4 left-1/6 w-80 h-80 opacity-40" color="#f4a261" />
        </motion.div>

        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* 左侧内容 - 错位排列 */}
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="relative"
            >
              <motion.div
                variants={staggerItem}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#e9c46a]/5 border border-[#e9c46a]/10 text-xs tracking-[0.2em] text-[#e9c46a]/60 mb-8"
              >
                <Feather className="w-3 h-3" />
                2026 · AI教学数字孪生
              </motion.div>

              <motion.h1
                variants={staggerItem}
                className="text-5xl sm:text-6xl md:text-7xl font-normal tracking-tight mb-4 leading-[1.1]"
              >
                <span className="text-[#f8f9fa]">智教星</span>
              </motion.h1>

              <motion.div variants={staggerItem} className="mb-6">
                <WavyLine className="w-32 h-4 mb-4" color="#e9c46a" />
              </motion.div>

              <motion.p
                variants={staggerItem}
                className="text-2xl sm:text-3xl font-light text-[#e9c46a]/80 mb-4 tracking-wide"
              >
                让教育更智能
              </motion.p>

              <motion.p
                variants={staggerItem}
                className="text-base text-[#adb5bd] max-w-lg mb-10 leading-[1.8]"
              >
                基于Spark4.0 Ultra大模型的智能教学管理平台，
                为每位教师创建AI数字孪生，让教学充满温度与创造力
              </motion.p>

              <motion.div
                variants={staggerItem}
                className="flex flex-col sm:flex-row gap-4 items-start"
              >
                <Link to="/welcome">
                  <Button size="lg" className="bg-[#e9c46a] text-[#1a1a2e] hover:bg-[#f4a261] px-8 py-6 text-base tracking-wider transition-all duration-500 hover:shadow-[0_0_30px_rgba(233,196,106,0.25)] font-normal">
                    开始使用 <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="border-[#e9c46a]/20 text-[#e9c46a] hover:bg-[#e9c46a]/5 px-8 py-6 text-base tracking-wider transition-all duration-500">
                  <Play className="w-4 h-4 mr-2" />
                  观看演示
                </Button>
              </motion.div>
            </motion.div>

            {/* 右侧装饰 - 有机形状组合 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 1.2, ease: organicEase, delay: 0.3 }}
              className="relative hidden lg:block"
            >
              <div className="relative w-full aspect-square max-w-md mx-auto">
                {/* 有机形状层叠 */}
                <motion.div
                  className="absolute inset-0 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#e9c46a]/10 backdrop-blur-sm border border-[#e9c46a]/10"
                  animate={{ 
                    borderRadius: ['40%_60%_70%_30%/40%_50%_60%_50%', '60%_40%_30%_70%/50%_60%_40%_50%', '40%_60%_70%_30%/40%_50%_60%_50%'],
                    rotate: [0, 5, 0],
                  }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-8 rounded-[60%_40%_30%_70%/50%_60%_40%_50%] bg-[#f4a261]/5 backdrop-blur-sm border border-[#f4a261]/10"
                  animate={{ 
                    borderRadius: ['60%_40%_30%_70%/50%_60%_40%_50%', '30%_60%_70%_40%/50%_40%_60%_50%', '60%_40%_30%_70%/50%_60%_40%_50%'],
                    rotate: [0, -5, 0],
                  }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                  className="absolute inset-16 rounded-[50%] bg-[#2a9d8f]/5 backdrop-blur-sm border border-[#2a9d8f]/10 flex items-center justify-center"
                  animate={{ 
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <div className="text-center">
                    <Sparkles className="w-16 h-16 text-[#e9c46a]/40 mx-auto mb-4" />
                    <p className="text-[#e9c46a]/40 text-sm tracking-wider">AI-Powered</p>
                    <p className="text-[#f8f9fa]/30 text-xs tracking-wider mt-1">Education</p>
                  </div>
                </motion.div>
                
                {/* 浮动装饰元素 */}
                <motion.div
                  className="absolute -top-4 -right-4 w-20 h-20 rounded-full bg-[#e76f51]/10 flex items-center justify-center"
                  animate={{ y: [0, -15, 0], rotate: [0, 10, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Heart className="w-8 h-8 text-[#e76f51]/40" />
                </motion.div>
                <motion.div
                  className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-[#2a9d8f]/10 flex items-center justify-center"
                  animate={{ y: [0, 15, 0], rotate: [0, -10, 0] }}
                  transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                >
                  <Leaf className="w-6 h-6 text-[#2a9d8f]/40" />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* 滚动提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <button onClick={() => scrollToSection('stats')}>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-6 h-6 text-[#6c757d]" />
            </motion.div>
          </button>
        </motion.div>
      </section>

      {/* 统计数据 - 有机卡片 */}
      <section id="stats" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -8, transition: { duration: 0.4, ease: organicEase } }}
                  className="text-center p-8 rounded-[2rem_1rem_2rem_1rem] bg-white/[0.02] border border-white/5 hover:border-[#e9c46a]/20 transition-all duration-700 hover:shadow-[0_0_30px_rgba(233,196,106,0.08)]"
                >
                  <Icon className={`w-6 h-6 ${stat.color} mx-auto mb-4`} />
                  <div className="text-4xl sm:text-5xl font-light text-[#f8f9fa] mb-2">
                    <AnimatedCounter target={stat.number} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-[#6c757d] tracking-wider">{stat.label}</div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 功能特性 - 错落网格 */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-[#6c757d] mb-4">
              CORE FEATURES
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              核心功能
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] max-w-xl">
              智教星提供全方位的智能教育解决方案，覆盖教学、学习、管理全流程
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon
              // 有机偏移 - 某些卡片稍微偏移
              const offsetY = index === 1 || index === 4 ? 'lg:mt-8' : ''
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -8, transition: { duration: 0.4, ease: organicEase } }}
                  className={`group p-8 rounded-[1.5rem_1rem_2rem_1.5rem] ${feature.color} backdrop-blur-sm border ${feature.borderColor} hover:border-[#e9c46a]/20 transition-all duration-700 ${feature.glowColor} ${offsetY}`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                    <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-normal text-[#f8f9fa] mb-3">{feature.title}</h3>
                  <p className="text-[#adb5bd] text-sm leading-[1.8]">{feature.description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 工作原理 - 有机流程 */}
      <section id="howitworks" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-[#6c757d] mb-4">
              HOW IT WORKS
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              工作原理
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] max-w-xl">
              三步开启智能教学新时代
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-8"
          >
            {howItWorks.map((step, index) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  className="relative"
                >
                  <div className="p-8 rounded-[2rem_1rem_2rem_1rem] bg-white/[0.02] border border-white/5 hover:border-[#e9c46a]/20 transition-all duration-700 hover:shadow-[0_0_30px_rgba(233,196,106,0.08)]">
                    <div className="text-7xl font-light text-white/[0.03] mb-2 leading-none">{step.step}</div>
                    <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 ${step.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-normal text-[#f8f9fa] mb-3">{step.title}</h3>
                    <p className="text-[#adb5bd] text-sm leading-[1.8]">{step.description}</p>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8">
                      <WavyLine className="w-full h-4" color="#e9c46a" />
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 使用场景 - 有机卡片 */}
      <section id="usecases" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-[#6c757d] mb-4">
              USE CASES
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              适合每一位
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] max-w-xl">
              无论您是教师、学生还是管理者，智教星都能为您提供专属的智能解决方案
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid lg:grid-cols-3 gap-6"
          >
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon
              const offsetY = index === 1 ? 'lg:mt-12' : ''
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -8, transition: { duration: 0.4, ease: organicEase } }}
                  className={`group p-8 rounded-[1.5rem_2rem_1rem_2rem] ${useCase.color} backdrop-blur-sm border ${useCase.borderColor} hover:border-[#e9c46a]/20 transition-all duration-700 hover:shadow-[0_0_30px_rgba(233,196,106,0.08)] ${offsetY}`}
                >
                  <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 ${useCase.iconColor} group-hover:scale-110 group-hover:rotate-3 transition-all duration-500`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-normal text-[#f8f9fa] mb-6">{useCase.role}</h3>
                  <ul className="space-y-4">
                    {useCase.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-[#adb5bd] text-sm">
                        <CheckCircle className="w-4 h-4 text-[#e9c46a]/60 mr-3 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 用户评价 - 有机卡片 */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-[#6c757d] mb-4">
              TESTIMONIALS
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              用户心声
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] max-w-xl">
              听听我们的用户怎么说
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6"
          >
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                variants={staggerItem}
                whileHover={{ y: -8, transition: { duration: 0.4, ease: organicEase } }}
                className="p-8 rounded-[1.5rem_1rem_2rem_1.5rem] bg-white/[0.02] border border-white/5 hover:border-[#e9c46a]/20 transition-all duration-700 hover:shadow-[0_0_30px_rgba(233,196,106,0.08)]"
              >
                <div className="flex items-center mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-[#e9c46a]/60 fill-[#e9c46a]/60 mr-1" />
                  ))}
                </div>
                <p className="text-[#adb5bd] text-sm leading-[1.8] mb-8 italic">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm text-[#1a1a2e] mr-4"
                    style={{ backgroundColor: testimonial.accent + '30', color: testimonial.accent }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-[#f8f9fa] text-sm font-normal">{testimonial.name}</p>
                    <p className="text-[#6c757d] text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 定价 - 有机卡片 */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-[#6c757d] mb-4">
              PRICING
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              价格方案
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] max-w-xl">
              选择适合您的方案，开启智能教学之旅
            </motion.p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          >
            {pricingPlans.map((plan, index) => (
              <motion.div
                key={index}
                variants={staggerItem}
                whileHover={{ y: -8, transition: { duration: 0.4, ease: organicEase } }}
                className={`relative p-8 rounded-[1.5rem_2rem_1.5rem_1rem] border transition-all duration-700 ${
                  plan.highlighted
                    ? 'bg-[#e9c46a]/5 border-[#e9c46a]/20 hover:border-[#e9c46a]/40 hover:shadow-[0_0_40px_rgba(233,196,106,0.12)]'
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10 hover:shadow-[0_0_30px_rgba(233,196,106,0.06)]'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#e9c46a] text-[#1a1a2e] text-xs tracking-wider rounded-full font-normal">
                    推荐
                  </div>
                )}
                <div className="mb-8">
                  <p className="text-xs tracking-[0.3em] text-[#6c757d] mb-2">{plan.nameEn}</p>
                  <h3 className="text-xl font-normal text-[#f8f9fa] mb-2">{plan.name}</h3>
                  <p className="text-[#6c757d] text-sm">{plan.description}</p>
                </div>
                <div className="mb-8">
                  <span className="text-4xl font-light text-[#f8f9fa]">{plan.price}</span>
                  <span className="text-[#6c757d] text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-[#adb5bd] text-sm">
                      <CheckCircle className="w-4 h-4 text-[#e9c46a]/60 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full py-5 text-sm tracking-wider transition-all duration-500 ${
                    plan.highlighted
                      ? 'bg-[#e9c46a] text-[#1a1a2e] hover:bg-[#f4a261] hover:shadow-[0_0_20px_rgba(233,196,106,0.25)] font-normal'
                      : 'bg-white/5 text-[#f8f9fa] hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section - 有机背景 */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <OrganicBlob className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-30" color="#e9c46a" />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 variants={staggerItem} className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              准备好开始了吗
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-[#adb5bd] mb-12">
              加入数万名教育工作者，体验AI驱动的智能教学
            </motion.p>
            <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/welcome">
                <Button size="lg" className="bg-[#e9c46a] text-[#1a1a2e] hover:bg-[#f4a261] px-10 py-6 text-base tracking-wider transition-all duration-500 hover:shadow-[0_0_30px_rgba(233,196,106,0.25)] font-normal">
                  免费开始 <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-[#e9c46a]/20 text-[#e9c46a] hover:bg-[#e9c46a]/5 px-10 py-6 text-base tracking-wider transition-all duration-500">
                联系销售
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 页脚 - 温暖风格 */}
      <footer className="border-t border-white/5 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-[#e9c46a]/10 border border-[#e9c46a]/20 flex items-center justify-center rotate-3">
                  <Sparkles className="w-5 h-5 text-[#e9c46a]" />
                </div>
                <span className="text-lg font-normal tracking-wider">智教星</span>
              </div>
              <p className="text-[#6c757d] text-sm mb-6 leading-[1.8]">
                智能教育平台，让学习更高效。<br />AI驱动的教育新时代。
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-[#e9c46a]/10 hover:border-[#e9c46a]/20 transition-all duration-500">
                  <Globe className="w-4 h-4 text-[#6c757d]" />
                </a>
                <a href="#" className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-[#e9c46a]/10 hover:border-[#e9c46a]/20 transition-all duration-500">
                  <MessageSquare className="w-4 h-4 text-[#6c757d]" />
                </a>
                <a href="#" className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-[#e9c46a]/10 hover:border-[#e9c46a]/20 transition-all duration-500">
                  <Share2 className="w-4 h-4 text-[#6c757d]" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-normal text-[#adb5bd] mb-6 tracking-wider">产品</h3>
              <ul className="space-y-4">
                <li><a href="#features" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">功能特性</a></li>
                <li><a href="#usecases" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">使用场景</a></li>
                <li><a href="#pricing" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">价格方案</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">更新日志</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-normal text-[#adb5bd] mb-6 tracking-wider">支持</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">帮助中心</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">API文档</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">社区论坛</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">联系我们</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-normal text-[#adb5bd] mb-6 tracking-wider">公司</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">关于我们</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">团队介绍</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">隐私政策</a></li>
                <li><a href="#" className="text-[#6c757d] hover:text-[#e9c46a] text-sm transition-colors duration-300">服务条款</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-[#6c757d] text-xs mb-4 md:mb-0">
                © 2026 智教星. 保留所有权利。
              </p>
              <p className="text-[#6c757d] text-xs">
                联系邮箱：<a href="mailto:3355299179@qq.com" className="text-[#adb5bd] hover:text-[#e9c46a] transition-colors">3355299179@qq.com</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
