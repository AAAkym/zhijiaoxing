import { CheckCircle2, Link2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const RESOURCE_LABELS = {
  document: '讲解文档',
  exercise: '分层练习',
  project: '编程项目',
}

function DocumentPreview({ resource }) {
  return (
    <div className="flex flex-col gap-3">
      {(resource?.sections || []).slice(0, 4).map((section, index) => (
        <section key={`${section.title}-${index}`} className="border-l-2 border-primary/40 pl-3">
          <h4 className="text-sm font-medium">{section.title}</h4>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{section.content}</p>
        </section>
      ))}
    </div>
  )
}

function ExercisePreview({ resource }) {
  const exercises = resource?.exercises || resource?.items || []
  return (
    <ol className="flex flex-col gap-3">
      {exercises.slice(0, 4).map((exercise, index) => (
        <li key={`${exercise.question}-${index}`} className="border-b pb-3 last:border-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{exercise.type || `第${index + 1}题`}</Badge>
            <span className="text-sm font-medium">{exercise.question}</span>
          </div>
          {exercise.hint ? <p className="mt-2 text-xs text-muted-foreground">提示：{exercise.hint}</p> : null}
        </li>
      ))}
    </ol>
  )
}

function ProjectPreview({ resource }) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="leading-6 text-muted-foreground">{resource?.description}</p>
      <div>
        <h4 className="font-medium">实施步骤</h4>
        <ol className="mt-2 list-inside list-decimal text-muted-foreground">
          {(resource?.steps || []).map(step => <li key={step} className="py-1">{step}</li>)}
        </ol>
      </div>
      <div>
        <h4 className="font-medium">验收标准</h4>
        <ul className="mt-2 list-inside list-disc text-muted-foreground">
          {(resource?.acceptance_criteria || []).map(item => <li key={item} className="py-1">{item}</li>)}
        </ul>
      </div>
    </div>
  )
}

function ResourceBody({ type, resource }) {
  if (type === 'document') return <DocumentPreview resource={resource} />
  if (type === 'exercise') return <ExercisePreview resource={resource} />
  return <ProjectPreview resource={resource} />
}

function ResultCard({ profileCase, result, loading, resourceType }) {
  if (loading || !result) {
    return (
      <Card className="min-h-72">
        <CardHeader>
          <CardTitle>{profileCase.name}</CardTitle>
          <CardDescription>正在生成个性化{RESOURCE_LABELS[resourceType]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Progress value={loading ? 55 : 0} />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />智能体生成与保障机制正在工作
          </div>
        </CardContent>
      </Card>
    )
  }

  const resource = result.resources?.[resourceType] || {}
  const causalChain = result.generation_explanation?.causal_chain || []
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{profileCase.name}</CardTitle>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="size-3.5" />{result.generation_source_label}
          </Badge>
        </div>
        <CardDescription>{resource.title || RESOURCE_LABELS[resourceType]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ResourceBody type={resourceType} resource={resource} />

        <section className="border-t pt-4">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <Link2 className="size-4" />为什么这样生成
          </h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {resource.profile_adaptation_explanation || '已按照画像策略完成资源适配。'}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {causalChain.slice(0, 3).map((item, index) => (
              <p key={`${item.judgement}-${index}`} className="text-xs leading-5 text-muted-foreground">
                {(item.evidence || [])[0]} → {item.judgement} → {item.generation_action}
              </p>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export default function ComparisonResourceResults({ plan, results, loadingIds }) {
  if (!plan?.cases?.length || (!Object.keys(results || {}).length && !loadingIds?.length)) return null

  return (
    <Tabs defaultValue="document">
      <TabsList className="grid w-full grid-cols-3 md:w-fit">
        {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
          <TabsTrigger key={value} value={value}>{label}</TabsTrigger>
        ))}
      </TabsList>
      {Object.keys(RESOURCE_LABELS).map(resourceType => (
        <TabsContent key={resourceType} value={resourceType}>
          <div className="grid gap-4 xl:grid-cols-2">
            {plan.cases.map(profileCase => (
              <ResultCard
                key={`${profileCase.id}-${resourceType}`}
                profileCase={profileCase}
                result={results[profileCase.id]}
                loading={loadingIds.includes(profileCase.id)}
                resourceType={resourceType}
              />
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
