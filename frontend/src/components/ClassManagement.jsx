import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  Users, Plus, Trash2, BookOpen, BarChart3, UserPlus, Search, Loader2, Eye, Brain, Target, Clock, TrendingUp, AlertTriangle, RefreshCw, Radar
} from 'lucide-react'
import { classManagement, profileApi } from '@/services/api'

const ERROR_TYPE_LABELS = {
  calculation_error: '计算失误',
  concept_understanding: '概念理解偏差',
  question_misread: '审题不清',
  programming_error: '编程错误',
  careless: '粗心失误',
  other: '其他',
}

const PROFILE_DIM_LABELS = {
  cognitive_style: '认知风格',
  learning_pace: '学习节奏',
  goal_orientation: '目标导向',
  interaction_preference: '互动偏好',
}

const STYLE_LABELS = {
  visual: '视觉型', auditory: '听觉型', kinesthetic: '动觉型',
  reading: '阅读型', mixed: '混合型',
}
const PACE_LABELS = {
  fast: '快速型', moderate: '适中型', slow: '深度型', adaptive: '灵活型',
}
const GOAL_LABELS = {
  exam: '应试导向', career: '职业发展', hobby: '兴趣驱动', research: '学术研究',
}
const INTERACTION_LABELS = {
  guided: '引导式', exploratory: '探索式', challenging: '挑战式',
}

const MASTERY_STATUS_LABELS = {
  unmastered: '未掌握',
  learning: '学习中',
  mastered: '已掌握',
  reviewing: '复习中',
}

const ACHIEVEMENT_CATEGORY_LABELS = {
  knowledge: '知识',
  learning_time: '学习时长',
  practice: '练习',
  accuracy: '准确率',
  mistake: '错题',
}

const translateProfileValue = (dimension, value) => {
  if (!value) return '未设置'
  const labelMaps = {
    cognitive_style: STYLE_LABELS,
    learning_pace: PACE_LABELS,
    goal_orientation: GOAL_LABELS,
    interaction_preference: INTERACTION_LABELS,
  }
  return labelMaps[dimension]?.[value] || value
}

