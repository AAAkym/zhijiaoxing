import { ArrowRight, FileCheck, Link2, ShieldCheck, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const RESOURCE_LABELS = {
  exercise: '个性化练习',
  layered_exercise: '分层练习',
  document: '讲解文档',
  mindmap: '思维导图',
  media: '视频脚本',
  recommendation: '拓展推荐',
  project: '实操项目',
  ppt: '课件PPT',
}

function evidenceText(value) {
  if (Array.isArray(value)) return value.join('；')
  return value || '画像记录已确认该特征'
}

export default function GenerationCausalChain({ explanation, resources = {} }) {
  const chain = explanation?.causal_chain || []
  if (!chain.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Link2 className="h-5 w-5 text-sky-600" />
          最终资源个性化因果链
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {chain.map((item, index) => (
          <div key={`${item.judgement}-${index}`} className="border-l-2 border-sky-500 pl-4">
            <div className="grid gap-2 md:grid-cols-[1.2fr_auto_1fr_auto_1.2fr] md:items-center">
              <ChainStep kind="evidence" label="原始证据" value={evidenceText(item.evidence)} />
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
              <ChainStep kind="judgement" label="画像判断" value={item.judgement} />
              <ArrowRight className="hidden h-4 w-4 text-muted-foreground md:block" />
              <ChainStep kind="action" label="生成动作" value={item.generation_action} />
            </div>
            <div className="mt-3 space-y-2 bg-muted/25 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground">具体资源变化</p>
              {(item.affected_resources || []).map(resourceType => {
                const adaptation = resources?.[resourceType]?.profile_adaptation_explanation
                  || resources?.[resourceType]?.['画像适配说明']
                return (
                  <div key={resourceType} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start">
                    <Badge variant="outline" className="w-fit shrink-0">
                      {RESOURCE_LABELS[resourceType] || resourceType}
                    </Badge>
                    <span className="text-muted-foreground">
                      {adaptation || item.generation_action || '已按该策略调整内容结构'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function ChainStep({ kind, label, value }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {kind === 'evidence' && <ShieldCheck className="h-3.5 w-3.5" />}
        {kind === 'judgement' && <Target className="h-3.5 w-3.5" />}
        {kind === 'action' && <FileCheck className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="mt-1 text-sm font-medium leading-6">{value || '暂无'}</p>
    </div>
  )
}
