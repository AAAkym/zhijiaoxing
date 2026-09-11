import { useMemo, useState } from 'react'
import { Eye, GitCompare, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { courseGeneration } from '@/services/api'
import ComparisonResourceResults from './ComparisonResourceResults'
import ComparisonStrategyPreview from './ComparisonStrategyPreview'

const DEMO_PROFILE_IDS = ['visual_consolidation', 'engineering_practice']
const RESOURCE_TYPES = ['document', 'exercise', 'project']

function parseKnowledgePoints(value) {
  return value
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

export default function PersonalizationComparisonDemo() {
  const [topic, setTopic] = useState('Python for循环与边界控制')
  const [knowledgeText, setKnowledgeText] = useState('for循环, range边界, 循环变量, 边界测试')
  const [plan, setPlan] = useState(null)
  const [results, setResults] = useState({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [loadingIds, setLoadingIds] = useState([])
  const [notice, setNotice] = useState('')

  const requestPayload = useMemo(() => ({
    preset_ids: DEMO_PROFILE_IDS,
    topic: topic.trim(),
    knowledge_points: parseKnowledgePoints(knowledgeText),
    resource_types: RESOURCE_TYPES,
  }), [knowledgeText, topic])

  const resetComparison = () => {
    setPlan(null)
    setResults({})
    setLoadingIds([])
    setNotice('')
  }

  const handleTopicChange = event => {
    setTopic(event.target.value)
    resetComparison()
  }

  const handleKnowledgeChange = event => {
    setKnowledgeText(event.target.value)
    resetComparison()
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    setNotice('')
    setResults({})
    try {
      const nextPlan = await courseGeneration.previewComparisonDemoPlan(requestPayload)
      setPlan(nextPlan)
      setNotice('策略预览已完成。下面展示同一主题下，两类学生为什么会得到不同资源。')
    } catch (error) {
      setNotice(`策略预览暂时无法连接后端：${error.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const generateOneProfile = async profileId => {
    let latestError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await courseGeneration.generateComparisonDemo({
          ...requestPayload,
          preset_id: profileId,
        })
      } catch (error) {
        latestError = error
      }
    }
    throw latestError
  }

  const handleGenerate = async () => {
    if (!plan) return
    const profileIds = plan.cases.map(profileCase => profileCase.id)
    setResults({})
    setLoadingIds(profileIds)
    setNotice('两名学生的资源正在并行生成。AI不可用时，系统会自动切换本地保障生成。')

    const requests = profileIds.map(async profileId => {
      try {
        const result = await generateOneProfile(profileId)
        setResults(previous => ({ ...previous, [profileId]: result }))
      } catch (error) {
        setNotice(`后端连接中断，请保持当前策略预览并重新生成：${error.message}`)
      } finally {
        setLoadingIds(previous => previous.filter(item => item !== profileId))
      }
    })
    await Promise.all(requests)
    setNotice(current => current.startsWith('后端连接中断')
      ? current
      : '两套资源均已完成。可以切换讲解文档、分层练习和编程项目查看差异。')
  }

  const generating = loadingIds.length > 0
  const resultCount = Object.keys(results).length

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <GitCompare className="size-6" />
          <h1 className="text-2xl font-bold tracking-normal">双学生个性化对比</h1>
        </div>
        <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
          使用同一知识点，对比“视觉巩固型”和“工程实践型”学生的画像证据、生成策略与最终课程资源。
        </p>
      </header>

      <Alert>
        <ShieldCheck />
        <AlertTitle>零数据库写入的比赛演示</AlertTitle>
        <AlertDescription>
          示例画像、策略预览和保障资源均为运行时数据，不创建学生、不保存资源、不产生审核或 Agent 执行记录。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>同一教学任务</CardTitle>
          <CardDescription>先生成策略预览，确认画像差异后再生成两套真实资源。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_1.4fr_auto] lg:items-end">
          <div className="flex flex-col gap-2">
            <Label htmlFor="comparison-topic">教学主题</Label>
            <Input id="comparison-topic" value={topic} onChange={handleTopicChange} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="comparison-knowledge">知识点</Label>
            <Textarea
              id="comparison-knowledge"
              value={knowledgeText}
              onChange={handleKnowledgeChange}
              rows={2}
            />
          </div>
          <Button onClick={handlePreview} disabled={previewLoading || generating || !topic.trim()}>
            {previewLoading ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Eye data-icon="inline-start" />}
            1. 生成策略预览
          </Button>
        </CardContent>
      </Card>

      {notice ? <p aria-live="polite" className="text-sm text-muted-foreground">{notice}</p> : null}

      <ComparisonStrategyPreview plan={plan} />

      {plan ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
            2. 生成两套资源
          </Button>
          <Badge variant="outline">讲解文档</Badge>
          <Badge variant="outline">分层练习</Badge>
          <Badge variant="outline">编程项目</Badge>
          {resultCount > 0 ? <Badge variant="secondary">已完成 {resultCount}/2</Badge> : null}
        </div>
      ) : null}

      <ComparisonResourceResults plan={plan} results={results} loadingIds={loadingIds} />
    </div>
  )
}
