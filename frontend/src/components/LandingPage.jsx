/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Users, BookOpen, Brain, GraduationCap, BarChart3,
  MessageSquare, Shield, Clock, Star,
  Play, Menu, X, ArrowRight, Target, Lightbulb,
  Zap, CheckCircle, PenTool, LayoutDashboard,
  FileText, Presentation, TrendingUp, Layers,
  ChevronLeft, ChevronRight, Quote, Activity, Award
} from 'lucide-react'

function ParticleBackground() {
  const canvasRef = useRef(null)
  const animRef = useRef(null)
  const particlesRef = useRef([])
  const mouseRef = useRef({ x: -1000, y: -1000 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let width = 0
    let height = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.parentElement.getBoundingClientRect()
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = width + 'px'
      canvas.style.height = height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const count = Math.min(Math.floor((window.innerWidth * window.innerHeight) / 18000), 80)
    const particles = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * (width || window.innerWidth),
        y: Math.random() * (height || window.innerHeight),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
      })
    }
    particlesRef.current = particles

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    resize()
    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', handleMouse)
    canvas.addEventListener('mouseleave', () => { mouseRef.current = { x: -1000, y: -1000 } })

    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      const mouse = mouseRef.current
      const maxDist = 120

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > width) p.vx *= -1
        if (p.y < 0 || p.y > height) p.vy *= -1

        const dx = mouse.x - p.x
        const dy = mouse.y - p.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        let drawOpacity = p.opacity
        if (dist < maxDist) {
          drawOpacity = p.opacity + (1 - dist / maxDist) * 0.4
          p.x += dx * 0.002
          p.y += dy * 0.002
        }

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(212, 168, 83, ${drawOpacity})`
        ctx.fill()

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j]
          const ddx = p.x - p2.x
          const ddy = p.y - p2.y
          const d = Math.sqrt(ddx * ddx + ddy * ddy)
          if (d < 100) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(212, 168, 83, ${0.06 * (1 - d / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouse)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 0 }}
    />
  )
}

const brandColors = {
  primary: '#d4a853',
  primaryDark: '#c49a4a',
  primaryLight: '#e9c46a',
  bg: '#faf8f5',
  surface: '#ffffff',
  elevated: '#f5f2ee',
  textPrimary: '#2d2a26',
  textSecondary: '#6b6560',
  textMuted: '#9a9590',
  border: '#e8e4df',
  borderLight: '#f0ece7',
}

const useCaseCards = [
  { id: 1, title: '教学方案', subtitle: '智能生成教案与课件', icon: FileText, gradient: 'from-amber-400 to-amber-500' },
  { id: 2, title: '课堂演示', subtitle: '交互式课堂展示', icon: Presentation, gradient: 'from-yellow-500 to-amber-500' },
  { id: 3, title: '学情报告', subtitle: '数据驱动教学分析', icon: BarChart3, gradient: 'from-amber-500 to-yellow-600' },
  { id: 4, title: '研究课题', subtitle: 'AI辅助课题研究', icon: Lightbulb, gradient: 'from-yellow-400 to-amber-500' },
  { id: 5, title: '课程展示', subtitle: '精品课程内容呈现', icon: BookOpen, gradient: 'from-amber-500 to-amber-600' },
  { id: 6, title: '项目规划', subtitle: '教学项目智能规划', icon: Target, gradient: 'from-amber-400 to-yellow-500' },
]

const partnerLogos = [
  '清华大学', '北京大学', '复旦大学', '浙江大学',
  '上海交大', '南京大学', '武汉大学', '中山大学',
  '华中科技', '四川大学', '同济大学', '厦门大学',
]

const coreFeatures = [
  {
    tag: 'AI COURSE GENERATION',
    title: 'AI 课程生成向导',
    description: '三阶段智能生成：参数配置 → 内容生成（教学大纲/核心内容/配套习题/课件材料） → 审核优化，一键产出完整课程体系。',
    icon: Sparkles,
    mockupType: 'wizard',
  },
  {
    tag: 'AI TUTOR SYSTEM',
    title: 'AI 智能助教',
    description: '四合一助教系统：答疑解惑、知识讲解、学习引导、学习诊断，基于 Spark4.0 Ultra 大模型实时响应，支持课程关联与话题记忆。',
    icon: Brain,
    mockupType: 'tutor',
  },
  {
    tag: 'SMART MISTAKE BOOK',
    title: '智能错题本',
    description: 'AI 自动分析错因，生成知识图谱与错误类型统计，靶向治疗推送针对性练习，编程题支持代码 Diff 对比，支持导出与复习出题。',
    icon: Target,
    mockupType: 'mistake',
  },
  {
    tag: 'LEARNING PROFILE',
    title: '学习画像构建',
    description: 'AI 对话式采集知识基础、认知风格、学习节奏、兴趣领域等多维数据，生成雷达图画像，驱动个性化学习路径推荐。',
    icon: GraduationCap,
    mockupType: 'profile',
  },
]

const enterpriseFeatures = [
  {
    icon: BarChart3,
    title: 'AI 智能分析',
    description: '流失预测、内容趋势、教学归因、资源优化等多维洞察，支持生成周报/月报/季报。',
  },
  {
    icon: Shield,
    title: 'AI 内容审核',
    description: '质量评分、版本对比、审核机制、操作日志，确保 AI 生成内容的质量与安全。',
  },
  {
    icon: Users,
    title: '实时课堂互动',
    description: '基于 WebSocket 的举手提问、问答讨论，教师端与学生端实时双向通信。',
  },
  {
    icon: Clock,
    title: '视频笔记联动',
    description: '视频播放器与笔记系统深度联动，时间轴标记笔记点，点击即跳转。',
  },
  {
    icon: BookOpen,
    title: '个性化学习路径',
    description: 'AI 驱动学习规划，按优先级/类型/状态过滤，推荐资源与知识图谱节点展开。',
  },
  {
    icon: Star,
    title: '学习成就系统',
    description: '多类别多等级成就徽章，学习时长/练习评测/答题正确率/错题攻克全面追踪。',
  },
]

const testimonials = [
  {
    name: '张明华',
    role: '高中数学教师',
    content: '智教星的错题诊疗功能精准定位了学生的知识薄弱点，靶向练习让复习效率提升了3倍！',
    avatar: '张',
    accent: '#d4a853',
  },
  {
    name: '李思远',
    role: '高三学生',
    content: '个性化学习路径和AI问答功能帮我快速提升了数学成绩。感觉就像有一个24小时在线的私人辅导老师。',
    avatar: '李',
    accent: '#c49a4a',
  },
  {
    name: '王建国',
    role: '学校管理员',
    content: '数据面板让我能够实时掌握全校教学情况，管理效率大幅提升。决策有了数据支撑，更有信心了。',
    avatar: '王',
    accent: '#e9c46a',
  },
  {
    name: '陈晓琳',
    role: '初中英语教师',
    content: '多智能体协同的诊断报告比我自己分析还准确，每个学生都能得到真正个性化的学习方案。',
    avatar: '陈',
    accent: '#b8860b',
  },
  {
    name: '赵伟',
    role: '教育局教研员',
    content: '智教星将我们零散的错题管理变成了系统化的诊疗流程，自适应推送让每个学生都在最合适的难度上练习。',
    avatar: '赵',
    accent: '#D97706',
  },
]

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

function useScrollDirection() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])
  return scrolled
}

function SectionWrapper({ children, id, className = '' }) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.section
      id={id}
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={staggerContainer}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function FeatureMockup({ type }) {
  const base = { backgroundColor: brandColors.bg, borderColor: brandColors.borderLight }

  if (type === 'wizard') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#faf8f5] to-[#f5f2ee] p-5 flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          {['参数配置', '内容生成', '审核优化'].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: i <= 1 ? brandColors.primary : brandColors.elevated,
                  color: i <= 1 ? '#fff' : brandColors.textMuted,
                }}
              >
                {i + 1}
              </div>
              <span className="text-[11px] font-medium" style={{ color: i <= 1 ? brandColors.textPrimary : brandColors.textMuted }}>
                {step}
              </span>
              {i < 2 && <ArrowRight className="w-3 h-3" style={{ color: brandColors.textMuted }} />}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-3 space-y-2" style={base}>
            <p className="text-[10px] font-semibold" style={{ color: brandColors.textMuted }}>课程信息</p>
            <div className="h-2 rounded-full" style={{ backgroundColor: brandColors.textPrimary, width: '60%' }} />
            <div className="h-1.5 rounded-full" style={{ backgroundColor: brandColors.border, width: '80%' }} />
            <div className="h-1.5 rounded-full" style={{ backgroundColor: brandColors.border, width: '45%' }} />
            <div className="flex gap-2 mt-2">
              <div className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: brandColors.primary + '15', color: brandColors.primary }}>高中</div>
              <div className="px-2 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: brandColors.elevated, color: brandColors.textMuted }}>数学</div>
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-2" style={base}>
            <p className="text-[10px] font-semibold" style={{ color: brandColors.textMuted }}>生成内容</p>
            {['教学大纲', '核心内容', '配套习题', '课件材料'].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 rounded flex items-center justify-center" style={{ backgroundColor: i < 3 ? '#28c840' + '20' : brandColors.elevated }}>
                  <CheckCircle className="w-2.5 h-2.5" style={{ color: i < 3 ? '#28c840' : brandColors.textMuted }} />
                </div>
                <span className="text-[10px]" style={{ color: i < 3 ? brandColors.textPrimary : brandColors.textMuted }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <div className="px-4 py-1.5 rounded-lg text-[11px] font-semibold text-white" style={{ backgroundColor: brandColors.primary }}>
            开始生成
          </div>
        </div>
      </div>
    )
  }

  if (type === 'tutor') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#faf8f5] to-[#f5f2ee] flex flex-col">
        <div className="flex border-b" style={{ borderColor: brandColors.border }}>
          {['答疑解惑', '知识讲解', '学习引导', '学习诊断'].map((tab, i) => (
            <div
              key={i}
              className="flex-1 py-2.5 text-center text-[11px] font-medium border-b-2"
              style={{
                borderColor: i === 0 ? brandColors.primary : 'transparent',
                color: i === 0 ? brandColors.primary : brandColors.textMuted,
                backgroundColor: i === 0 ? brandColors.surface : 'transparent',
              }}
            >
              {tab}
            </div>
          ))}
        </div>
        <div className="flex-1 p-4 space-y-3 overflow-hidden">
          <div className="flex justify-end">
            <div className="max-w-[70%] rounded-xl rounded-tr-sm px-3 py-2 text-[11px]" style={{ backgroundColor: brandColors.primary + '15', color: brandColors.textPrimary }}>
              函数 f(x)=x²+2x-3 的极值点怎么求？
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl rounded-tl-sm px-3 py-2 space-y-1.5" style={{ backgroundColor: brandColors.surface, border: `1px solid ${brandColors.borderLight}` }}>
              <p className="text-[11px]" style={{ color: brandColors.textPrimary }}>求导得 f'(x)=2x+2</p>
              <p className="text-[11px]" style={{ color: brandColors.textPrimary }}>令 f'(x)=0，解得 x=-1</p>
              <div className="flex items-center gap-1 pt-1">
                <Sparkles className="w-2.5 h-2.5" style={{ color: brandColors.primary }} />
                <span className="text-[9px] font-medium" style={{ color: brandColors.primary }}>AI 解析中</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <div className="max-w-[65%] rounded-xl rounded-tr-sm px-3 py-2 text-[11px]" style={{ backgroundColor: brandColors.primary + '15', color: brandColors.textPrimary }}>
              能画个图帮我理解吗？
            </div>
          </div>
        </div>
        <div className="px-4 py-2.5 border-t flex items-center gap-2" style={{ borderColor: brandColors.border }}>
          <div className="flex-1 h-7 rounded-lg px-3 flex items-center text-[11px]" style={{ backgroundColor: brandColors.elevated, color: brandColors.textMuted }}>
            输入你的问题...
          </div>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.primary }}>
            <ArrowRight className="w-3.5 h-3.5 text-white" />
          </div>
        </div>
      </div>
    )
  }

  if (type === 'mistake') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#faf8f5] to-[#f5f2ee] p-4 flex flex-col">
        <div className="flex gap-3 mb-3">
          <div className="flex-1 rounded-lg border p-2.5" style={base}>
            <p className="text-[9px] font-semibold mb-1.5" style={{ color: brandColors.textMuted }}>错误类型分布</p>
            <div className="space-y-1.5">
              {[
                { label: '概念理解', pct: 45, color: '#ef4444' },
                { label: '计算失误', pct: 30, color: brandColors.primary },
                { label: '审题不清', pct: 25, color: '#8b5cf6' },
              ].map((bar, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[9px] w-12 text-right" style={{ color: brandColors.textMuted }}>{bar.label}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: brandColors.elevated }}>
                    <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 rounded-lg border p-2.5" style={base}>
            <p className="text-[9px] font-semibold mb-1.5" style={{ color: brandColors.textMuted }}>知识图谱</p>
            <div className="flex items-center justify-center h-[calc(100%-20px)]">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: brandColors.primary + '40' }} />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: brandColors.primary }}>函</div>
                <div className="absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: '#8b5cf6' }}>导</div>
                <div className="absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: '#ef4444' }}>积</div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full" style={{ backgroundColor: brandColors.primary + '30' }} />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 rounded-lg border p-2.5" style={base}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] font-semibold" style={{ color: brandColors.textMuted }}>靶向练习推荐</p>
            <span className="text-[8px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: brandColors.primary + '12', color: brandColors.primary }}>AI 推荐</span>
          </div>
          <div className="space-y-1.5">
            {['求函数极值的步骤', '导数几何意义', '定积分计算方法'].map((item, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: brandColors.elevated }}>
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: brandColors.primary }} />
                <span className="text-[10px]" style={{ color: brandColors.textPrimary }}>{item}</span>
                <div className="flex-1" />
                <span className="text-[8px]" style={{ color: brandColors.textMuted }}>优先级 {3 - i}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (type === 'profile') {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#faf8f5] to-[#f5f2ee] p-4 flex gap-3">
        <div className="w-[45%] rounded-lg border p-3 flex flex-col" style={base}>
          <p className="text-[9px] font-semibold mb-2" style={{ color: brandColors.textMuted }}>AI 对话采集</p>
          <div className="flex-1 space-y-2 overflow-hidden">
            <div className="rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: brandColors.primary + '10', color: brandColors.textSecondary }}>
              你更偏好哪种学习方式？
            </div>
            <div className="rounded-lg px-2.5 py-1.5 text-[10px] text-right" style={{ backgroundColor: brandColors.surface, color: brandColors.textPrimary, border: `1px solid ${brandColors.borderLight}` }}>
              我喜欢看图和视频学习
            </div>
            <div className="rounded-lg px-2.5 py-1.5 text-[10px]" style={{ backgroundColor: brandColors.primary + '10', color: brandColors.textSecondary }}>
              你的学习节奏偏好？
            </div>
            <div className="rounded-lg px-2.5 py-1.5 text-[10px] text-right" style={{ backgroundColor: brandColors.surface, color: brandColors.textPrimary, border: `1px solid ${brandColors.borderLight}` }}>
              稳扎稳打，每天固定时间
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <div className="flex-1 h-5 rounded px-2 flex items-center text-[9px]" style={{ backgroundColor: brandColors.elevated, color: brandColors.textMuted }}>
              继续回答...
            </div>
          </div>
        </div>
        <div className="flex-1 rounded-lg border p-3 flex flex-col items-center justify-center" style={base}>
          <p className="text-[9px] font-semibold mb-3" style={{ color: brandColors.textMuted }}>学习画像雷达图</p>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <polygon
                points="50,10 90,35 80,80 20,80 10,35"
                fill="none"
                stroke={brandColors.border}
                strokeWidth="0.5"
              />
              <polygon
                points="50,25 75,42 68,68 32,68 25,42"
                fill="none"
                stroke={brandColors.border}
                strokeWidth="0.5"
              />
              <polygon
                points="50,18 85,38 75,75 25,75 15,38"
                fill={brandColors.primary + '20'}
                stroke={brandColors.primary}
                strokeWidth="1"
              />
              {[
                { x: 50, y: 10, label: '知识' },
                { x: 90, y: 35, label: '视觉' },
                { x: 80, y: 80, label: '节奏' },
                { x: 20, y: 80, label: '兴趣' },
                { x: 10, y: 35, label: '目标' },
              ].map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="2" fill={brandColors.primary} />
                  <text x={pt.x} y={pt.y - 5} textAnchor="middle" fontSize="5" fill={brandColors.textMuted}>{pt.label}</text>
                </g>
              ))}
            </svg>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#8b5cf6' + '15', color: '#8b5cf6' }}>视觉型</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded" style={{ backgroundColor: brandColors.primary + '15', color: brandColors.primary }}>稳扎稳打</span>
          </div>
        </div>
      </div>
    )
  }

  return null
}

function FeatureShowcase() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <div ref={ref} className="space-y-0">
      {coreFeatures.map((feature, index) => {
        const Icon = feature.icon
        const isReversed = index % 2 !== 0
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : { opacity: 0 }}
            transition={{ duration: 0.6, delay: index * 0.15 }}
          >
            <div
              className={`flex flex-col ${
                isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'
              } items-center gap-12 lg:gap-20 py-20 lg:py-28`}
            >
              <div className={`flex-1 max-w-lg ${isReversed ? 'lg:text-right' : ''}`}>
                <motion.p
                  initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 + 0.1 }}
                  className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
                  style={{ color: brandColors.primary }}
                >
                  {feature.tag}
                </motion.p>
                <motion.h3
                  initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 + 0.2 }}
                  className="text-3xl lg:text-4xl font-bold mb-6"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: brandColors.textPrimary }}
                >
                  {feature.title}
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.15 + 0.3 }}
                  className="text-base leading-relaxed"
                  style={{ color: brandColors.textSecondary }}
                >
                  {feature.description}
                </motion.p>
              </div>
              <motion.div
                initial={{ opacity: 0, x: isReversed ? -40 : 40, scale: 0.95 }}
                animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
                transition={{ duration: 0.7, delay: index * 0.15 + 0.2 }}
                className="flex-1 w-full max-w-xl"
              >
                <div
                  className="relative rounded-2xl overflow-hidden shadow-2xl"
                  style={{ aspectRatio: '16/10' }}
                >
                  <FeatureMockup type={feature.mockupType} />
                </div>
              </motion.div>
            </div>
            {index < coreFeatures.length - 1 && (
              <div className="w-full h-px" style={{ backgroundColor: brandColors.border }} />
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function TestimonialCarousel() {
  const [current, setCurrent] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const prev = () => setCurrent((c) => (c - 1 + testimonials.length) % testimonials.length)
  const next = () => setCurrent((c) => (c + 1) % testimonials.length)

  return (
    <div ref={ref} className="relative max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-2xl p-8 lg:p-12"
          style={{ backgroundColor: brandColors.surface }}
        >
          <Quote className="w-8 h-8 mb-6" style={{ color: brandColors.primary + '40' }} />
          <p
            className="text-lg lg:text-xl leading-relaxed mb-8 italic"
            style={{ color: brandColors.textPrimary, fontFamily: "'Inter', sans-serif" }}
          >
            "{testimonials[current].content}"
          </p>
          <div className="h-px mb-6" style={{ backgroundColor: brandColors.border }} />
          <div className="flex items-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-4"
              style={{ backgroundColor: testimonials[current].accent }}
            >
              {testimonials[current].avatar}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: brandColors.textPrimary }}>
                {testimonials[current].name}
              </p>
              <p className="text-xs" style={{ color: brandColors.textMuted }}>
                {testimonials[current].role}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-center gap-4 mt-8">
        <button
          onClick={prev}
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors duration-200 hover:bg-[#f5f2ee]"
          style={{ borderColor: brandColors.border }}
        >
          <ChevronLeft className="w-4 h-4" style={{ color: brandColors.textSecondary }} />
        </button>
        <div className="flex gap-2">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === current ? brandColors.primary : brandColors.border,
                transform: i === current ? 'scale(1.3)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-10 h-10 rounded-full border flex items-center justify-center transition-colors duration-200 hover:bg-[#f5f2ee]"
          style={{ borderColor: brandColors.border }}
        >
          <ChevronRight className="w-4 h-4" style={{ color: brandColors.textSecondary }} />
        </button>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const scrolled = useScrollDirection()
  const heroRef = useRef(null)

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setIsMenuOpen(false)
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: brandColors.bg,
        color: brandColors.textPrimary,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* ==================== 导航栏 ==================== */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#faf8f5]/90 backdrop-blur-xl border-b shadow-sm'
            : 'bg-transparent'
        }`}
        style={{ borderColor: scrolled ? brandColors.border : 'transparent' }}
      >
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: brandColors.primary }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14.5 9H22L16 13.5L18 21L12 17L6 21L8 13.5L2 9H9.5L12 2Z" fill="white" fillOpacity="0.9" />
                  <path d="M4 19V14C4 12.5 5.5 11 7 11C8.5 11 9 12 9 12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M20 19V14C20 12.5 18.5 11 17 11C15.5 11 15 12 15 12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span
                className="text-lg font-bold tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                智教星
              </span>
            </div>

          <div className="hidden md:flex items-center gap-8">
            {[
              { id: 'features', label: '功能' },
              { id: 'showcase', label: '产品' },
              { id: 'enterprise', label: '企业' },
              { id: 'testimonials', label: '评价' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="text-sm font-medium transition-colors duration-200 hover:text-amber-600"
                style={{ color: brandColors.textSecondary }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Link to="/login">
              <Button
                variant="ghost"
                className="text-sm font-medium"
                style={{ color: brandColors.textSecondary }}
              >
                登录
              </Button>
            </Link>
            <Link to="/welcome">
              <Button
                className="text-sm font-medium text-white px-5 h-9 rounded-lg transition-all duration-200 hover:scale-[1.02]"
                style={{ backgroundColor: brandColors.primary }}
              >
                开始使用
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2"
            style={{ color: brandColors.textPrimary }}
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-[#faf8f5]/95 backdrop-blur-xl border-t"
              style={{ borderColor: brandColors.border }}
            >
              <div className="px-6 py-6 space-y-4">
                {[
                  { id: 'features', label: '功能特性' },
                  { id: 'showcase', label: '产品展示' },
                  { id: 'enterprise', label: '企业功能' },
                  { id: 'testimonials', label: '用户评价' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className="block w-full text-left text-sm py-2 font-medium"
                    style={{ color: brandColors.textSecondary }}
                  >
                    {item.label}
                  </button>
                ))}
                <div className="pt-4 space-y-3" style={{ borderTopColor: brandColors.border, borderTopWidth: 1 }}>
                  <Link to="/login">
                    <Button variant="outline" className="w-full rounded-lg">登录</Button>
                  </Link>
                  <Link to="/welcome">
                    <Button className="w-full text-white rounded-lg" style={{ backgroundColor: brandColors.primary }}>
                      开始使用
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ==================== Hero 首屏 ==================== */}
      <section
        id="hero"
        ref={heroRef}
        className="relative pt-16 overflow-hidden"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      >
        <ParticleBackground />
        <div className="max-w-[1200px] mx-auto px-6 py-16 lg:py-24 relative" style={{ zIndex: 1 }}>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Text Content */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="text-left"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 text-xs font-medium"
                style={{
                  borderColor: brandColors.primary + '20',
                  backgroundColor: brandColors.primary + '08',
                  color: brandColors.primary,
                }}
              >
                <Zap className="w-3 h-3" />
                基于 Spark4.0 Ultra 大模型 · 多智能体协同
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
                className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: brandColors.textPrimary }}
              >
                自适应
                <br />
                <span style={{ color: brandColors.primary }}>错题诊疗系统</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
                className="text-base lg:text-lg max-w-[500px] mb-10 leading-relaxed"
                style={{ color: brandColors.textSecondary }}
              >
                智教星——基于多智能体的自适应错题诊疗系统，精准诊断错因，靶向推送练习，让每个学生获得个性化学习路径。
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link to="/welcome">
                  <Button
                    size="lg"
                    className="text-base font-semibold text-white px-8 py-6 rounded-[10px] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                    style={{ backgroundColor: brandColors.textPrimary }}
                  >
                    开始使用 <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-base font-semibold px-8 py-6 rounded-[10px] transition-all duration-200 hover:scale-[1.02]"
                  style={{ color: brandColors.textSecondary }}
                >
                  <Play className="w-4 h-4 mr-2" />
                  观看演示
                </Button>
              </motion.div>
            </motion.div>

            {/* Right: Product Demo */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              className="relative"
            >
              <div
                className="rounded-2xl overflow-hidden border"
                style={{
                  borderColor: brandColors.border,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
                }}
              >
                {/* Main content */}
                <div className="bg-white aspect-[4/3] overflow-hidden">
                  <div className="flex h-full">
                    {/* Signature Sidebar */}
                    <div className="w-[170px] flex-shrink-0 flex flex-col border-r" style={{ borderColor: brandColors.borderLight, background: 'linear-gradient(180deg, #2d2a26 0%, #3d3a35 100%)' }}>
                      {/* Brand header */}
                      <div className="p-3 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2.5 mb-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: brandColors.primary }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.5 9H22L16 13.5L18 21L12 17L6 21L8 13.5L2 9H9.5L12 2Z" fill="white" /></svg>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-white leading-tight">智教星</p>
                            <p className="text-[6px] text-white/40 leading-tight">自适应错题诊疗系统</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ backgroundColor: brandColors.primary + '20' }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#28c840' }} />
                          <span className="text-[8px] font-medium" style={{ color: brandColors.primary }}>多智能体协同在线</span>
                        </div>
                      </div>

                      {/* Core modules */}
                      <div className="flex-1 p-2 overflow-hidden">
                        <p className="text-[7px] font-semibold text-white/25 uppercase tracking-wider px-2 mb-1.5">诊疗中心</p>
                        {[
                          { icon: Target, label: '错题诊疗', active: true, badge: null },
                          { icon: Brain, label: '智能诊断', active: false, badge: 'AI' },
                          { icon: Sparkles, label: '靶向练习', active: false, badge: null },
                          { icon: BarChart3, label: '学情画像', active: false, badge: '新' },
                        ].map((item, i) => {
                          const Icon = item.icon
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-2 px-2 py-2 rounded-lg mb-0.5 cursor-pointer transition-colors"
                              style={{ backgroundColor: item.active ? brandColors.primary + '20' : 'transparent' }}
                            >
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: item.active ? brandColors.primary : 'rgba(255,255,255,0.08)' }}
                              >
                                <Icon className="w-3 h-3" style={{ color: item.active ? '#fff' : 'rgba(255,255,255,0.5)' }} />
                              </div>
                              <span className="text-[9px] font-medium flex-1" style={{ color: item.active ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                                {item.label}
                              </span>
                              {item.badge && (
                                <span
                                  className="text-[7px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor: item.badge === 'AI' ? brandColors.primary + '30' : 'rgba(255,255,255,0.1)',
                                    color: item.badge === 'AI' ? brandColors.primary : 'rgba(255,255,255,0.5)',
                                  }}
                                >
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          )
                        })}

                        <p className="text-[7px] font-semibold text-white/25 uppercase tracking-wider px-2 mb-1.5 mt-3">学习工具</p>
                        {[
                          { icon: BookOpen, label: '课程学习' },
                          { icon: GraduationCap, label: 'AI 助教' },
                          { icon: FileText, label: '学习笔记' },
                          { icon: Award, label: '学习成就' },
                        ].map((item, i) => {
                          const Icon = item.icon
                          return (
                            <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg mb-0.5">
                              <Icon className="w-3 h-3 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                              <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* User section */}
                      <div className="p-2.5 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ backgroundColor: brandColors.primary, color: '#fff' }}>李</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[8px] font-medium text-white/80 truncate">李同学</p>
                            <p className="text-[6px] text-white/30">高二 · 数学</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Main content area - Mistake Diagnosis Dashboard */}
                    <div className="flex-1 p-4 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold" style={{ color: brandColors.textPrimary }}>错题诊疗中心</p>
                          <p className="text-[10px]" style={{ color: brandColors.textMuted }}>多智能体协同 · 精准诊断 · 靶向治疗</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 rounded-md text-[8px] font-medium flex items-center gap-1" style={{ backgroundColor: brandColors.primary + '10', color: brandColors.primary }}>
                            <Brain className="w-2.5 h-2.5" />
                            3 个智能体协作中
                          </div>
                        </div>
                      </div>

                      {/* Stats cards */}
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {[
                          { icon: Target, label: '待诊疗错题', value: '23', color: '#dc2626' },
                          { icon: CheckCircle, label: '已攻克', value: '156', color: '#16a34a' },
                          { icon: Brain, label: '诊断准确率', value: '94%', color: brandColors.primary },
                          { icon: TrendingUp, label: '掌握度提升', value: '+38%', color: '#8b5cf6' },
                        ].map((stat, i) => {
                          const Icon = stat.icon
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.5 + i * 0.08, duration: 0.4 }}
                              className="rounded-lg border p-2.5"
                              style={{ backgroundColor: brandColors.surface, borderColor: brandColors.borderLight }}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="w-4 h-4" style={{ color: stat.color }} />
                                <div>
                                  <p className="text-[8px]" style={{ color: brandColors.textMuted }}>{stat.label}</p>
                                  <p className="text-sm font-bold leading-tight" style={{ color: brandColors.textPrimary }}>{stat.value}</p>
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {/* Two-column: Diagnosis + Targeted Practice */}
                      <div className="grid grid-cols-5 gap-2 mb-2">
                        {/* AI Diagnosis - core feature */}
                        <div className="col-span-3 rounded-lg border p-3" style={{ backgroundColor: brandColors.surface, borderColor: brandColors.borderLight }}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                              <Brain className="w-3 h-3" style={{ color: brandColors.primary }} />
                              <p className="text-[9px] font-semibold" style={{ color: brandColors.textPrimary }}>AI 错因诊断</p>
                            </div>
                            <span className="text-[7px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#dc2626' + '12', color: '#dc2626' }}>3 题待诊</span>
                          </div>
                          <div className="space-y-1.5">
                            {[
                              { question: 'f(x)=x²+2x-3 极值', error: '概念理解偏差', agent: '诊断智能体', severity: 'high', color: '#dc2626' },
                              { question: '∫sin²x dx 计算', error: '公式记忆错误', agent: '分析智能体', severity: 'medium', color: '#ea580c' },
                              { question: 'P(A|B) 条件概率', error: '审题不清', agent: '归因智能体', severity: 'low', color: brandColors.primary },
                            ].map((item, i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ backgroundColor: brandColors.elevated }}>
                                <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-[8px] font-medium truncate" style={{ color: brandColors.textPrimary }}>{item.question}</p>
                                  <p className="text-[7px]" style={{ color: item.color }}>{item.error}</p>
                                </div>
                                <span className="text-[6px] px-1 py-0.5 rounded" style={{ backgroundColor: brandColors.primary + '12', color: brandColors.primary }}>{item.agent}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Targeted Practice */}
                        <div className="col-span-2 rounded-lg border p-3" style={{ backgroundColor: brandColors.surface, borderColor: brandColors.borderLight }}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Sparkles className="w-3 h-3" style={{ color: brandColors.primary }} />
                            <p className="text-[9px] font-semibold" style={{ color: brandColors.textPrimary }}>靶向练习</p>
                          </div>
                          <div className="space-y-2">
                            {[
                              { topic: '函数极值求法', priority: '高', pct: 35, color: '#dc2626' },
                              { topic: '积分公式应用', priority: '中', pct: 60, color: '#ea580c' },
                              { topic: '条件概率计算', priority: '低', pct: 82, color: '#16a34a' },
                            ].map((item, i) => (
                              <div key={i}>
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[8px]" style={{ color: brandColors.textSecondary }}>{item.topic}</span>
                                  <span className="text-[7px] font-medium" style={{ color: item.color }}>{item.priority}</span>
                                </div>
                                <div className="h-1 rounded-full" style={{ backgroundColor: brandColors.elevated }}>
                                  <div className="h-full rounded-full" style={{ width: `${item.pct}%`, backgroundColor: item.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom row: Knowledge Graph + Agent Status */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border p-2.5" style={{ backgroundColor: brandColors.surface, borderColor: brandColors.borderLight }}>
                          <p className="text-[9px] font-semibold mb-1.5" style={{ color: brandColors.textPrimary }}>知识图谱覆盖</p>
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 flex-shrink-0">
                              <svg viewBox="0 0 40 40" className="w-full h-full">
                                <circle cx="20" cy="20" r="16" fill="none" stroke={brandColors.border} strokeWidth="3" />
                                <circle cx="20" cy="20" r="16" fill="none" stroke={brandColors.primary} strokeWidth="3" strokeDasharray={`${16 * 2 * Math.PI * 0.72} ${16 * 2 * Math.PI}`} transform="rotate(-90 20 20)" />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color: brandColors.primary }}>72%</span>
                            </div>
                            <div className="space-y-1">
                              {['函数', '导数', '积分'].map((node, i) => (
                                <div key={i} className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: [brandColors.primary, '#8b5cf6', '#059669'][i] }} />
                                  <span className="text-[7px]" style={{ color: brandColors.textMuted }}>{node}</span>
                                  <span className="text-[7px] font-medium" style={{ color: brandColors.textSecondary }}>{[85, 68, 54][i]}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border p-2.5" style={{ backgroundColor: brandColors.surface, borderColor: brandColors.borderLight }}>
                          <p className="text-[9px] font-semibold mb-1.5" style={{ color: brandColors.textPrimary }}>智能体状态</p>
                          <div className="space-y-1.5">
                            {[
                              { name: '诊断智能体', status: '分析中', color: '#16a34a' },
                              { name: '归因智能体', status: '就绪', color: brandColors.primary },
                              { name: '推荐智能体', status: '推送中', color: '#8b5cf6' },
                            ].map((agent, i) => (
                              <div key={i} className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: agent.color }} />
                                <span className="text-[8px] flex-1" style={{ color: brandColors.textSecondary }}>{agent.name}</span>
                                <span className="text-[7px]" style={{ color: agent.color }}>{agent.status}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ==================== Horizontal Scroll Tabs ==================== */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
            className="mt-16 lg:mt-20"
          >
            <div
              className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {useCaseCards.slice(0, 5).map((card, index) => {
                const Icon = card.icon
                return (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.08, duration: 0.4 }}
                    whileHover={{ y: -2, transition: { duration: 0.2 } }}
                    className="flex-shrink-0 snap-start cursor-pointer group"
                    style={{ flex: '1 1 0%', minWidth: '180px' }}
                  >
                    <div
                      className="rounded-xl border px-6 py-5 flex items-center gap-4 transition-all duration-200 group-hover:shadow-md"
                      style={{
                        borderColor: brandColors.border,
                        backgroundColor: brandColors.surface,
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: brandColors.primary + '12' }}
                      >
                        <Icon className="w-5 h-5" style={{ color: brandColors.primary }} />
                      </div>
                      <div>
                        <p className="text-base font-semibold" style={{ color: brandColors.textPrimary }}>
                          {card.title}
                        </p>
                        <p className="text-sm" style={{ color: brandColors.textMuted }}>
                          {card.subtitle}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>

          {/* ==================== Stats ==================== */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.9 }}
            className="mt-12 lg:mt-16"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: '5,000+', label: '教学团队' },
                { value: '120万+', label: '课件生成' },
                { value: '98.6%', label: '用户满意度' },
                { value: '60%', label: '备课时间节省' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <p
                    className="text-2xl lg:text-3xl font-bold mb-1"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", color: brandColors.textPrimary }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-sm" style={{ color: brandColors.textMuted }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ==================== 核心功能展示 ==================== */}
      <section id="showcase" className="py-0">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionWrapper id="features" className="pt-20 lg:pt-28 pb-0">
            <motion.div variants={staggerItem} className="text-center mb-4">
              <p
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ color: brandColors.primary }}
              >
                CORE FEATURES
              </p>
              <h2
                className="text-3xl lg:text-4xl font-bold mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                核心功能
              </h2>
              <p className="text-base max-w-lg mx-auto" style={{ color: brandColors.textSecondary }}>
                从错因诊断到靶向练习，智教星覆盖学习诊疗全流程
              </p>
            </motion.div>
          </SectionWrapper>
          <FeatureShowcase />
        </div>
      </section>

      {/* ==================== 企业级特性网格 ==================== */}
      <SectionWrapper
        id="enterprise"
        className="py-20 lg:py-28 px-6"
      >
        <div className="max-w-[1200px] mx-auto">
          <motion.div variants={staggerItem} className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColors.primary }}
            >
              BUILT FOR SERIOUS BUSINESS
            </p>
            <h2
              className="text-3xl lg:text-4xl font-bold mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              为专业教学而建
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: brandColors.textSecondary }}>
              智教星基于多智能体协同，提供企业级功能保障
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {enterpriseFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="group p-8 rounded-2xl border transition-all duration-300 hover:shadow-lg cursor-pointer"
                  style={{
                    backgroundColor: brandColors.bg,
                    borderColor: brandColors.border,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = brandColors.primary + '30'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = brandColors.border
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110"
                    style={{ backgroundColor: brandColors.primary + '10' }}
                  >
                    <Icon className="w-6 h-6" style={{ color: brandColors.primary }} />
                  </div>
                  <h3
                    className="text-lg font-semibold mb-3"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: brandColors.textSecondary }}>
                    {feature.description}
                  </p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ==================== 用户评价区 ==================== */}
      <SectionWrapper
        id="testimonials"
        className="py-20 lg:py-28 px-6"
        style={{ backgroundColor: brandColors.surface }}
      >
        <div className="max-w-[1200px] mx-auto">
          <motion.div variants={staggerItem} className="text-center mb-16">
            <p
              className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: brandColors.primary }}
            >
              TESTIMONIALS
            </p>
            <h2
              className="text-3xl lg:text-[40px] font-bold mb-4"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              你的声誉，就在课件上
            </h2>
            <p className="text-base max-w-lg mx-auto" style={{ color: brandColors.textSecondary }}>
              智教星将多智能体协同与自适应诊疗相结合，精准定位错因，靶向推送个性化练习
            </p>
          </motion.div>

          <motion.div variants={staggerItem}>
            <TestimonialCarousel />
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ==================== CTA Section ==================== */}
      <SectionWrapper className="py-20 lg:py-28 px-6">
        <div className="max-w-[800px] mx-auto text-center">
          <motion.h2
            variants={staggerItem}
            className="text-3xl lg:text-4xl font-bold mb-6"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            准备好开始了吗
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="text-lg mb-10"
            style={{ color: brandColors.textSecondary }}
          >
            加入数万名教育工作者，体验AI驱动的智能教学
          </motion.p>
          <motion.div
            variants={staggerItem}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link to="/welcome">
              <Button
                size="lg"
                className="text-base font-semibold text-white px-10 py-6 rounded-[10px] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
                style={{ backgroundColor: brandColors.primary }}
              >
                免费开始 <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="text-base font-semibold px-10 py-6 rounded-[10px] transition-all duration-200 hover:scale-[1.02]"
              style={{ borderColor: brandColors.border, color: brandColors.textPrimary }}
            >
              了解更多
            </Button>
          </motion.div>
        </div>
      </SectionWrapper>

      {/* ==================== Footer ==================== */}
      <footer className="border-t py-12 px-6" style={{ borderColor: brandColors.border }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: brandColors.primary }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L14.5 9H22L16 13.5L18 21L12 17L6 21L8 13.5L2 9H9.5L12 2Z" fill="white" fillOpacity="0.9" />
                  <path d="M4 19V14C4 12.5 5.5 11 7 11C8.5 11 9 12 9 12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M20 19V14C20 12.5 18.5 11 17 11C15.5 11 15 12 15 12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span
                className="text-sm font-bold tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                智教星
              </span>
            </div>
            <div className="flex gap-8">
              {['功能', '产品', '企业', '评价'].map((item) => (
                <button
                  key={item}
                  className="text-xs font-medium transition-colors hover:text-amber-600"
                  style={{ color: brandColors.textMuted }}
                >
                  {item}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: brandColors.textMuted }}>
              © 2026 智教星——基于多智能体的自适应错题诊疗系统. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
