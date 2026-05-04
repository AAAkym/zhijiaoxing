import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Edit3, Save } from 'lucide-react'
import { mistakeBook } from '@/services/api'

export default function ErrorTypeAnalysisPanel({ mistake, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [manualType, setManualType] = useState(mistake?.error_type_manual || '')
  const [detail, setDetail] = useState(mistake?.error_reason_detail || '')

  const currentType = mistake?.error_type_manual || mistake?.error_type_auto || 'other'
  const typeMeta = {
    concept_understanding: { label: '概念理解偏差' },
    calculation_error: { label: '计算失误' },
    question_misread: { label: '审题不清' },
    other: { label: '其他' },
  }

  const confidenceText = useMemo(() => {
    if (mistake?.error_type_confidence === null || mistake?.error_type_confidence === undefined) {
      return '-'
    }
    return `${Math.round(Number(mistake.error_type_confidence) * 100)}%`
  }, [mistake?.error_type_confidence])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        manual_type: manualType || null,
        detail,
        confirmed: true,
        clear_manual: !manualType,
      }
      const res = await mistakeBook.updateErrorAnalysis(mistake.id, payload)
      setEditing(false)
      if (onUpdated) {
        onUpdated(res.mistake)
      }
    } catch (err) {
      console.error('更新错因失败', err)
      alert('更新错因失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">AI 错因分类</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Edit3 className="w-4 h-4 mr-2" />
              手动修正
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200">
            <p className="text-xs text-indigo-700 mb-1">自动分类</p>
            <p className="font-semibold text-indigo-900">{typeMeta[mistake?.error_type_auto]?.label || '-'}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <p className="text-xs text-emerald-700 mb-1">当前生效</p>
            <p className="font-semibold text-emerald-900">{typeMeta[currentType]?.label || '-'}</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-600 mb-1">置信度</p>
            <p className="font-semibold text-slate-900">{confidenceText}</p>
          </div>
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <p className="text-sm mb-2">错因类型</p>
              <Select value={manualType || 'auto'} onValueChange={(value) => setManualType(value === 'auto' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">使用自动分类</SelectItem>
                  <SelectItem value="concept_understanding">概念理解偏差</SelectItem>
                  <SelectItem value="calculation_error">计算失误</SelectItem>
                  <SelectItem value="question_misread">审题不清</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm mb-2">详细说明</p>
              <Textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <Badge variant="outline" className="text-emerald-700 border-emerald-300">已支持手动确认</Badge>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{mistake?.error_reason_detail || '暂无错因解释。'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
