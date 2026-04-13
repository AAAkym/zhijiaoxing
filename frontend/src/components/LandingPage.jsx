import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  Sparkles, Users, BookOpen, TrendingUp, CheckCircle, 
  ArrowRight, Brain, GraduationCap, Zap, BarChart3, 
  MessageSquare, Shield, Clock, Star, Award, 
  Play, ChevronDown, Menu, X, Globe, Database, 
  LayoutDashboard, FileText, PenTool, Layers, 
  Share2, Bell, Settings, ChevronRight, ChevronLeft, Rocket
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI智能备课',
    description: '基于大语言模型的智能内容生成，辅助教师快速创建高质量教学内容',
    color: 'from-blue-500 to-cyan-500'
  },
  {
    icon: GraduationCap,
    title: '个性化学习',
    description: '根据学生学习进度和能力水平，智能推荐个性化学习路径',
    color: 'from-purple-500 to-pink-500'
  },
  {
    icon: BarChart3,
    title: '数据驱动决策',
    description: '实时数据分析面板，为管理者提供全面的教学质量监控',
    color: 'from-green-500 to-teal-500'
  },
  {
    icon: MessageSquare,
    title: 'AI智能问答',
    description: '24/7在线AI助教，随时解答学生疑问，提供个性化辅导',
    color: 'from-orange-500 to-red-500'
  },
  {
    icon: Shield,
    title: '内容审核',
    description: '三重审核机制确保教育内容合规、安全、高质量',
    color: 'from-indigo-500 to-purple-500'
  },
  {
    icon: Clock,
    title: '实时互动',
    description: '支持课堂实时互动、在线答疑、作业提交与批改',
    color: 'from-pink-500 to-rose-500'
  }
]

const testimonials = [
  {
    name: '张老师',
    role: '高中数学教师',
    content: '智教星的AI备课功能让我的备课时间减少了60%，可以更专注于课堂教学！',
    avatar: '👨‍🏫',
    rating: 5
  },
  {
    name: '李同学',
    role: '高三学生',
    content: '个性化学习路径和AI问答功能帮我快速提升了数学成绩，太赞了！',
    avatar: '👨‍🎓',
    rating: 5
  },
  {
    name: '王校长',
    role: '学校管理员',
    content: '数据面板让我能够实时掌握全校教学情况，管理效率大幅提升。',
    avatar: '👩‍💼',
    rating: 5
  }
]

