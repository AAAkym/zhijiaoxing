import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, BookOpen, Users, Clock } from 'lucide-react'
import { courses } from '../services/api'
import { request } from '../services/api'

export default function CourseManagement() {
  const [courseList, setCourseList] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingCourseId, setDeletingCourseId] = useState(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [teacherList, setTeacherList] = useState([])
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'programming',
    difficulty: 'beginner',
    duration: '',
    status: 'active',
    teacher_id: ''
  })

  const loadTeachers = async () => {
    try {
      const response = await request('/users?role=teacher')
      const users = response.users || response || []
      setTeacherList(Array.isArray(users) ? users.filter(u => u.role === 'teacher') : [])
    } catch (error) {
      console.error('加载教师列表失败:', error)
      setTeacherList([])
    }
  }

  const loadCourses = async () => {
    setLoading(true)
    try {
      const response = await courses.getAll()
      const coursesArr = response.courses || []
      const seen = new Set()
      const uniqueCourses = coursesArr.filter(c => {
        if (!c || c.id == null) return false
        const key = String(c.id)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setCourseList(uniqueCourses)
    } catch (error) {
      console.error('加载课程列表失败:', error)
      setCourseList([])
    }
    setLoading(false)
  }

  const handleAddCourse = async () => {
    if (!newCourse.title.trim()) {
      alert('请输入课程标题')
      return
    }
    if (!newCourse.teacher_id) {
      alert('请选择授课教师')
      return
    }
    
    try {
      await courses.create(newCourse)
      setIsAddDialogOpen(false)
      setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner', duration: '', status: 'active', teacher_id: '' })
      await loadCourses()
      alert('课程添加成功！')
    } catch (error) {
      console.error('添加课程失败:', error)
      const errMsg = error?.message || error?.errorDetail || '添加课程失败，请检查网络或教师选择是否正确'
      alert(errMsg)
    }
  }

  const handleEditCourse = async () => {
    if (!editingCourse.title.trim()) {
      alert('请输入课程标题')
      return
    }
    
    try {
      await courses.update(editingCourse.id, editingCourse)
      setIsEditDialogOpen(false)
      setEditingCourse(null)
      await loadCourses()
      alert('课程更新成功！')
    } catch (error) {
      console.error('更新课程失败:', error)
      const errMsg = error?.message || error?.errorDetail || '更新课程失败，请重试'
      alert(errMsg)
    }
  }

  const handleDeleteCourse = async (courseId, courseTitle) => {
    if (!courseId || deletingCourseId) return

    const message = `⚠️ 删除课程确认\n\n即将删除课程：「${courseTitle || courseId}」\n\n此操作将永久删除以下所有关联数据，且不可恢复：\n• 课程基本信息与封面\n• 所有视频教学资源\n• 课程讲义与学习资料\n• 章节结构与知识点\n• 学生学习记录与进度\n• 课程讨论与评论\n• 知识图谱与题库\n\n确定要继续吗？`
    if (!confirm(message)) return

    try {
      setDeletingCourseId(courseId)
      const result = await courses.delete(courseId)
      await loadCourses()
      alert(result?.message || '课程删除成功！所有关联数据已清除。')
    } catch (error) {
      console.error('删除课程失败:', error)
      const errMsg = error?.message || error?.errorDetail || '删除课程失败，请重试'
      alert(errMsg)
    } finally {
      setDeletingCourseId(null)
    }
  }

  const getDifficultyBadgeColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-[#5a9e6f12] text-[#5a9e6f]'
      case 'intermediate': return 'bg-[#d4a85312] text-[#d4a853]'
      case 'advanced': return 'bg-[#c45a5a12] text-[#c45a5a]'
      default: return 'bg-[#f5f2ee] text-[#6b6560]'
    }
  }

  const getDifficultyName = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return '初级'
      case 'intermediate': return '中级'
      case 'advanced': return '高级'
      default: return '未知'
    }
  }

  const getCategoryName = (category) => {
    switch (category) {
      case 'programming': return '编程'
      case 'ai': return '人工智能'
      case 'data': return '数据科学'
      case 'web': return 'Web开发'
      default: return '其他'
    }
  }

  useEffect(() => {
    loadCourses()
    loadTeachers()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-[#2d2a26]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>课程管理</h2>
          <p className="text-[#6b6560]">管理系统中的所有课程</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#d4a853] hover:bg-[#c49a48] text-white">
              <Plus className="w-4 h-4 mr-2" />
              添加课程
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>添加新课程</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">课程标题</Label>
                <Input
                  id="title"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="请输入课程标题"
                />
              </div>
              <div>
                <Label htmlFor="description">课程描述</Label>
                <Textarea
                  id="description"
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="请输入课程描述"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">课程分类</Label>
                  <Select value={newCourse.category} onValueChange={(value) => setNewCourse({ ...newCourse, category: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择分类" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programming">编程</SelectItem>
                      <SelectItem value="ai">人工智能</SelectItem>
                      <SelectItem value="data">数据科学</SelectItem>
                      <SelectItem value="web">Web开发</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="difficulty">难度等级</Label>
                  <Select value={newCourse.difficulty} onValueChange={(value) => setNewCourse({ ...newCourse, difficulty: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择难度" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">初级</SelectItem>
                      <SelectItem value="intermediate">中级</SelectItem>
                      <SelectItem value="advanced">高级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="duration">课程时长</Label>
                <Input
                  id="duration"
                  value={newCourse.duration}
                  onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                  placeholder="例如：40小时"
                />
              </div>
              <div>
                <Label htmlFor="teacher">授课教师</Label>
                <Select value={newCourse.teacher_id ? String(newCourse.teacher_id) : ''} onValueChange={(value) => setNewCourse({ ...newCourse, teacher_id: Number(value) })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择授课教师" />
                  </SelectTrigger>
                  <SelectContent>
                    {teacherList.map((teacher) => (
                      <SelectItem key={teacher.id} value={String(teacher.id)}>
                        {teacher.real_name || teacher.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddCourse} className="bg-[#d4a853] hover:bg-[#c49a48] text-white">
                  添加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-[#d4a853]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">总课程数</p>
                <p className="text-2xl font-bold text-[#2d2a26]">{courseList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-[#5a9e6f]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">总学生数</p>
                <p className="text-2xl font-bold text-[#2d2a26]">
                  {courseList.reduce((sum, course) => sum + (course.student_count || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-[#c47a3a]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">活跃课程</p>
                <p className="text-2xl font-bold text-[#2d2a26]">
                  {courseList.filter(c => c.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl border-[#f0ece7]">
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-[#8b6fb0]" />
              <div className="ml-4">
                <p className="text-sm font-medium text-[#6b6560]">平均学生数</p>
                <p className="text-2xl font-bold text-[#2d2a26]">
                  {courseList.length > 0 ? Math.round(courseList.reduce((sum, course) => sum + (course.student_count || 0), 0) / courseList.length) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-[#f0ece7]">
        <CardHeader>
          <CardTitle className="text-[#2d2a26]">课程列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-[#6b6560]">加载中...</p>
            </div>
          ) : courseList.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-16 w-16 text-[#c5c0bb] mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[#2d2a26] mb-2">暂无课程</h3>
              <p className="text-[#9a9590]">点击上方按钮添加第一个课程</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>课程标题</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>难度</TableHead>
                  <TableHead>时长</TableHead>
                  <TableHead>教师</TableHead>
                  <TableHead>学生数</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courseList.map((course, idx) => (
                  <TableRow key={course.id != null ? `course-${course.id}` : `course-idx-${idx}`}>
                    <TableCell className="font-medium whitespace-normal">
                      <div>
                        <p className="font-semibold text-[#2d2a26]">{course.title}</p>
                        <p className="text-sm text-[#9a9590] line-clamp-2">{course.description}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6b6560]">{getCategoryName(course.category)}</TableCell>
                    <TableCell>
                      <Badge className={getDifficultyBadgeColor(course.difficulty)}>
                        {getDifficultyName(course.difficulty)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#6b6560]">{course.duration}</TableCell>
                    <TableCell className="text-[#6b6560]">{course.teacher_name}</TableCell>
                    <TableCell className="text-[#2d2a26]">{course.student_count || 0}</TableCell>
                    <TableCell>
                      <Badge className={course.status === 'active' ? 'bg-[#5a9e6f12] text-[#5a9e6f]' : 'bg-[#f5f2ee] text-[#6b6560]'}>
                        {course.status === 'active' ? '活跃' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#9a9590]">{course.created_at}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCourse(course)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCourse(course.id, course.title)}
                          disabled={deletingCourseId === course.id}
                          className="text-[#c45a5a] hover:text-[#b04a4a]"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑课程</DialogTitle>
          </DialogHeader>
          {editingCourse && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_title">课程标题</Label>
                <Input
                  id="edit_title"
                  value={editingCourse.title}
                  onChange={(e) => setEditingCourse({ ...editingCourse, title: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_description">课程描述</Label>
                <Textarea
                  id="edit_description"
                  value={editingCourse.description}
                  onChange={(e) => setEditingCourse({ ...editingCourse, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_category">课程分类</Label>
                  <Select value={editingCourse.category} onValueChange={(value) => setEditingCourse({ ...editingCourse, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="programming">编程</SelectItem>
                      <SelectItem value="ai">人工智能</SelectItem>
                      <SelectItem value="data">数据科学</SelectItem>
                      <SelectItem value="web">Web开发</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_difficulty">难度等级</Label>
                  <Select value={editingCourse.difficulty} onValueChange={(value) => setEditingCourse({ ...editingCourse, difficulty: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">初级</SelectItem>
                      <SelectItem value="intermediate">中级</SelectItem>
                      <SelectItem value="advanced">高级</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit_duration">课程时长</Label>
                <Input
                  id="edit_duration"
                  value={editingCourse.duration}
                  onChange={(e) => setEditingCourse({ ...editingCourse, duration: e.target.value })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleEditCourse} className="bg-[#d4a853] hover:bg-[#c49a48] text-white">
                  保存
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
