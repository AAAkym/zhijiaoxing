import { AlertCircle, ArrowRight, CheckCircle, Database, ShieldCheck, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default function ProfileExplainabilityPanel({ explainability, strategy, compact = false }) {
  if (!explainability) return null
  const dimensions = explainability.dimensions || []
  const mappings = strategy?.mappings || explainability.strategy_suggestions || []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          学生画像证据与生成依据
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="画像完整度" value={explainability.completeness_score || 0} hint="八个维度填写比例" />
          <Metric label="证据可信度" value={explainability.confidence_score || 0} hint="多来源、样本量与时效性" />
          <div className="border-l-2 border-sky-500 pl-3">
            <p className="text-xs text-muted-foreground">事实数据源</p>
            <p className="mt-1 text-2xl font-semibold">{explainability.source_count || 0}</p>
            <p className="text-xs text-muted-foreground">种已核验来源</p>
          </div>
        </div>

        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4 text-sky-600" />事实层
          </p>
          <div className="flex flex-wrap gap-2">
            {(explainability.data_sources || []).length ? (
              explainability.data_sources.map((source) => <Badge key={source} variant="secondary">{source}</Badge>)
            ) : (
              <span className="text-sm text-muted-foreground">尚无学习行为证据</span>
            )}
          </div>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />特征层
          </p>
          <div className={`grid gap-2 ${compact ? 'md:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
            {dimensions.map((dimension) => (
              <div key={dimension.key} className="border-l-2 border-border bg-muted/25 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{dimension.label}</p>
                    <p className="text-xs text-muted-foreground">{dimension.display_value}</p>
                  </div>
                  {dimension.confidence > 0 ? (
                    <Badge variant="secondary">{dimension.confidence}%</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />证据不足</Badge>
                  )}
                </div>
                <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                  {(dimension.evidence || []).slice(0, 3).map((item, evidenceIndex) => (
                    <li key={`${dimension.key || dimension.label}-evidence-${evidenceIndex}`} className="flex gap-1.5">
                      <span aria-hidden="true">-</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-muted-foreground">样本 {dimension.sample_count || 0} · {(dimension.data_sources || []).join('、') || '暂无来源'}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-rose-600" />策略层
          </p>
          {mappings.length ? (
            <div className="space-y-2">
              {mappings.map((mapping, index) => (
                <div key={`${mapping.feature}-${index}`} className="grid items-center gap-2 border-b py-2 text-sm last:border-0 md:grid-cols-[1fr_auto_1.4fr_auto_1fr]">
                  <span className="font-medium">{mapping.feature}</span>
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                  <span>{mapping.action}</span>
                  <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
                  <div className="flex flex-wrap gap-1">
                    {(mapping.affected_resources || []).map((resource) => <Badge key={resource} variant="outline">{resource}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />现有证据不足，不采用未经证实的个性化策略
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, hint }) {
  return (
    <div className="border-l-2 border-emerald-500 pl-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value > 0 && <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />}
      </div>
      <p className="mt-1 text-2xl font-semibold">{value}%</p>
      <Progress value={value} className="my-1 h-1.5" />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
