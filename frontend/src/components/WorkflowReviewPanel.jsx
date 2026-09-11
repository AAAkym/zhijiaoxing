import { AlertCircle, CheckCircle2, ShieldCheck, Wrench } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export default function WorkflowReviewPanel({ review }) {
  if (!review) return null
  const lastRound = review.rounds?.[review.rounds.length - 1]
  const semantic = lastRound?.semantic || {}
  const structureChecks = lastRound?.structure?.checks || []
  const score = semantic.score ?? (lastRound?.structure?.passed ? 100 : 0)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck /> ReviewAgent 审核
            </CardTitle>
            <CardDescription>{review.summary}</CardDescription>
          </div>
          <Badge variant={review.can_submit ? 'default' : 'secondary'}>
            {review.can_submit ? '允许提交' : '需要教师确认'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>{semantic.label || '规则审核'}</span>
            <span>{semantic.score == null ? '结构检查' : `${Math.round(score)}分`}</span>
          </div>
          <Progress value={score} />
          <p className="text-sm text-muted-foreground">共执行 {review.round_count} 轮检查，语义通过线为80分。</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {structureChecks.map((check) => (
            <div key={check.resource_type} className="flex min-h-24 flex-col gap-2 border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{check.resource_type}</span>
                {check.status === 'passed'
                  ? <CheckCircle2 className="text-primary" aria-label="结构通过" />
                  : <AlertCircle className="text-destructive" aria-label="结构未通过" />}
              </div>
              <p className="text-sm text-muted-foreground">
                {check.issues.length ? check.issues.join('；') : `${check.item_count}项内容结构完整`}
              </p>
            </div>
          ))}
        </div>

        {review.rounds?.some((round) => round.changes?.length) ? (
          <Alert>
            <Wrench />
            <AlertTitle>自动修复记录</AlertTitle>
            <AlertDescription>
              {review.rounds.flatMap((round) => round.changes || []).join('；')}
            </AlertDescription>
          </Alert>
        ) : null}

        {semantic.issues?.length ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>仍需确认</AlertTitle>
            <AlertDescription>{semantic.issues.join('；')}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}

