import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts'
import {
  BookOpen,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Tag
} from 'lucide-react'

const COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899']

const STATUS_COLORS = {
  unmastered: '#EF4444',
  reviewing: '#3B82F6',
  mastered: '#10B981'
}

export default function MistakeStats({ stats }) {
  if (!stats || !stats.stats) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无统计数据</p>
        </CardContent>
      </Card>
    )
  }

  const { stats: statsData, recent_mistakes } = stats

  const statusData = [
    { name: '未掌握', value: statsData.by_status?.unmastered || 0, color: STATUS_COLORS.unmastered },
    { name: '复习中', value: statsData.by_status?.reviewing || 0, color: STATUS_COLORS.reviewing },
    { name: '已掌握', value: statsData.by_status?.mastered || 0, color: STATUS_COLORS.mastered }
  ].filter(item => item.value > 0)

  const courseData = (statsData.by_course || []).map(item => ({
    name: item.course_title?.slice(0, 10) || '未知课程',
    fullName: item.course_title,
    count: item.count
  }))

  const knowledgePointData = Object.entries(statsData.by_knowledge_point || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  const totalMistakes = statsData.total_mistakes || 0
  const masteredCount = statsData.by_status?.mastered || 0
  const masteryRate = totalMistakes > 0 
    ? Math.round((masteredCount / totalMistakes) * 100) 
    : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              掌握状态分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无数据
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">总体掌握率</span>
                <span className="text-sm font-medium">{masteryRate}%</span>
              </div>
              <Progress value={masteryRate} className="h-3" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              课程错题分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            {courseData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={courseData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip 
                    formatter={(value, name, props) => [
                      value, 
                      props.payload.fullName || '错题数'
                    ]}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-gray-500">
                暂无数据
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            知识点错题统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          {knowledgePointData.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {knowledgePointData.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-3 text-center hover:bg-gray-100 transition-colors"
                >
                  <p className="text-2xl font-bold text-gray-800">{item.count}</p>
                  <p className="text-sm text-gray-600 truncate" title={item.name}>
                    {item.name}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无知识点标签数据
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            最近错题
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent_mistakes && recent_mistakes.length > 0 ? (
            <div className="space-y-3">
              {recent_mistakes.slice(0, 5).map((mistake, index) => (
                <div
                  key={mistake.id || index} // 修复：使用 fallback key，避免 id 为 undefined 时警告
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                      mistake.mastery_status === 'mastered' 
                        ? 'bg-green-500' 
                        : mistake.mastery_status === 'reviewing'
                          ? 'bg-blue-500'
                          : 'bg-red-500'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      {/* 修复：安全地截取题目内容，避免 undefined 导致的显示问题 */}
                      <p className="text-sm font-medium text-gray-800 truncate" title={mistake.question_content || '无题目内容'}>
                        {(mistake.question_content || '无题目内容').slice(0, 50)}
                        {(mistake.question_content && mistake.question_content.length > 50) ? '...' : ''}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {mistake.course_title && (
                          <span className="text-xs text-gray-500">
                            {mistake.course_title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        mistake.mastery_status === 'mastered'
                          ? 'text-green-600 border-green-200'
                          : mistake.mastery_status === 'reviewing'
                            ? 'text-blue-600 border-blue-200'
                            : 'text-red-600 border-red-200'
                      }
                    >
                      {mistake.mastery_status === 'mastered' && '已掌握'}
                      {mistake.mastery_status === 'reviewing' && '复习中'}
                      {mistake.mastery_status === 'unmastered' && '未掌握'}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      错{mistake.mistake_count}次
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              暂无最近错题
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-600 mb-1">未掌握</p>
                <p className="text-3xl font-bold text-red-700">
                  {statsData.by_status?.unmastered || 0}
                </p>
                <p className="text-xs text-red-500 mt-1">需要重点复习</p>
              </div>
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-600 mb-1">复习中</p>
                <p className="text-3xl font-bold text-blue-700">
                  {statsData.by_status?.reviewing || 0}
                </p>
                <p className="text-xs text-blue-500 mt-1">正在学习中</p>
              </div>
              <RefreshCw className="w-12 h-12 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-600 mb-1">已掌握</p>
                <p className="text-3xl font-bold text-green-700">
                  {statsData.by_status?.mastered || 0}
                </p>
                <p className="text-xs text-green-500 mt-1">继续保持</p>
              </div>
              <CheckCircle className="w-12 h-12 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