export default function ClassManagement({ myCourses = [] }) {
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [classDetail, setClassDetail] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassDesc, setNewClassDesc] = useState('')
  const [creating, setCreating] = useState(false)

  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false)
  const [newStudent, setNewStudent] = useState({ name: '', number: '', contact: '' })

  const [showSelectStudentDialog, setShowSelectStudentDialog] = useState(false)
  const [availableStudents, setAvailableStudents] = useState([])
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  const [addingExisting, setAddingExisting] = useState(false)

  const [showAssignCourseDialog, setShowAssignCourseDialog] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const [batchText, setBatchText] = useState('')
  const [showBatchDialog, setShowBatchDialog] = useState(false)

  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const [showDashboardDialog, setShowDashboardDialog] = useState(false)
  const [dashboardData, setDashboardData] = useState(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardTimeRange, setDashboardTimeRange] = useState('30')
  const [dashboardUserId, setDashboardUserId] = useState(null)

  const [syncing, setSyncing] = useState(false)

  const fetchClasses = useCallback(async () => {
    try {
      const result = await classManagement.getClasses()
      setClasses(result.classes || [])
    } catch (err) {
      console.error('Fetch classes error:', err)
    }
  }, [])

  const fetchClassDetail = useCallback(async (classId) => {
    setLoading(true)
    try {
      const result = await classManagement.getClass(classId)
      setClassDetail(result)
      setSelectedClass(classId)
      const statsResult = await classManagement.getStats(classId)
      setStats(statsResult)
    } catch (err) {
      console.error('Fetch class detail error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchClasses() }, [fetchClasses])

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return
    setCreating(true)
    try {
      await classManagement.createClass({ name: newClassName, description: newClassDesc })
      setShowCreateDialog(false)
      setNewClassName('')
      setNewClassDesc('')
      fetchClasses()
    } catch (err) {
      console.error('Create class error:', err)
      alert('创建班级失败: ' + (err.message || '未知错误'))
    } finally {
      setCreating(false)
    }
  }

  const handleAddStudent = async () => {
    if (!selectedClass || !newStudent.name.trim()) return
    try {
      await classManagement.addStudent(selectedClass, {
        student_name: newStudent.name,
        student_number: newStudent.number,
        contact: newStudent.contact
      })
      setShowAddStudentDialog(false)
      setNewStudent({ name: '', number: '', contact: '' })
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Add student error:', err)
      alert(err.message || '添加学生失败')
    }
  }

  const handleOpenSelectStudent = async () => {
    setShowSelectStudentDialog(true)
    setSelectedStudentIds([])
    setStudentSearch('')
    try {
      const result = await classManagement.getAvailableStudents()
      setAvailableStudents(result.students || [])
    } catch (err) {
      console.error('Fetch available students error:', err)
    }
  }

  const handleAddExistingStudents = async () => {
    if (!selectedClass || selectedStudentIds.length === 0) return
    setAddingExisting(true)
    try {
      for (const uid of selectedStudentIds) {
        await classManagement.addExistingStudent(selectedClass, { user_id: uid })
      }
      setShowSelectStudentDialog(false)
      setSelectedStudentIds([])
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Add existing students error:', err)
      alert(err.message || '添加学生失败')
    } finally {
      setAddingExisting(false)
    }
  }

  const handleBatchAdd = async () => {
    if (!selectedClass || !batchText.trim()) return
    try {
      const lines = batchText.trim().split('\n').filter(l => l.trim())
      const students = lines.map(line => {
        const parts = line.split(/[\t,，\s]+/)
        return { name: parts[0] || '', number: parts[1] || '', contact: parts[2] || '' }
      }).filter(s => s.name)
      const result = await classManagement.batchAddStudents({ class_id: selectedClass, students })
      setShowBatchDialog(false)
      setBatchText('')
      fetchClassDetail(selectedClass)
      alert(`成功创建 ${result.count} 个学生账号\n默认密码均为 123456`)
    } catch (err) {
      console.error('Batch add error:', err)
      alert(err.message || '批量添加失败')
    }
  }

  const handleRemoveStudent = async (studentId) => {
    if (!selectedClass) return
    try {
      await classManagement.removeStudent(selectedClass, studentId)
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Remove student error:', err)
    }
  }

  const handleAssignCourse = async () => {
    if (!selectedClass || !selectedCourseId) return
    try {
      await classManagement.assignCourse(selectedClass, { course_id: Number(selectedCourseId) })
      setShowAssignCourseDialog(false)
      setSelectedCourseId('')
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Assign course error:', err)
      alert(err.message || '分配课程失败')
    }
  }

  const handleRemoveCourse = async (assignmentId) => {
    if (!selectedClass) return
    try {
      await classManagement.removeCourse(selectedClass, assignmentId)
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Remove course error:', err)
    }
  }

  const handleDeleteClass = async (classId) => {
    if (!confirm('确定删除该班级？此操作不可恢复。')) return
    try {
      await classManagement.deleteClass(classId)
      if (selectedClass === classId) {
        setSelectedClass(null)
        setClassDetail(null)
        setStats(null)
      }
      fetchClasses()
    } catch (err) {
      console.error('Delete class error:', err)
    }
  }

  const handleViewProfile = async (userId) => {
    if (!selectedClass) return
    setShowProfileDialog(true)
    setProfileLoading(true)
    setProfileData(null)
    try {
      const result = await classManagement.getStudentProfile(selectedClass, userId)
      setProfileData(result)
    } catch (err) {
      console.error('View profile error:', err)
      try {
        const result = await profileApi.getStudentProfile(userId)
        setProfileData(result)
      } catch (err2) {
        console.error('Fallback profile error:', err2)
      }
    } finally {
      setProfileLoading(false)
    }
  }

  const handleViewDashboard = async (userId) => {
    if (!selectedClass) return
    setDashboardUserId(userId)
    setShowDashboardDialog(true)
    setDashboardLoading(true)
    setDashboardData(null)
    try {
      const result = await classManagement.getStudentDashboard(selectedClass, userId, dashboardTimeRange)
      setDashboardData(result)
    } catch (err) {
      console.error('View dashboard error:', err)
    } finally {
      setDashboardLoading(false)
    }
  }

  const handleDashboardTimeRangeChange = async (range) => {
    setDashboardTimeRange(range)
    if (selectedClass && dashboardUserId) {
      setDashboardLoading(true)
      try {
        const result = await classManagement.getStudentDashboard(selectedClass, dashboardUserId, range)
        setDashboardData(result)
      } catch (err) {
        console.error('Dashboard time range error:', err)
      } finally {
        setDashboardLoading(false)
      }
    }
  }

  const handleSyncProfiles = async () => {
    if (!selectedClass) return
    setSyncing(true)
    try {
      const result = await classManagement.syncClassProfiles(selectedClass)
      alert(`同步完成：${result.synced}/${result.total} 名学生画像已更新`)
      fetchClassDetail(selectedClass)
    } catch (err) {
      console.error('Sync profiles error:', err)
      alert('同步失败: ' + (err.message || '未知错误'))
    } finally {
      setSyncing(false)
    }
  }

  const classStudentIds = (classDetail?.students || []).map(s => s.user_id)
  const filteredStudents = availableStudents.filter(s => {
    const matchSearch = !studentSearch ||
      (s.real_name || '').includes(studentSearch) ||
      (s.username || '').includes(studentSearch) ||
      (s.email || '').includes(studentSearch)
    const notInClass = !classStudentIds.includes(s.id)
    return matchSearch && notInClass
  })

  const distributionColors = {
    '0-59': 'bg-red-400',
    '60-69': 'bg-orange-400',
    '70-79': 'bg-yellow-400',
    '80-89': 'bg-green-400',
    '90-100': 'bg-blue-400'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">班级管理</h2>
          <p className="text-gray-600">管理班级、学生和课程分配</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" />创建班级
        </Button>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>创建新班级</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>班级名称 *</Label>
              <Input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="如：2024级计算机1班" />
            </div>
            <div className="space-y-2">
              <Label>班级描述</Label>
              <Textarea value={newClassDesc} onChange={e => setNewClassDesc(e.target.value)} placeholder="班级简介..." rows={3} />
            </div>
            <Button onClick={handleCreateClass} disabled={!newClassName.trim() || creating} className="w-full">
              {creating ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />创建中...</> : '创建'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>添加新学生</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>姓名 *</Label>
              <Input value={newStudent.name} onChange={e => setNewStudent(prev => ({ ...prev, name: e.target.value }))} placeholder="学生姓名" />
            </div>
            <div className="space-y-2">
              <Label>学号</Label>
              <Input value={newStudent.number} onChange={e => setNewStudent(prev => ({ ...prev, number: e.target.value }))} placeholder="学号" />
            </div>
            <div className="space-y-2">
              <Label>联系方式</Label>
              <Input value={newStudent.contact} onChange={e => setNewStudent(prev => ({ ...prev, contact: e.target.value }))} placeholder="手机号/邮箱" />
            </div>
            <p className="text-xs text-gray-400">将自动创建账号，默认密码 123456</p>
            <Button onClick={handleAddStudent} disabled={!newStudent.name.trim()} className="w-full">添加</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSelectStudentDialog} onOpenChange={setShowSelectStudentDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader><DialogTitle>从系统选择学生</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                placeholder="搜索姓名、账号或邮箱..."
                className="pl-9"
              />
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {filteredStudents.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">没有可添加的学生</p>
              ) : (
                filteredStudents.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 border-b last:border-b-0">
                    <Checkbox
                      checked={selectedStudentIds.includes(s.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStudentIds(prev => [...prev, s.id])
                        } else {
                          setSelectedStudentIds(prev => prev.filter(id => id !== s.id))
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.real_name || s.username}</p>
                      <p className="text-xs text-gray-500">{s.username} / {s.email}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">已选 {selectedStudentIds.length} 人</span>
              <Button
                onClick={handleAddExistingStudents}
                disabled={selectedStudentIds.length === 0 || addingExisting}
              >
                {addingExisting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />添加中...</> : `添加 ${selectedStudentIds.length} 人`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignCourseDialog} onOpenChange={setShowAssignCourseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>分配课程</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger><SelectValue placeholder="选择课程" /></SelectTrigger>
              <SelectContent>
                {myCourses.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAssignCourse} disabled={!selectedCourseId} className="w-full">分配</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>批量添加学生</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-gray-500">每行一个学生，格式：姓名 学号 联系方式（用空格/逗号/Tab分隔）</p>
            <Textarea value={batchText} onChange={e => setBatchText(e.target.value)} placeholder={"张三 20240001 13800001111\n李四 20240002 13800002222"} rows={6} />
            <p className="text-xs text-gray-400">默认密码均为 123456</p>
            <Button onClick={handleBatchAdd} disabled={!batchText.trim()} className="w-full">批量创建</Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-sm">班级列表</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">暂无班级</p>
            ) : classes.map(c => (
              <div
                key={c.id}
                onClick={() => fetchClassDetail(c.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedClass === c.id ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{c.name}</p>
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDeleteClass(c.id) }}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </Button>
                </div>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{c.student_count}人</Badge>
                  <Badge variant="outline" className="text-xs">{c.course_count}门课</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {!classDetail ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3" />
                <p>选择左侧班级查看详情</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  <CardContent className="p-4">
                    <p className="text-blue-100 text-xs">学生人数</p>
                    <p className="text-2xl font-bold">{stats?.student_count || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
                  <CardContent className="p-4">
                    <p className="text-green-100 text-xs">平均分</p>
                    <p className="text-2xl font-bold">{stats?.avg_score || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-amber-500 to-orange-500 text-white">
                  <CardContent className="p-4">
                    <p className="text-amber-100 text-xs">及格率</p>
                    <p className="text-2xl font-bold">{stats?.pass_rate || 0}%</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-500 to-violet-500 text-white">
                  <CardContent className="p-4">
                    <p className="text-purple-100 text-xs">评测次数</p>
                    <p className="text-2xl font-bold">{stats?.total_evaluations || 0}</p>
                  </CardContent>
                </Card>
              </div>

              {stats?.score_distribution && (
                <Card>
                  <CardHeader><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4" />成绩分布</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-4 h-32">
                      {Object.entries(stats.score_distribution).map(([range, count]) => {
                        const max = Math.max(...Object.values(stats.score_distribution), 1)
                        const height = (count / max) * 100
                        return (
                          <div key={range} className="flex-1 flex flex-col items-center gap-1">
                            <span className="text-xs font-medium">{count}</span>
                            <div className={`w-full rounded-t ${distributionColors[range]}`} style={{ height: `${height}%`, minHeight: count > 0 ? '8px' : '2px' }} />
                            <span className="text-xs text-gray-500">{range}</span>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4" />学生管理</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={handleSyncProfiles} disabled={syncing}>
                        {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}同步画像
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={handleOpenSelectStudent}>
                        <UserPlus className="w-3 h-3" />选择学生
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowBatchDialog(true)}>
                        <Plus className="w-3 h-3" />批量添加
                      </Button>
                      <Button size="sm" className="gap-1" onClick={() => setShowAddStudentDialog(true)}>
                        <Plus className="w-3 h-3" />新建学生
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(!classDetail.students || classDetail.students.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-4">暂无学生</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 px-3">姓名</th>
                            <th className="text-left py-2 px-3">学号</th>
                            <th className="text-left py-2 px-3">账号</th>
                            <th className="text-left py-2 px-3">联系方式</th>
                            <th className="text-left py-2 px-3">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {classDetail.students.map(s => (
                            <tr key={s.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium">{s.student_name}</td>
                              <td className="py-2 px-3">{s.student_number || '-'}</td>
                              <td className="py-2 px-3 text-gray-500">{s.username}</td>
                              <td className="py-2 px-3 text-gray-500">{s.contact || '-'}</td>
                              <td className="py-2 px-3">
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="sm" className="gap-1 text-purple-600 hover:text-purple-800" onClick={() => handleViewDashboard(s.user_id)} title="查看看板">
                                    <Radar className="w-3 h-3" />看板
                                  </Button>
                                  <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-800" onClick={() => handleViewProfile(s.user_id)} title="查看画像">
                                    <Eye className="w-3 h-3" />画像
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveStudent(s.id)}>
                                    <Trash2 className="w-3 h-3 text-red-400" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4" />课程分配</CardTitle>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowAssignCourseDialog(true)}>
                      <Plus className="w-3 h-3" />分配课程
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(!classDetail.courses || classDetail.courses.length === 0) ? (
                    <p className="text-sm text-gray-400 text-center py-4">暂未分配课程</p>
                  ) : (
                    <div className="space-y-2">
                      {classDetail.courses.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            <span className="text-sm font-medium">{c.course_title}</span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveCourse(c.id)}>
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500" />
              学生学习画像
            </DialogTitle>
          </DialogHeader>
          {profileLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-500">正在加载画像数据...</span>
            </div>
          ) : !profileData ? (
            <div className="text-center py-12 text-gray-400">
              <p>暂无画像数据</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold">
                  {(profileData.user?.real_name || profileData.user?.username || '?')[0]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{profileData.user?.real_name || profileData.user?.username}</h3>
                  <p className="text-sm text-gray-500">{profileData.user?.email}</p>
                </div>
              </div>

              {profileData.profile && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />学习画像维度
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: '认知风格', value: translateProfileValue('cognitive_style', profileData.profile.cognitive_style), icon: '🧠' },
                      { label: '学习节奏', value: translateProfileValue('learning_pace', profileData.profile.learning_pace), icon: '⏱️' },
                      { label: '目标导向', value: translateProfileValue('goal_orientation', profileData.profile.goal_orientation), icon: '🎯' },
                      { label: '互动偏好', value: translateProfileValue('interaction_preference', profileData.profile.interaction_preference), icon: '💬' },
                    ].map(item => (
                      <div key={item.label} className="p-3 bg-white border rounded-lg">
                        <p className="text-xs text-gray-500">{item.icon} {item.label}</p>
                        <p className="text-sm font-medium mt-1">{item.value || '未设置'}</p>
                      </div>
                    ))}
                  </div>
                  {profileData.profile.knowledge_base && typeof profileData.profile.knowledge_base === 'object' && (
                    <div className="mt-3 p-3 bg-white border rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">📚 知识基础</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(profileData.profile.knowledge_base)
                          .filter(([k]) => !k.startsWith('_'))
                          .map(([subject, score]) => (
                            <span key={subject} className={`px-2 py-1 rounded text-xs ${
                              typeof score === 'number' && score >= 80 ? 'bg-green-100 text-green-700' :
                              typeof score === 'number' && score >= 60 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {subject}: {score}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                  {profileData.profile.error_patterns && profileData.profile.error_patterns.length > 0 && (
                    <div className="mt-3 p-3 bg-white border rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">⚠️ 易错点模式</p>
                      <div className="space-y-1">
                        {profileData.profile.error_patterns.slice(0, 5).map((ep, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>{ep.knowledge_point || ERROR_TYPE_LABELS[ep.error_type] || ep.error_type}</span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              ep.frequency === '高' ? 'bg-red-100 text-red-600' :
                              ep.frequency === '中' ? 'bg-yellow-100 text-yellow-600' :
                              'bg-green-100 text-green-600'
                            }`}>{ep.frequency}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <span className="text-xs text-gray-500">画像完整度</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(profileData.profile.confidence_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{Math.round((profileData.profile.confidence_score || 0) * 100)}%</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />练习表现
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-500">平均分</p>
                      <p className="text-xl font-bold text-green-600">{profileData.practice?.avg_score || 0}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-500">练习次数</p>
                      <p className="text-xl font-bold text-blue-600">{profileData.practice?.total_practices || 0}</p>
                    </div>
                  </div>
                  {profileData.practice?.recent_scores?.length > 0 && (
                    <div className="mt-2 p-3 bg-white border rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">近期成绩趋势</p>
                      <div className="flex items-end gap-1 h-16">
                        {profileData.practice.recent_scores.map((score, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div
                              className={`w-full rounded-t ${score >= 80 ? 'bg-green-400' : score >= 60 ? 'bg-yellow-400' : 'bg-red-400'}`}
                              style={{ height: `${Math.max(score, 5)}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />错题情况
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 bg-amber-50 rounded-lg">
                      <p className="text-xs text-gray-500">总错题数</p>
                      <p className="text-xl font-bold text-amber-600">{profileData.mistakes?.total || 0}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-xs text-gray-500">未掌握</p>
                      <p className="text-xl font-bold text-red-600">{profileData.mistakes?.by_status?.unmastered || profileData.mistakes?.by_status?.未掌握 || 0}</p>
                    </div>
                  </div>
                  {profileData.mistakes?.top_knowledge_points?.length > 0 && (
                    <div className="mt-2 p-3 bg-white border rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">薄弱知识点</p>
                      <div className="space-y-1">
                        {profileData.mistakes.top_knowledge_points.slice(0, 5).map(([point, count], i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="truncate">{point}</span>
                            <span className="text-red-500 ml-2">{count}次</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />学习进度
                </h4>
                {profileData.learning_progress?.length > 0 ? (
                  <div className="space-y-2">
                    {profileData.learning_progress.map((lp, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                        <span className="text-sm flex-1 truncate">{lp.course_title}</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${lp.progress_percentage >= 80 ? 'bg-green-500' : lp.progress_percentage >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`}
                            style={{ width: `${lp.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-12 text-right">{Math.round(lp.progress_percentage)}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-4">暂无学习进度数据</p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />学习互动
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 bg-indigo-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-indigo-600">{profileData.interaction?.questions_asked || 0}</p>
                    <p className="text-xs text-gray-500">提问次数</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-purple-600">{profileData.interaction?.videos_watched || 0}</p>
                    <p className="text-xs text-gray-500">观看视频</p>
                  </div>
                  <div className="p-3 bg-teal-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-teal-600">{profileData.interaction?.videos_completed || 0}</p>
                    <p className="text-xs text-gray-500">完成视频</p>
                  </div>
                  <div className="p-3 bg-cyan-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-cyan-600">{Math.round((profileData.interaction?.total_watch_time_seconds || 0) / 60)}</p>
                    <p className="text-xs text-gray-500">学习时长(分)</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 学生画像看板弹窗 */}
      <Dialog open={showDashboardDialog} onOpenChange={setShowDashboardDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radar className="w-5 h-5 text-purple-500" />
              学生学习画像看板
              {dashboardData?.user?.student_name && (
                <Badge variant="secondary" className="ml-2">{dashboardData.user.student_name}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {dashboardLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <span className="ml-3 text-gray-500">加载看板数据...</span>
            </div>
          ) : !dashboardData ? (
            <div className="text-center py-12 text-gray-400">
              <p>暂无看板数据</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 时间范围筛选 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">时间范围:</span>
                {['7', '30', '90'].map(range => (
                  <Button
                    key={range}
                    variant={dashboardTimeRange === range ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleDashboardTimeRangeChange(range)}
                    className="text-xs"
                  >
                    近{range}天
                  </Button>
                ))}
              </div>

              {/* AI 洞察 */}
              {dashboardData.insight && (
                <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <p className="text-sm font-medium text-purple-700 mb-1 flex items-center gap-1">
                    <Brain className="w-4 h-4" />AI 学习洞察
                  </p>
                  <p className="text-sm text-gray-700">{dashboardData.insight}</p>
                </div>
              )}

              {/* 概览统计 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-4">
                  <p className="text-blue-100 text-xs">在学课程</p>
                  <p className="text-2xl font-bold">{dashboardData.learning_outcomes?.total_courses || 0}</p>
                  <p className="text-blue-200 text-xs">已完成 {dashboardData.learning_outcomes?.completed_courses || 0} 门</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-lg p-4">
                  <p className="text-green-100 text-xs">平均成绩</p>
                  <p className="text-2xl font-bold">{dashboardData.learning_outcomes?.avg_score || 0}</p>
                  <p className="text-green-200 text-xs">最高 {dashboardData.learning_outcomes?.max_score || 0} 分</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-lg p-4">
                  <p className="text-purple-100 text-xs">累计学习</p>
                  <p className="text-2xl font-bold">{dashboardData.time_distribution?.total_estimated_hours?.toFixed(1) || 0}h</p>
                  <p className="text-purple-200 text-xs">近{dashboardTimeRange}天</p>
                </div>
                <div className="bg-gradient-to-br from-orange-500 to-amber-600 text-white rounded-lg p-4">
                  <p className="text-orange-100 text-xs">获得成就</p>
                  <p className="text-2xl font-bold">{dashboardData.learning_outcomes?.total_achievements || 0}</p>
                  <p className="text-orange-200 text-xs">练习 {dashboardData.learning_outcomes?.total_practices || 0} 次</p>
                </div>
              </div>

              {/* 画像维度 */}
              {dashboardData.dimension_scores && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-500" />画像维度评分
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(dashboardData.dimension_scores).map(([key, score]) => (
                      <div key={key} className="p-3 bg-white border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">{PROFILE_DIM_LABELS[key] || key}</span>
                          <span className="text-xs font-medium">{score}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 错题类型分布 */}
              {dashboardData.knowledge_mastery?.error_type_distribution?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />错题类型分布
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {dashboardData.knowledge_mastery.error_type_distribution.map((e, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {ERROR_TYPE_LABELS[e.type] || e.type} ({e.count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 薄弱知识点 */}
              {dashboardData.knowledge_mastery?.weak_points?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4 text-red-500" />薄弱知识点
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {dashboardData.knowledge_mastery.weak_points.map(([point, count], i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {point} <span className="text-red-400 ml-1">x{count}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 成就分类 */}
              {dashboardData.learning_outcomes?.achievement_categories && Object.keys(dashboardData.learning_outcomes.achievement_categories).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />成就分类
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dashboardData.learning_outcomes.achievement_categories).map(([cat, count]) => (
                      <Badge key={cat} variant="secondary" className="text-xs">
                        {ACHIEVEMENT_CATEGORY_LABELS[cat] || cat} ({count})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* 掌握程度 */}
              {dashboardData.learning_outcomes?.mastery_levels && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />课程掌握程度
                  </h4>
                  <div className="flex gap-3">
                    {Object.entries(dashboardData.learning_outcomes.mastery_levels).map(([level, count]) => (
                      <div key={level} className="text-center">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          level === '精通' ? 'bg-green-500' :
                          level === '熟练' ? 'bg-blue-500' :
                          level === '了解' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}>
                          {count}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{level}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 学习互动 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />学习互动
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 bg-indigo-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-indigo-600">{dashboardData.interaction_frequency?.total_questions || 0}</p>
                    <p className="text-xs text-gray-500">提问次数</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-purple-600">{dashboardData.interaction_frequency?.completed_videos || 0}/{dashboardData.interaction_frequency?.total_videos || 0}</p>
                    <p className="text-xs text-gray-500">视频完成</p>
                  </div>
                  <div className="p-3 bg-teal-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-teal-600">{dashboardData.interaction_frequency?.study_notes_count || 0}</p>
                    <p className="text-xs text-gray-500">学习笔记</p>
                  </div>
                  <div className="p-3 bg-cyan-50 rounded-lg text-center">
                    <p className="text-lg font-bold text-cyan-600">{dashboardData.interaction_frequency?.video_completion_rate || 0}%</p>
                    <p className="text-xs text-gray-500">视频完成率</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