const stats = [
  { number: '50,000+', label: '注册用户', icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
  { number: '2,000+', label: '精品课程', icon: BookOpen, color: 'text-green-600', bg: 'bg-green-100' },
  { number: '98.5%', label: '用户满意度', icon: Star, color: 'text-purple-600', bg: 'bg-purple-100' },
  { number: '1M+', label: 'AI交互次数', icon: Brain, color: 'text-orange-600', bg: 'bg-orange-100' }
]

const useCases = [
  {
    role: '教师',
    icon: PenTool,
    color: 'from-blue-500 to-cyan-500',
    features: ['智能备课助手', '课程内容管理', '学情数据分析', '作业智能批改']
  },
  {
    role: '学生',
    icon: GraduationCap,
    color: 'from-green-500 to-teal-500',
    features: ['个性化学习路径', '智能练习推荐', 'AI助教答疑', '学习进度追踪']
  },
  {
    role: '管理员',
    icon: LayoutDashboard,
    color: 'from-purple-500 to-pink-500',
    features: ['用户权限管理', '教学质量监控', '数据统计分析', '系统配置管理']
  }
]

const guideSteps = [
  {
    id: 1,
    title: '欢迎来到智教星',
    subtitle: 'AI驱动的智能教育平台',
    description: '基于人工智能技术的全新教学管理平台，为教师提供智能备课工具，为学生提供个性化学习体验。',
    icon: Sparkles,
    color: 'from-blue-600 to-purple-600',
    features: [
      { icon: GraduationCap, text: '智能备课工具' },
      { icon: Zap, text: '个性化学习' },
      { icon: BarChart3, text: '数据驱动决策' }
    ]
  },
  {
    id: 2,
    title: '教师功能',
    subtitle: '高效教学管理',
    description: '为教师提供课程管理、内容生成、学情分析等全方位教学支持，让教学更轻松高效。',
    icon: Users,
    color: 'from-blue-500 to-cyan-500',
    features: [
      { icon: BookOpen, text: '课程管理' },
      { icon: Sparkles, text: '内容生成' },
      { icon: BarChart3, text: '学情分析' }
    ]
  },
  {
    id: 3,
    title: '学生体验',
    subtitle: '个性化学习体验',
    description: '为学生提供在线学习、练习评测、AI问答等丰富学习功能，让学习更有趣更高效。',
    icon: BookOpen,
    color: 'from-green-500 to-teal-500',
    features: [
      { icon: GraduationCap, text: '在线学习' },
      { icon: CheckCircle, text: '练习评测' },
      { icon: MessageSquare, text: 'AI问答' }
    ]
  },
  {
    id: 4,
    title: '开始使用',
    subtitle: '立即体验',
    description: '选择您的角色，开始体验智教星带来的智能教育新时代。',
    icon: Rocket,
    color: 'from-purple-500 to-pink-500',
    isLast: true
  }
]

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(true)
  const [currentGuideStep, setCurrentGuideStep] = useState(1)
  
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

  const handleGuideNext = () => {
    if (currentGuideStep < guideSteps.length) {
      setCurrentGuideStep(currentGuideStep + 1)
    }
  }

  const handleGuidePrev = () => {
    if (currentGuideStep > 1) {
      setCurrentGuideStep(currentGuideStep - 1)
    }
  }

  const handleGuideComplete = () => {
    setShowWelcomeGuide(false)
  }

  const handleGuideSkip = () => {
    setShowWelcomeGuide(false)
  }

  const currentStep = guideSteps[currentGuideStep - 1]
  const progress = ((currentGuideStep - 1) / (guideSteps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Welcome Guide Overlay */}
      <AnimatePresence>
        {showWelcomeGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-4xl"
            >
              <Card className="bg-white/95 backdrop-blur-xl shadow-2xl border-0 overflow-hidden">
                <CardContent className="p-0">
                  {/* Progress Bar */}
                  <div className="h-1 bg-gray-200">
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-600 to-purple-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>

                  <div className="p-8 md:p-12">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentGuideStep}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                        className="text-center"
                      >
                        {/* Icon */}
                        <div className={`w-20 h-20 md:w-24 md:h-24 bg-gradient-to-r ${currentStep.color} rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                          <currentStep.icon className="w-10 h-10 md:w-12 md:h-12 text-white" />
                        </div>

                        {/* Title & Subtitle */}
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                          {currentStep.title}
                        </h2>
                        <p className="text-lg md:text-xl text-blue-600 font-medium mb-4">
                          {currentStep.subtitle}
                        </p>

                        {/* Description */}
                        <p className="text-gray-600 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                          {currentStep.description}
                        </p>

                        {/* Features (if not last step) */}
                        {!currentStep.isLast && currentStep.features && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            {currentStep.features.map((feature, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex flex-col items-center p-4 bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-100"
                              >
                                <feature.icon className="w-8 h-8 text-blue-600 mb-2" />
                                <span className="text-gray-700 font-medium text-center">{feature.text}</span>
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Last Step - Role Selection */}
                        {currentStep.isLast && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <Link to="/login" className="block">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-200 hover:border-blue-400 transition-all cursor-pointer"
                              >
                                <Users className="w-12 h-12 text-blue-600 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">教师</h3>
                                <p className="text-sm text-gray-600">管理课程、生成内容</p>
                              </motion.div>
                            </Link>
                            <Link to="/login" className="block">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-2 border-green-200 hover:border-green-400 transition-all cursor-pointer"
                              >
                                <GraduationCap className="w-12 h-12 text-green-600 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">学生</h3>
                                <p className="text-sm text-gray-600">在线学习、AI问答</p>
                              </motion.div>
                            </Link>
                            <Link to="/login" className="block">
                              <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border-2 border-purple-200 hover:border-purple-400 transition-all cursor-pointer"
                              >
                                <LayoutDashboard className="w-12 h-12 text-purple-600 mx-auto mb-3" />
                                <h3 className="text-lg font-bold text-gray-900 mb-2">管理员</h3>
                                <p className="text-sm text-gray-600">系统管理、数据分析</p>
                              </motion.div>
                            </Link>
                          </div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8">
                      <div className="flex items-center gap-2">
                        {currentGuideStep > 1 && (
                          <Button
                            variant="outline"
                            onClick={handleGuidePrev}
                            className="flex items-center gap-2"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            上一步
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          onClick={handleGuideSkip}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          跳过引导
                        </Button>

                        {currentStep.isLast ? (
                          <Button
                            onClick={handleGuideComplete}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
                          >
                            开始使用
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button
                            onClick={handleGuideNext}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
                          >
                            下一步
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center justify-center gap-2 mt-6">
                      {guideSteps.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentGuideStep(index + 1)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index + 1 === currentGuideStep
                              ? 'w-8 bg-gradient-to-r from-blue-600 to-purple-600'
                              : index + 1 < currentGuideStep
                              ? 'bg-blue-600'
                              : 'bg-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 导航栏 */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-white/80 backdrop-blur-md'
      } border-b border-gray-200`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2 cursor-pointer" onClick={() => scrollToSection('hero')}>
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">智教星</span>
              <span className="text-sm text-gray-500 hidden sm:inline">智能教育平台</span>
            </div>

            {/* 桌面导航 */}
            <div className="hidden md:flex items-center space-x-8">
              <button onClick={() => scrollToSection('features')} className="text-gray-600 hover:text-gray-900 transition-colors">
                功能特性
              </button>
              <button onClick={() => scrollToSection('usecases')} className="text-gray-600 hover:text-gray-900 transition-colors">
                使用场景
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="text-gray-600 hover:text-gray-900 transition-colors">
                用户评价
              </button>
              <button onClick={() => scrollToSection('pricing')} className="text-gray-600 hover:text-gray-900 transition-colors">
                价格
              </button>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link to="/login">
                <Button variant="outline">登录</Button>
              </Link>
              <Link to="/welcome">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  免费试用
                </Button>
              </Link>
            </div>

            {/* 移动端菜单按钮 */}
            <button 
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {/* 移动端菜单 */}
        {isMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="md:hidden bg-white border-t border-gray-200"
          >
            <div className="px-4 py-4 space-y-4">
              <button onClick={() => scrollToSection('features')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                功能特性
              </button>
              <button onClick={() => scrollToSection('usecases')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                使用场景
              </button>
              <button onClick={() => scrollToSection('testimonials')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                用户评价
              </button>
              <button onClick={() => scrollToSection('pricing')} className="block w-full text-left text-gray-600 hover:text-gray-900">
                价格
              </button>
              <div className="pt-4 border-t border-gray-200 space-y-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full">登录</Button>
                </Link>
                <Link to="/welcome">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600">免费试用</Button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="hero" ref={heroRef} className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
        </motion.div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-full text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              2026年全新升级 · AI驱动教育新时代
            </motion.div>
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight"
            >
              智教星
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                让教育更智能
              </span>
            </motion.h1>
            
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed"
            >
              基于人工智能技术的全新教学管理平台，为教师提供智能备课工具，
              为学生提供个性化学习体验，为管理者提供数据驱动的决策支持。
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link to="/welcome">
                <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all">
                  开始使用 <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="px-8 py-6 text-lg">
                <Play className="w-5 h-5 mr-2" />
                观看演示
              </Button>
            </motion.div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <button onClick={() => scrollToSection('stats')}>
            <ChevronDown className="w-8 h-8 text-gray-400 animate-bounce" />
          </button>
        </motion.div>
      </section>

      {/* 统计数据 */}
      <section id="stats" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                  className="text-center p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-white border border-gray-100"
                >
                  <div className={`flex items-center justify-center w-14 h-14 ${stat.bg} rounded-xl mx-auto mb-4`}>
                    <Icon className={`w-7 h-7 ${stat.color}`} />
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">{stat.number}</div>
                  <div className="text-gray-600 font-medium">{stat.label}</div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4 mr-2" />
              核心功能
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              强大的智能教育功能
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              智教星提供全方位的智能教育解决方案，覆盖教学、学习、管理全流程
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -8 }}
                >
                  <Card className="h-full border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white">
                    <CardContent className="p-8">
                      <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6`}>
                        <Icon className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                      <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 使用场景 */}
      <section id="usecases" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center px-4 py-2 bg-purple-100 text-purple-800 rounded-full text-sm font-medium mb-6">
              <Users className="w-4 h-4 mr-2" />
              角色定位
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              适合每一位教育参与者
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              无论您是教师、学生还是管理者，智教星都能为您提供专属的智能解决方案
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.15 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <Card className="h-full border-2 border-gray-100 bg-gradient-to-br from-white to-gray-50">
                    <CardHeader className="text-center pb-4">
                      <div className={`w-20 h-20 bg-gradient-to-r ${useCase.color} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                        <Icon className="w-10 h-10 text-white" />
                      </div>
                      <CardTitle className="text-2xl font-bold text-gray-900">{useCase.role}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {useCase.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center text-gray-700">
                            <CheckCircle className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* 用户评价 */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium mb-6">
              <Star className="w-4 h-4 mr-2" />
              用户心声
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              来自用户的真实反馈
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              听听我们的用户怎么说
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -8 }}
              >
                <Card className="h-full border-0 shadow-lg bg-white">
                  <CardContent className="p-8">
                    <div className="flex items-center mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                    <p className="text-gray-700 mb-6 leading-relaxed italic">
                      "{testimonial.content}"
                    </p>
                    <div className="flex items-center">
                      <div className="text-4xl mr-4">{testimonial.avatar}</div>
                      <div>
                        <p className="font-bold text-gray-900">{testimonial.name}</p>
                        <p className="text-sm text-gray-500">{testimonial.role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 演示账号 */}
      <section id="pricing" className="py-24 bg-gradient-to-br from-blue-600 to-purple-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              立即体验智教星
            </h2>
            <p className="text-xl text-blue-100 max-w-2xl mx-auto mb-12">
              使用演示账号快速体验不同角色的功能
            </p>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <DemoAccountCard
                title="系统管理员"
                username="admin"
                password="admin123"
                description="用户管理、系统配置、数据分析"
                color="red"
                icon="👨‍💼"
              />
              <DemoAccountCard
                title="示例教师"
                username="teacher"
                password="teacher123"
                description="课程管理、内容生成、学情分析"
                color="blue"
                icon="👩‍🏫"
              />
              <DemoAccountCard
                title="示例学生"
                username="student"
                password="student123"
                description="在线学习、练习评测、AI问答"
                color="green"
                icon="👨‍🎓"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-12"
            >
              <Link to="/welcome">
                <Button size="lg" className="bg-white text-purple-700 hover:bg-gray-100 px-10 py-6 text-lg shadow-xl">
                  开始免费试用 <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="bg-gray-900 text-white pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold">智教星</span>
              </div>
              <p className="text-gray-400 mb-6">
                智能教育平台，让学习更高效。AI驱动的教育新时代。
              </p>
              <div className="flex space-x-4">
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
                  <Globe className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
                  <MessageSquare className="w-5 h-5" />
                </a>
                <a href="#" className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 transition-colors">
                  <Share2 className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-6">产品</h3>
              <ul className="space-y-4">
                <li><a href="#features" className="text-gray-400 hover:text-white transition-colors">功能特性</a></li>
                <li><a href="#usecases" className="text-gray-400 hover:text-white transition-colors">使用场景</a></li>
                <li><a href="#pricing" className="text-gray-400 hover:text-white transition-colors">价格方案</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">更新日志</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-6">支持</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">帮助中心</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">API文档</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">社区论坛</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">联系我们</a></li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-6">公司</h3>
              <ul className="space-y-4">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">关于我们</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">团队介绍</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">隐私政策</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">服务条款</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm mb-4 md:mb-0">
                © 2026 智教星. 保留所有权利。
              </p>
              <p className="text-gray-400 text-sm">
                联系邮箱：<a href="mailto:3355299179@qq.com" className="text-white hover:underline">3355299179@qq.com</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

function DemoAccountCard({ title, username, password, description, color, icon }) {
  const colorClasses = {
    red: 'border-red-200 bg-red-50/90 hover:bg-red-100/90',
    blue: 'border-blue-200 bg-blue-50/90 hover:bg-blue-100/90',
    green: 'border-green-200 bg-green-50/90 hover:bg-green-100/90'
  }

  return (
    <Card className={`${colorClasses[color]} border-2 hover:shadow-xl transition-all duration-300 backdrop-blur-sm`}>
      <CardContent className="p-6 text-center">
        <div className="text-5xl mb-4">{icon}</div>
        <h3 className="text-xl font-semibold mb-3 text-gray-900">{title}</h3>
        <div className="space-y-3 mb-4">
          <div className="text-sm">
            <span className="font-medium text-gray-700">用户名：</span>
            <code className="bg-white/80 px-3 py-1 rounded text-gray-900 font-mono">{username}</code>
          </div>
          <div className="text-sm">
            <span className="font-medium text-gray-700">密码：</span>
            <code className="bg-white/80 px-3 py-1 rounded text-gray-900 font-mono">{password}</code>
          </div>
        </div>
        <p className="text-gray-600 text-sm mb-5">{description}</p>
        <Link to="/login">
          <Button size="sm" className="w-full bg-gray-900 hover:bg-gray-800 text-white">
            快速登录
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
