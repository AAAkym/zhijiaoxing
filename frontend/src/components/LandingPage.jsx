import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Users, BookOpen, Brain, GraduationCap, BarChart3,
  MessageSquare, Shield, Clock, Star,
  Play, ChevronDown, Menu, X, Globe,
  LayoutDashboard, PenTool,
  Share2, CheckCircle, ArrowRight, Target, Lightbulb,
  Zap, Rocket, Eye, TrendingUp, Award, Cpu
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI智能备课',
    description: '基于大语言模型的智能内容生成，辅助教师快速创建高质量教学内容',
    color: 'from-cyan-500/20 to-blue-500/20',
    borderColor: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(0,212,255,0.15)]'
  },
  {
    icon: GraduationCap,
    title: '个性化学习',
    description: '根据学生学习进度和能力水平，智能推荐个性化学习路径',
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]'
  },
  {
    icon: BarChart3,
    title: '数据驱动决策',
    description: '实时数据分析面板，为管理者提供全面的教学质量监控',
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(52,211,153,0.15)]'
  },
  {
    icon: MessageSquare,
    title: 'AI智能问答',
    description: '24/7在线AI助教，随时解答学生疑问，提供个性化辅导',
    color: 'from-orange-500/20 to-red-500/20',
    borderColor: 'border-orange-500/20',
    iconColor: 'text-orange-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(251,146,60,0.15)]'
  },
  {
    icon: Shield,
    title: '内容审核',
    description: '三重审核机制确保教育内容合规、安全、高质量',
    color: 'from-indigo-500/20 to-purple-500/20',
    borderColor: 'border-indigo-500/20',
    iconColor: 'text-indigo-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]'
  },
  {
    icon: Clock,
    title: '实时互动',
    description: '支持课堂实时互动、在线答疑、作业提交与批改',
    color: 'from-pink-500/20 to-rose-500/20',
    borderColor: 'border-pink-500/20',
    iconColor: 'text-pink-400',
    glowColor: 'group-hover:shadow-[0_0_30px_rgba(236,72,153,0.15)]'
  }
]

const testimonials = [
  {
    name: '张老师',
    role: '高中数学教师',
    content: '智教星的AI备课功能让我的备课时间减少了60%，可以更专注于课堂教学！',
    avatar: 'Z',
    rating: 5
  },
  {
    name: '李同学',
    role: '高三学生',
    content: '个性化学习路径和AI问答功能帮我快速提升了数学成绩，太赞了！',
    avatar: 'L',
    rating: 5
  },
  {
    name: '王校长',
    role: '学校管理员',
    content: '数据面板让我能够实时掌握全校教学情况，管理效率大幅提升。',
    avatar: 'W',
    rating: 5
  }
]

const stats = [
  { number: 50000, suffix: '+', label: '注册用户', icon: Users, color: 'text-cyan-400' },
  { number: 2000, suffix: '+', label: '精品课程', icon: BookOpen, color: 'text-emerald-400' },
  { number: 98.5, suffix: '%', label: '用户满意度', icon: Star, color: 'text-purple-400' },
  { number: 1000000, suffix: '+', label: 'AI交互次数', icon: Brain, color: 'text-orange-400' }
]

const useCases = [
  {
    role: '教师',
    icon: PenTool,
    color: 'from-cyan-500/20 to-blue-500/20',
    borderColor: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    features: ['智能备课助手', '课程内容管理', '学情数据分析', '作业智能批改']
  },
  {
    role: '学生',
    icon: GraduationCap,
    color: 'from-emerald-500/20 to-teal-500/20',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    features: ['个性化学习路径', '智能练习推荐', 'AI助教答疑', '学习进度追踪']
  },
  {
    role: '管理员',
    icon: LayoutDashboard,
    color: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/20',
    iconColor: 'text-purple-400',
    features: ['用户权限管理', '教学质量监控', '数据统计分析', '系统配置管理']
  }
]

