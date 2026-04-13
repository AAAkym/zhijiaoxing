import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  Sparkles, Users, BookOpen, CheckCircle, 
  ArrowRight, Check, ChevronRight, ChevronLeft, 
  GraduationCap, 
  Zap, 
  BarChart3, 
  MessageSquare, 
  Rocket
} from 'lucide-react'

const steps = [
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

export default function WelcomeGuide() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isCompleted, setIsCompleted] = useState(false)
  const navigate = useNavigate()

  const handleNext = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    setIsCompleted(true)
    setTimeout(() => {
      navigate('/login')
    }, 500)
  }

  const handleSkip = () => {
    navigate('/login')
  }

  const currentStepData = steps.find(step => step.id === currentStep)
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* 顶部导航 */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">智教星</span>
            </div>
            {!isCompleted && (
              <Button variant="ghost" onClick={handleSkip} className="text-gray-600 hover:text-gray-900">
                跳过引导
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* 进度条 */}
      <div className="h-1 bg-gray-200">
        <motion.div
          className={`h-full bg-gradient-to-r from-blue-600 to-purple-600`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
        />
      </div>

      {/* 主要内容 */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
            className="min-h-[calc(100vh-129px)] flex items-center justify-center px-4 py-12"
          >
            <div className="max-w-4xl w-full">
              {/* 步骤指示器 */}
              <div className="flex justify-center gap-2 mb-12">
                {steps.map((step) => (
                  <motion.button
                    key={step.id}
                    onClick={() => setCurrentStep(step.id)}
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      currentStep > step.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : currentStep === step.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white scale-110'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </motion.button>
                ))}
              </div>

              {/* 内容区域 */}
              <Card className="border-0 shadow-xl bg-white/80 backdrop-blur-sm">
                <CardContent className="p-8 md:p-12">
                  <div className="text-center">
                    {/* 图标 */}
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className={`inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-r ${currentStepData.color} mb-8`}
                    >
                      <currentStepData.icon className="w-12 h-12 text-white" />
                    </motion.div>

                    {/* 标题 */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
                    >
                      {currentStepData.title}
                    </motion.h2>

                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-lg text-blue-600 font-medium mb-6"
                    >
                      {currentStepData.subtitle}
                    </motion.p>

                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-gray-600 text-lg mb-10 max-w-2xl mx-auto"
                    >
                      {currentStepData.description}
                    </motion.p>

                    {/* 特性列表 */}
                    {currentStepData.features && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
                      >
                        {currentStepData.features.map((feature, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 + index * 0.1 }}
                            whileHover={{ y: -4 }}
                            className="p-6 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200"
                          >
                            <feature.icon className="w-8 h-8 text-blue-600 mx-auto mb-3" />
                            <p className="font-medium text-gray-900">{feature.text}</p>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}

                    {/* 最后一步的角色选择 */}
                    {currentStepData.isLast && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10"
                      >
                        <RoleCard
                          title="系统管理员"
                          description="用户管理、系统配置、数据分析"
                          icon="👨‍💼"
                          color="red"
                        />
                        <RoleCard
                          title="教师"
                          description="课程管理、内容生成、学情分析"
                          icon="👩‍🏫"
                          color="blue"
                        />
                        <RoleCard
                          title="学生"
                          description="在线学习、练习评测、AI问答"
                          icon="👨‍🎓"
                          color="green"
                        />
                      </motion.div>
                    )}

                    {/* 按钮区域 */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      className="flex flex-col sm:flex-row gap-4 justify-center items-center"
                    >
                      {currentStep > 1 && (
                        <Button
                          variant="outline"
                          size="lg"
                          onClick={handlePrev}
                          className="px-8"
                        >
                          <ChevronLeft className="w-5 h-5 mr-2" />
                          上一步
                        </Button>
                      )}

                      {currentStep < steps.length ? (
                        <Button
                          size="lg"
                          onClick={handleNext}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
                        >
                          下一步
                          <ChevronRight className="w-5 h-5 ml-2" />
                        </Button>
                      ) : (
                        <Button
                          size="lg"
                          onClick={handleComplete}
                          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 px-8"
                        >
                          开始使用
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </Button>
                      )}
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 页脚 */}
      <footer className="bg-white/80 backdrop-blur-md border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-500 text-sm">
            © 2026 智教星. 智能教育平台，让学习更高效。
          </p>
        </div>
      </footer>
    </div>
  )
}

function RoleCard({ title, description, icon, color }) {
  const colorClasses = {
    red: 'border-red-200 bg-red-50 hover:bg-red-100',
    blue: 'border-blue-200 bg-blue-50 hover:bg-blue-100',
    green: 'border-green-200 bg-green-50 hover:bg-green-100'
  }

  return (
    <Card className={`${colorClasses[color]} border-2 transition-all hover:shadow-lg cursor-pointer`}>
      <CardContent className="p-6 text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-lg font-semibold mb-2 text-gray-900">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </CardContent>
    </Card>
  )
}
