import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Trophy,
  Star,
  Clock,
  Flame,
  Target,
  BookOpen,
  BookX,
  CheckCircle,
  RefreshCw,
  FileText,
  GraduationCap,
  Shield,
  TrendingUp,
  LogIn,
  Lock,
  Loader2,
  Award,
  Sparkles,
  Bell
} from 'lucide-react'
import { achievements as achievementApi } from '@/services/api'

const ICON_MAP = {
  LogIn, Clock, Flame, Target, BookOpen, BookX, CheckCircle,
  RefreshCw, FileText, GraduationCap, Shield, TrendingUp, Star, Award,
}

const CATEGORY_CONFIG = {
  learning_time: { label: '学习时长', color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  practice: { label: '练习评测', color: 'from-green-500 to-emerald-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  accuracy: { label: '答题正确率', color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  mistake: { label: '错题攻克', color: 'from-red-500 to-pink-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  knowledge: { label: '知识掌握', color: 'from-purple-500 to-violet-500', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
}

const LEVEL_CONFIG = {
  1: { label: '初级', stars: 1, color: 'text-gray-400' },
  2: { label: '中级', stars: 2, color: 'text-yellow-500' },
  3: { label: '高级', stars: 3, color: 'text-orange-500' },
  4: { label: '大师', stars: 4, color: 'text-red-500' },
}

export default function AchievementPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [notifications, setNotifications] = useState([])
  const [showNotification, setShowNotification] = useState(false)

  const fetchAchievements = useCallback(async () => {
    setLoading(true)
    try {
      const result = await achievementApi.getAll()
      setData(result)
    } catch (err) {
      console.error('Failed to fetch achievements:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const checkNewAchievements = useCallback(async () => {
    try {
      const result = await achievementApi.check()
      if (result.newly_unlocked && result.newly_unlocked.length > 0) {
        setNotifications(result.newly_unlocked)
        setShowNotification(true)
        fetchAchievements()
      }
    } catch (err) {
      console.error('Failed to check achievements:', err)
    }
  }, [fetchAchievements])

  useEffect(() => {
    fetchAchievements()
  }, [fetchAchievements])

  useEffect(() => {
    checkNewAchievements()
  }, [checkNewAchievements])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-purple-500 mb-4" />
        <p className="text-gray-500">加载成就数据...</p>
      </div>
    )
  }

  if (!data) return null

  const { achievements = [], categories = {}, total_count = 0, unlocked_count = 0, total_points = 0 } = data
  const progressPercent = total_count > 0 ? Math.round(unlocked_count / total_count * 100) : 0

  const filteredAchievements = activeCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === activeCategory)

  const renderIcon = (iconName, size = 'w-8 h-8') => {
    const IconComponent = ICON_MAP[iconName]
    if (!IconComponent) return <Trophy className={size} />
    return <IconComponent className={size} />
  }

  const renderStars = (level) => {
    const config = LEVEL_CONFIG[level] || LEVEL_CONFIG[1]
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: config.stars }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 fill-current ${config.color}`} />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {showNotification && notifications.length > 0 && (
        <Card className="border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-yellow-800 mb-1">🎉 成就解锁！</h3>
                {notifications.map((n, i) => (
                  <p key={i} className="text-sm text-yellow-700">
                    恭喜解锁「{n.name}」- {n.description}
                  </p>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowNotification(false)}>
                ✕
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Trophy className="w-7 h-7" />
              </div>
              <div>
                <p className="text-purple-100 text-sm">已解锁成就</p>
                <p className="text-3xl font-bold">{unlocked_count} <span className="text-lg font-normal text-purple-200">/ {total_count}</span></p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <p className="text-amber-100 text-sm">累计积分</p>
                <p className="text-3xl font-bold">{total_points}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">完成进度</p>
                <p className="text-2xl font-bold text-gray-900">{progressPercent}%</p>
                <Progress value={progressPercent} className="h-2 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveCategory('all')}
        >
          全部 ({achievements.length})
        </Button>
        {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
          const count = (categories[key] || []).length
          if (count === 0) return null
          return (
            <Button
              key={key}
              variant={activeCategory === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveCategory(key)}
            >
              {config.label} ({count})
            </Button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAchievements.map((achievement) => {
          const catConfig = CATEGORY_CONFIG[achievement.category] || CATEGORY_CONFIG.learning_time
          const isUnlocked = achievement.unlocked

          return (
            <Card
              key={achievement.id}
              className={`relative overflow-hidden transition-all hover:shadow-md ${
                isUnlocked
                  ? 'border-l-4 border-l-green-500'
                  : 'border-l-4 border-l-gray-300 opacity-75'
              }`}
            >
              {isUnlocked && (
                <div className="absolute top-2 right-2">
                  <Badge className="bg-green-100 text-green-700 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    已解锁
                  </Badge>
                </div>
              )}

              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isUnlocked
                      ? `bg-gradient-to-br ${catConfig.color} text-white`
                      : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isUnlocked ? renderIcon(achievement.icon, 'w-6 h-6') : <Lock className="w-6 h-6" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${isUnlocked ? 'text-gray-900' : 'text-gray-500'}`}>
                        {achievement.name}
                      </h4>
                      {renderStars(achievement.level)}
                    </div>

                    <p className="text-xs text-gray-500 mb-2">{achievement.description}</p>

                    <div className="flex items-center gap-2 mb-1">
                      <Progress
                        value={achievement.progress || 0}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-xs text-gray-400 w-10 text-right">
                        {achievement.progress || 0}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-xs ${catConfig.text} ${catConfig.border}`}>
                        {catConfig.label}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        +{achievement.points} 积分
                      </span>
                    </div>

                    {isUnlocked && achievement.unlocked_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        解锁于 {new Date(achievement.unlocked_at).toLocaleDateString('zh-CN')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredAchievements.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Trophy className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>该分类下暂无成就</p>
        </div>
      )}
    </div>
  )
}