const howItWorks = [
  {
    step: '01',
    title: '输入需求',
    description: '教师输入教学目标、学生水平和课程要求',
    icon: Target,
    color: 'text-cyan-400'
  },
  {
    step: '02',
    title: 'AI分析',
    description: 'Spark4.0 Ultra大模型智能分析并生成个性化方案',
    icon: Brain,
    color: 'text-purple-400'
  },
  {
    step: '03',
    title: '智能输出',
    description: '自动生成教案、练习题、学情报告等完整教学材料',
    icon: Lightbulb,
    color: 'text-emerald-400'
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

// 动画配置
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
}

const staggerItem = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
}

// 数字动画组件
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
        const eased = 1 - Math.pow(1 - progress, 3)
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

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const heroRef = useRef(null)
  const { scrollY } = useScroll()
  const heroY = useTransform(scrollY, [0, 500], [0, 200])
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0])

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
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* 增强背景粒子 */}
      <EnhancedParticleBackground />
      
      {/* 动态光晕背景 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div 
          className="absolute top-1/4 left-1/4 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.5, 0.2]
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[100px]"
          animate={{
            scale: [1.3, 1, 1.3],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-purple-500/3 rounded-full blur-[150px]"
          animate={{
            rotate: 360
          }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* 导航栏 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-white/10' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => scrollToSection('hero')}>
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20" />
                <Sparkles className="w-5 h-5 text-cyan-400 relative z-10" />
              </div>
              <span className="text-sm font-light tracking-wider text-white/80">智教星</span>
            </div>

            {/* 桌面导航 */}
            <div className="hidden md:flex items-center gap-8">
              {['features', 'howitworks', 'usecases', 'testimonials', 'pricing'].map((section) => (
                <button 
                  key={section}
                  onClick={() => scrollToSection(section)} 
                  className="text-sm text-white/50 hover:text-white transition-colors duration-200 tracking-wider relative group"
                >
                  {section === 'features' && '功能'}
                  {section === 'howitworks' && '原理'}
                  {section === 'usecases' && '场景'}
                  {section === 'testimonials' && '评价'}
                  {section === 'pricing' && '价格'}
                  <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-cyan-400 group-hover:w-full transition-all duration-300" />
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/login">
                <Button variant="ghost" className="text-white/60 hover:text-white hover:bg-white/5 text-sm tracking-wider">
                  登录
                </Button>
              </Link>
              <Link to="/welcome">
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 text-sm tracking-wider px-6 transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]">
                  开始使用
                </Button>
              </Link>
            </div>

            {/* 移动端菜单按钮 */}
            <button
              className="md:hidden p-2 text-white/60 hover:text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-black/95 backdrop-blur-xl border-t border-white/10"
            >
              <div className="px-6 py-6 space-y-4">
                {['features', 'howitworks', 'usecases', 'testimonials', 'pricing'].map((section) => (
                  <button 
                    key={section}
                    onClick={() => scrollToSection(section)} 
                    className="block w-full text-left text-white/60 hover:text-white text-sm tracking-wider py-2"
                  >
                    {section === 'features' && '功能特性'}
                    {section === 'howitworks' && '工作原理'}
                    {section === 'usecases' && '使用场景'}
                    {section === 'testimonials' && '用户评价'}
                    {section === 'pricing' && '价格方案'}
                  </button>
                ))}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <Link to="/login">
                    <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/5">登录</Button>
                  </Link>
                  <Link to="/welcome">
                    <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400">开始使用</Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Hero Section */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        </motion.div>

        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="text-center"
          >
            <motion.div
              variants={staggerItem}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs tracking-wider text-white/40 mb-8"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              2026 · AI教学数字孪生
            </motion.div>

            <motion.h1
              variants={staggerItem}
              className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extralight tracking-wider mb-6 bg-gradient-to-r from-white via-cyan-200 to-blue-200 bg-clip-text text-transparent"
            >
              智教星
            </motion.h1>

            <motion.p
              variants={staggerItem}
              className="text-xl sm:text-2xl font-light text-white/30 mb-4 tracking-widest"
            >
              让教育更智能
            </motion.p>

            <motion.p
              variants={staggerItem}
              className="text-base text-white/40 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
            >
              基于Spark4.0 Ultra大模型的智能教学管理平台，
              <br className="hidden sm:block" />
              为每位教师创建AI数字孪生
            </motion.p>

            <motion.div
              variants={staggerItem}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link to="/welcome">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 px-8 py-6 text-base tracking-wider transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]">
                  开始使用 <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 px-8 py-6 text-base tracking-wider transition-all duration-300">
                <Play className="w-4 h-4 mr-2" />
                观看演示
              </Button>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2"
        >
          <button onClick={() => scrollToSection('stats')}>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ChevronDown className="w-6 h-6 text-white/20" />
            </motion.div>
          </button>
        </motion.div>
      </section>

      {/* 统计数据 */}
      <section id="stats" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  className="text-center p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]"
                >
                  <Icon className={`w-6 h-6 ${stat.color} mx-auto mb-4`} />
                  <div className="text-4xl sm:text-5xl font-extralight text-white mb-2">
                    <AnimatedCounter target={stat.number} suffix={stat.suffix} />
                  </div>
                  <div className="text-sm text-white/40 tracking-wider">{stat.label}</div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 功能特性 */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-white/30 mb-4">
              CORE FEATURES
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              核心功能
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 max-w-xl font-light">
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
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -6, transition: { duration: 0.3 } }}
                  className={`group p-8 rounded-2xl bg-gradient-to-b ${feature.color} backdrop-blur-sm border ${feature.borderColor} hover:border-cyan-500/30 transition-all duration-500 ${feature.glowColor}`}
                >
                  <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Icon className={`w-7 h-7 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-xl font-light text-white/90 mb-3">{feature.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed font-light">{feature.description}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 工作原理 */}
      <section id="howitworks" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-white/30 mb-4">
              HOW IT WORKS
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              工作原理
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 max-w-xl font-light">
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
                  <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]">
                    <div className="text-6xl font-extralight text-white/5 mb-4">{step.step}</div>
                    <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 ${step.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-light text-white/90 mb-3">{step.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed font-light">{step.description}</p>
                  </div>
                  {index < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-[1px] bg-gradient-to-r from-cyan-500/30 to-transparent" />
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 使用场景 */}
      <section id="usecases" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-white/30 mb-4">
              USE CASES
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              适合每一位
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 max-w-xl font-light">
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
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -6, transition: { duration: 0.3 } }}
                  className={`group p-8 rounded-2xl bg-gradient-to-b ${useCase.color} backdrop-blur-sm border ${useCase.borderColor} hover:border-cyan-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]`}
                >
                  <div className={`w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center mb-6 ${useCase.iconColor} group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-light text-white/90 mb-6">{useCase.role}</h3>
                  <ul className="space-y-4">
                    {useCase.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-white/40 text-sm">
                        <CheckCircle className="w-4 h-4 text-cyan-400/60 mr-3 flex-shrink-0" />
                        <span className="font-light">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* 用户评价 */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-white/30 mb-4">
              TESTIMONIALS
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              用户心声
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 max-w-xl font-light">
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
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-cyan-500/30 transition-all duration-500 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]"
              >
                <div className="flex items-center mb-6">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400/60 fill-yellow-400/60 mr-1" />
                  ))}
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-8 font-light italic">
                  "{testimonial.content}"
                </p>
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-sm text-white/60 mr-4">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="text-white/80 text-sm font-light">{testimonial.name}</p>
                    <p className="text-white/30 text-xs">{testimonial.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 定价 */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-20"
          >
            <motion.p variants={staggerItem} className="text-xs tracking-[0.3em] text-white/30 mb-4">
              PRICING
            </motion.p>
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              价格方案
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 max-w-xl font-light">
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
                whileHover={{ y: -6, transition: { duration: 0.3 } }}
                className={`relative p-8 rounded-2xl border transition-all duration-500 ${
                  plan.highlighted
                    ? 'bg-white/[0.05] border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_40px_rgba(0,212,255,0.15)]'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(0,212,255,0.1)]'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs tracking-wider rounded-full">
                    推荐
                  </div>
                )}
                <div className="mb-8">
                  <p className="text-xs tracking-[0.3em] text-white/30 mb-2">{plan.nameEn}</p>
                  <h3 className="text-xl font-light text-white/90 mb-2">{plan.name}</h3>
                  <p className="text-white/30 text-sm font-light">{plan.description}</p>
                </div>
                <div className="mb-8">
                  <span className="text-4xl font-extralight text-white">{plan.price}</span>
                  <span className="text-white/30 text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-white/40 text-sm">
                      <CheckCircle className="w-4 h-4 text-cyan-400/60 mr-3 flex-shrink-0" />
                      <span className="font-light">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full py-5 text-sm tracking-wider transition-all duration-300 ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 hover:shadow-[0_0_20px_rgba(0,212,255,0.3)]'
                      : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  {plan.cta}
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <motion.h2 variants={staggerItem} className="text-5xl md:text-6xl font-extralight tracking-wider mb-6">
              准备好开始了吗
            </motion.h2>
            <motion.p variants={staggerItem} className="text-lg text-white/40 mb-12 font-light">
              加入数万名教育工作者，体验AI驱动的智能教学
            </motion.p>
            <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/welcome">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-400 hover:to-blue-400 px-10 py-6 text-base tracking-wider transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]">
                  免费开始 <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/5 px-10 py-6 text-base tracking-wider">
                联系销售
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t border-white/10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-500/20" />
                  <Sparkles className="w-5 h-5 text-cyan-400 relative z-10" />
                </div>
                <span className="text-lg font-light tracking-wider">智教星</span>
              </div>
              <p className="text-white/30 text-sm font-light mb-6 leading-relaxed">
                智能教育平台，让学习更高效。<br />AI驱动的教育新时代。
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Globe className="w-4 h-4 text-white/40" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <MessageSquare className="w-4 h-4 text-white/40" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
                  <Share2 className="w-4 h-4 text-white/40" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-light text-white/60 mb-6 tracking-wider">产品</h3>
              <ul className="space-y-4">
                <li><a href="#features" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">功能特性</a></li>
                <li><a href="#usecases" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">使用场景</a></li>
                <li><a href="#pricing" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">价格方案</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">更新日志</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-light text-white/60 mb-6 tracking-wider">支持</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">帮助中心</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">API文档</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">社区论坛</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">联系我们</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-light text-white/60 mb-6 tracking-wider">公司</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">关于我们</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">团队介绍</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">隐私政策</a></li>
                <li><a href="#" className="text-white/30 hover:text-white/60 text-sm font-light transition-colors">服务条款</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-white/20 text-xs font-light mb-4 md:mb-0">
                © 2026 智教星. 保留所有权利。
              </p>
              <p className="text-white/20 text-xs font-light">
                联系邮箱：<a href="mailto:3355299179@qq.com" className="text-white/40 hover:text-white/60 transition-colors">3355299179@qq.com</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// 增强背景粒子组件
function EnhancedParticleBackground() {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    const newParticles = [...Array(60)].map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2.5 + 0.5,
      duration: Math.random() * 20 + 10,
      delay: Math.random() * 5,
      opacity: Math.random() * 0.4 + 0.05,
      type: Math.random() > 0.8 ? 'glow' : 'normal'
    }))
    setParticles(newParticles)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
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
            y: [0, -25, 0],
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
