import React, { useMemo } from 'react'
import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const RESOURCE_LABELS = {
  document: '文档',
  mindmap: '思维导图',
  project: '代码实操',
  recommendation: '拓展推荐',
  media: '视频脚本',
  exercise: '练习',
  layered_exercise: '分层练习',
}

const STYLE_LABELS = {
  bracket: '方括号',
  footnote: '脚注',
  inline: '行内',
}

const DEGRADATION_LABELS = {
  no_citations: '缺少引用',
  fake_references: '疑似虚假引用',
  low_coverage: '引用覆盖不足',
  unsupported_claims: '存在无引用断言',
  citation_issues: '引用问题',
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function getReport(resource) {
  return resource?.verification_report || resource?.citation_reliability || null
}

function getDegradation(resource, report) {
  return resource?.degradation || resource?.degradation_reason || report?.degradation || null
}

function normalizeEntries(data) {
  if (!data) return []

  const entries = []
  const resources = data.resources && typeof data.resources === 'object' ? data.resources : null
  if (resources) {
    Object.entries(resources).forEach(([resourceType, resource]) => {
      if (!resource) return
      const report = getReport(resource) || data.verification_report?.resources?.[resourceType] || null
      entries.push({ resourceType, resource, report, degradation: getDegradation(resource, report) })
    })
  }

  if (!entries.length && data.verification_report?.resources) {
    Object.entries(data.verification_report.resources).forEach(([resourceType, report]) => {
      entries.push({ resourceType, resource: null, report, degradation: getDegradation(null, report) })
    })
  }

  const topReport = data.verification_report || data.citation_reliability
  if (!entries.length && topReport) {
    entries.push({
      resourceType: data.resource_type || 'result',
      resource: data,
      report: topReport,
      degradation: getDegradation(data, topReport),
    })
  }

  return entries
}

function collectUnsupportedClaims(entries) {
  return entries.flatMap(({ resourceType, report }) => (
    asArray(report?.unsupported_claims).map((claim, index) => ({
      resourceType,
      index,
      text: typeof claim === 'string' ? claim : claim?.text || claim?.claim || JSON.stringify(claim),
    }))
  ))
}

export default function RagReliabilityPanel({ data, title = 'RAG 引用可靠性' }) {
  const entries = useMemo(() => normalizeEntries(data), [data])
  const unsupportedClaims = useMemo(() => collectUnsupportedClaims(entries), [entries])

  if (!entries.length) return null

  const degradedEntries = entries.filter((entry) => entry.degradation || entry.report?.degraded)
  const ragRequired = entries.some(({ resource, report }) => resource?.rag_required || report?.rag_required || data?.metadata?.rag_required)
  const citationStyle = entries.find(({ resource, report }) => resource?.citation_style || report?.citation_style)?.resource?.citation_style
    || entries.find(({ report }) => report?.citation_style)?.report?.citation_style
    || data?.metadata?.citation_style
    || 'bracket'
  const averageScore = entries
    .map(({ resource, report }) => report?.score ?? resource?.citation_coverage_score)
    .filter((score) => typeof score === 'number')
  const score = averageScore.length ? Math.round(averageScore.reduce((sum, item) => sum + item, 0) / averageScore.length) : null
  const status = degradedEntries.length ? 'needs_review' : unsupportedClaims.length ? 'needs_review' : 'passed'

  return (
    <Card className={`border ${status === 'passed' ? 'border-emerald-200 bg-emerald-50/40' : 'border-amber-200 bg-amber-50/50'}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-3 text-base">
          <span className="flex items-center gap-2">
            {status === 'passed' ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
            {title}
          </span>
          <Badge variant={status === 'passed' ? 'default' : 'outline'}>
            {status === 'passed' ? '引用正常' : '需要复核'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 md:grid-cols-4">
          <div className="rounded-md border bg-white p-2">
            <div className="text-xs text-muted-foreground">RAG 要求</div>
            <div className="font-semibold">{ragRequired ? '必须引用' : '未强制'}</div>
          </div>
          <div className="rounded-md border bg-white p-2">
            <div className="text-xs text-muted-foreground">引用风格</div>
            <div className="font-semibold">{STYLE_LABELS[citationStyle] || citationStyle}</div>
          </div>
          <div className="rounded-md border bg-white p-2">
            <div className="text-xs text-muted-foreground">未支撑句子</div>
            <div className="font-semibold">{unsupportedClaims.length}</div>
          </div>
          <div className="rounded-md border bg-white p-2">
            <div className="text-xs text-muted-foreground">自动降级</div>
            <div className="font-semibold">{degradedEntries.length ? `${degradedEntries.length} 项` : '否'}</div>
          </div>
        </div>

        {score !== null && (
          <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
            <span className="text-muted-foreground">引用校验平均分</span>
            <span className="font-semibold">{score}/100</span>
          </div>
        )}

        <div className="space-y-2">
          {entries.map(({ resourceType, report, degradation }) => (
            <div key={resourceType} className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
              <div className="min-w-0">
                <div className="font-medium">{RESOURCE_LABELS[resourceType] || resourceType}</div>
                <div className="text-xs text-muted-foreground">
                  {asArray(report?.unsupported_claims).length} 句缺引用
                  {typeof report?.score === 'number' ? ` · 校验 ${Math.round(report.score)} 分` : ''}
                </div>
              </div>
              <Badge variant={degradation ? 'outline' : 'secondary'} className={degradation ? 'border-amber-300 text-amber-700' : ''}>
                {degradation ? `已降级：${DEGRADATION_LABELS[degradation] || degradation}` : '未降级'}
              </Badge>
            </div>
          ))}
        </div>

        {unsupportedClaims.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              缺少引用支撑的句子
            </div>
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {unsupportedClaims.map((claim) => (
                <div key={`${claim.resourceType}-${claim.index}-${claim.text}`} className="rounded-md border border-amber-200 bg-white p-2">
                  <div className="mb-1 text-xs font-medium text-amber-700">{RESOURCE_LABELS[claim.resourceType] || claim.resourceType}</div>
                  <div className="text-xs leading-relaxed text-slate-700">{claim.text}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white p-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            未发现缺少引用支撑的句子。
          </div>
        )}
      </CardContent>
    </Card>
  )
}
