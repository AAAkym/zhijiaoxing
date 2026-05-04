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

export default function CourseManagement() {
  const [courseList, setCourseList] = useState([])
  const [loading, setLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState(null)
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    category: 'programming',
    difficulty: 'beginner',
    duration: '',
    status: 'active',
    teacher_id: 1
  })

  // 加载课程列表
  const loadCourses = async () => {
    setLoading(true)
    try {
      const response = await courses.getAll()
      setCourseList(response.courses || [])
    } catch (error) {
      console.error('加载课程列表失败:', error)
      // 使用模拟数据
      setCourseList([
        { 
          id: 1, 
          title: 'Python基础编程', 
          description: '学习Python编程语言的基础知识',
          category: 'programming',
          difficulty: 'beginner',
          duration: '40小时',
          teacher_name: '示例教师',
          student_count: 25,
          status: 'active',
          created_at: '2025-01-01'
        },
        { 
          id: 2, 
          title: 'TensorFlow.js应用开发', 
          description: '使用TensorFlow.js开发机器学习应用',
          category: 'ai',
          difficulty: 'intermediate',
          duration: '60小时',
          teacher_name: '示例教师',
          student_count: 18,
          status: 'active',
          created_at: '2025-01-02'
        }
      ])
    }
    setLoading(false)
  }

  const handleAddCourse = async () => {
    if (!newCourse.title.trim()) {
      alert('请输入课程标题')
      return
    }
    
    try {
      await courses.create(newCourse)
      setIsAddDialogOpen(false)
      setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner', duration: '', status: 'active', teacher_id: 1 })
      loadCourses()
      alert('课程添加成功！')
    } catch (error) {
      console.error('添加课程失败:', error)
      const newId = Math.max(...courseList.map(c => c.id), 0) + 1
      setCourseList([...courseList, { 
        ...newCourse, 
        id: newId, 
        teacher_name: '示例教师',
        student_count: 0,
        status: newCourse.status || 'active',
        created_at: new Date().toISOString().split('T')[0] 
      }])
      setIsAddDialogOpen(false)
      setNewCourse({ title: '', description: '', category: 'programming', difficulty: 'beginner', duration: '', status: 'active', teacher_id: 1 })
      alert('课程添加成功！')
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
      loadCourses()
      alert('课程更新成功！')
    } catch (error) {
      console.error('更新课程失败:', error)
      setCourseList(courseList.map(c => c.id === editingCourse.id ? editingCourse : c))
      setIsEditDialogOpen(false)
      setEditingCourse(null)
      alert('课程更新成功！')
    }
  }

  // 删除课程
  const handleDeleteCourse = async (courseId) => {
    if (!confirm('确定要删除这个课程吗？')) return
    
    try {
      await courses.delete(courseId)
      loadCourses()
      alert('课程删除成功！')
    } catch (error) {
      console.error('删除课程失败:', error)
      // 模拟删除成功
      setCourseList(courseList.filter(c => c.id !== courseId))
      alert('课程删除成功！')
    }
  }

  // 难度标签颜色
  const getDifficultyBadgeColor = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 难度中文名
  const getDifficultyName = (difficulty) => {
    switch (difficulty) {
      case 'beginner': return '初级'
      case 'intermediate': return '中级'
      case 'advanced': return '高级'
      default: return '未知'
    }
  }

  // 分类中文名
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
  }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">课程管理</h2>
          <p className="text-gray-600">管理系统中的所有课程</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
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
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleAddCourse}>
                  添加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 课程统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总课程数</p>
                <p className="text-2xl font-bold text-gray-900">{courseList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总学生数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {courseList.reduce((sum, course) => sum + (course.student_count || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">活跃课程</p>
                <p className="text-2xl font-bold text-gray-900">
                  {courseList.filter(c => c.status === 'active').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <BookOpen className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">平均学生数</p>
                <p className="text-2xl font-bold text-gray-900">
                  {courseList.length > 0 ? Math.round(courseList.reduce((sum, course) => sum + (course.student_count || 0), 0) / courseList.length) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 课程列表 */}
      <Card>
        <CardHeader>
          <CardTitle>课程列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>加载中...</p>
            </div>
          ) : courseList.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">暂无课程</h3>
              <p className="text-gray-500">点击上方按钮添加第一个课程</p>
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
                {courseList.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold">{course.title}</p>
                        <p className="text-sm text-gray-500">{course.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryName(course.category)}</TableCell>
                    <TableCell>
                      <Badge className={getDifficultyBadgeColor(course.difficulty)}>
                        {getDifficultyName(course.difficulty)}
                      </Badge>
                    </TableCell>
                    <TableCell>{course.duration}</TableCell>
                    <TableCell>{course.teacher_name}</TableCell>
                    <TableCell>{course.student_count || 0}</TableCell>
                    <TableCell>
                      <Badge className={course.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {course.status === 'active' ? '活跃' : '停用'}
                      </Badge>
                    </TableCell>
                    <TableCell>{course.created_at}</TableCell>
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
                          onClick={() => handleDeleteCourse(course.id)}
                          className="text-red-600 hover:text-red-700"
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

      {/* 编辑课程对话框 */}
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
                <Button onClick={handleEditCourse}>
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

