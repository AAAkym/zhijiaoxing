import { ArrowRight, BookOpenCheck, Database, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function visibleDimensions(explainability) {
  const wanted = new Set(['knowledge_base', 'error_patterns', 'learning_pace', 'cognitive_style'])
  return (explainability?.dimensions || []).filter(item => wanted.has(item.key))
}

function ProfileCase({ profileCase }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{profileCase.name}</CardTitle>
          <Badge variant="secondary">可信度 {profileCase.explainability.confidence_score}%</Badge>
        </div>
        <CardDescription>{profileCase.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Database className="size-4" />事实证据
          </h3>
          <div className="flex flex-col gap-3">
            {visibleDimensions(profileCase.explainability).map(dimension => (
              <div key={dimension.key} className="border-l-2 border-primary/40 pl-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{dimension.label}</span>
                  <span>{dimension.display_value}</span>
                </div>
                {(dimension.evidence || []).slice(0, 3).map((evidence, index) => (
                  <p key={`${dimension.key}-${index}`} className="mt-1 text-xs leading-5 text-muted-foreground">
                    {evidence}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
            <BookOpenCheck className="size-4" />生成策略
          </h3>
          <div className="flex flex-col gap-2">
            {(profileCase.strategy?.mappings || []).map((mapping, index) => (
              <div key={`${mapping.feature}-${index}`} className="grid gap-2 border-b py-2 text-sm last:border-0 md:grid-cols-[minmax(0,0.8fr)_auto_minmax(0,1.2fr)]">
                <span className="font-medium">{mapping.feature}</span>
                <ArrowRight className="hidden size-4 text-muted-foreground md:block" />
                <span className="text-muted-foreground">{mapping.action}</span>
              </div>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  )
}

export default function ComparisonStrategyPreview({ plan }) {
  if (!plan?.cases?.length) return null

  return (
    <div className="flex flex-col gap-5">
      <Alert>
        <ShieldCheck />
        <AlertTitle>比赛示例画像</AlertTitle>
        <AlertDescription>{plan.data_notice} 本次预览和生成均不写入数据库。</AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        {plan.cases.map(profileCase => <ProfileCase key={profileCase.id} profileCase={profileCase} />)}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>同一主题下的关键画像差异</CardTitle>
          <CardDescription>这些差异将直接改变讲解方式、练习难度和项目任务。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>画像维度</TableHead>
                <TableHead>{plan.cases[0]?.short_name}</TableHead>
                <TableHead>{plan.cases[1]?.short_name}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plan.dimension_differences || []).map(item => (
                <TableRow key={item.key}>
                  <TableCell className="font-medium">{item.label}</TableCell>
                  <TableCell className="whitespace-normal">{item.left}</TableCell>
                  <TableCell className="whitespace-normal">{item.right}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
