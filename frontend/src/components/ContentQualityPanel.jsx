import { useMemo } from 'react'
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle,
  FileSearch,
  Lightbulb,
  Quote,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'

const DIMENSION_META = {
  coverage: {
    label: '覆盖率',
    icon: FileSearch,
    color: 'hsl(217, 91%, 60%)',
    description: '评估内容对主题的覆盖全面程度',
  },
  difficulty: {
    label: '难度',
    icon: BarChart3,
    color: 'hsl(262, 83%, 58%)',
    description: '分析内容的语言复杂度和知识深度',
  },
  factuality: {
    label: '事实性',
    icon: Target,
    color: 'hsl(160, 84%, 39%)',
    description: '验证内容中事实信息的准确性和可靠性',
  },
  citation_integrity: {
    label: '引用完整性',
    icon: Quote,
    color: 'hsl(35, 92%, 50%)',
    description: '检查引用来源的完整性和规范性',
  },
}

function getScoreTone(score) {
  if (score >= 85) return { label: '优秀', color: 'text-green-600', badge: 'bg-green-100 text-green-700' }
  if (score >= 70) return { label: '良好', color: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' }
  if (score >= 50) return { label: '合格', color: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' }
  return { label: '待改进', color: 'text-red-600', badge: 'bg-red-100 text-red-700' }
}

function DimensionCard({ dimensionKey, dimensionData }) {
  const meta = DIMENSION_META[dimensionKey]
  if (!meta || !dimensionData) return null
  const Icon = meta.icon
  const score = dimensionData.score ?? 0
  const tone = getScoreTone(score)

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: meta.color }} />
            {meta.label}
          </span>
          <Badge className={tone.badge}>{tone.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-end justify-between">
          <span className={`text-3xl font-bold ${tone.color}`}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
        <Progress value={score} className="h-2" />
        <p className="text-xs text-muted-foreground">{meta.description}</p>

        {dimensionData.basis && (
          <div className="rounded-md border bg-muted/30 p-2.5">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <FileSearch className="h-3 w-3" />
              评估依据
            </p>
            <p className="text-xs leading-5 text-muted-foreground">{dimensionData.basis}</p>
          </div>
        )}

        {dimensionData.suggestion && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-amber-700">
              <Lightbulb className="h-3 w-3" />
              改进建议
            </p>
            <p className="text-xs leading-5 text-amber-700">{dimensionData.suggestion}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * 内容质量评估面板
 *
 * 基于后端 content_quality_report 数据，展示四个核心评估维度：
 * - 覆盖率：评估内容对主题的覆盖全面程度
 * - 难度：分析内容的语言复杂度和知识深度
 * - 事实性：验证内容中事实信息的准确性和可靠性
 * - 引用完整性：检查引用来源的完整性和规范性
 *
 * @param {Object} props
 * @param {Object} props.report - 后端返回的 content_quality_report 对象
 * @param {string} props.title - 面板标题
 */
export default function ContentQualityPanel({ report, title = '内容质量评估' }) {
  const dimensions = useMemo(() => report?.dimensions || {}, [report])
  const overallScore = report?.overall_score ?? 0

  const radarData = useMemo(() => {
    return Object.entries(DIMENSION_META).map(([key, meta]) => ({
      dimension: meta.label,
      score: dimensions[key]?.score ?? 0,
    }))
  }, [dimensions])

  const barData = useMemo(() => {
    return Object.entries(DIMENSION_META).map(([key, meta]) => ({
      name: meta.label,
      score: dimensions[key]?.score ?? 0,
      fill: meta.color,
    }))
  }, [dimensions])

  const overallTone = getScoreTone(overallScore)

  if (!report || !dimensions || Object.keys(dimensions).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            暂无质量评估数据，生成内容后将自动展示质量评分。
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <TrendingUp />
            {title}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">综合评分</span>
            <span className={`text-2xl font-bold ${overallTone.color}`}>{overallScore}</span>
            <Badge className={overallTone.badge}>{overallTone.label}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* 可视化图表区 */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* 雷达图 */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              维度雷达图
            </p>
            <ChartContainer
              className="h-56"
              config={{
                score: { label: '评分', color: 'hsl(var(--primary))' },
              }}
            >
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="dimension" />
                <Radar
                  dataKey="score"
                  fill="var(--color-score)"
                  fillOpacity={0.3}
                  stroke="var(--color-score)"
                  strokeWidth={2}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </div>

          {/* 柱状图 */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <BarChart3 className="h-3.5 w-3.5" />
              维度评分对比
            </p>
            <ChartContainer
              className="h-56"
              config={{
                score: { label: '评分', color: 'hsl(var(--primary))' },
              }}
            >
              <BarChart data={barData} layout="vertical">
                <CartesianGrid horizontal={false} />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis type="category" dataKey="name" width={70} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="score" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <Separator />

        {/* 四维度详细卡片 */}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(DIMENSION_META).map(([key]) => (
            <DimensionCard key={key} dimensionKey={key} dimensionData={dimensions[key]} />
          ))}
        </div>

        <Separator />

        {/* 总体评估摘要 */}
        <div className="rounded-lg border bg-muted/20 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <CheckCircle className="h-4 w-4 text-green-500" />
            评估摘要
          </p>
          <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            <p>
              综合评分 <span className={`font-semibold ${overallTone.color}`}>{overallScore}/100</span>
              ，由覆盖率(30%)、难度(25%)、事实性(25%)、引用完整性(20%)加权计算。
            </p>
            {overallScore >= 85 ? (
              <p>各维度表现均衡且优秀，内容可进入人工复核或直接使用。</p>
            ) : overallScore >= 70 ? (
              <p>内容整体质量良好，建议关注评分较低的维度并按改进建议优化。</p>
            ) : (
              <p>内容存在较明显的质量短板，建议优先处理低分维度的改进建议后再使用。</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
