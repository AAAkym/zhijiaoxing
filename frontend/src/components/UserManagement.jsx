import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trash2, Edit, Plus, Users, AlertCircle, CheckCircle } from 'lucide-react'
import { users } from '../services/api'

const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

const validatePassword = (password) => {
  if (password.length < 6) return { valid: false, message: '密码至少需要6个字符' }
  if (!/[a-zA-Z]/.test(password)) return { valid: false, message: '密码需要包含字母' }
  if (!/[0-9]/.test(password)) return { valid: false, message: '密码需要包含数字' }
  return { valid: true, message: '' }
}

const getPasswordStrength = (password) => {
  if (!password) return { strength: 0, label: '', color: '' }
  let strength = 0
  if (password.length >= 6) strength++
  if (password.length >= 8) strength++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^a-zA-Z0-9]/.test(password)) strength++
  
  const levels = [
    { label: '非常弱', color: 'bg-red-500' },
    { label: '弱', color: 'bg-orange-500' },
    { label: '一般', color: 'bg-yellow-500' },
    { label: '强', color: 'bg-green-500' },
    { label: '非常强', color: 'bg-green-600' }
  ]
  return { strength, ...levels[Math.min(strength, 4)] }
}

export default function UserManagement() {
  const [userList, setUserList] = useState([])
  const [loading, setLoading] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [editFormErrors, setEditFormErrors] = useState({})
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    real_name: '',
    role: 'student',
    password: ''
  })

  // 加载用户列表
  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await users.getAll()
      setUserList(response.users || [])
    } catch (error) {
      console.error('加载用户列表失败:', error)
      // 使用模拟数据
      setUserList([
        { id: 1, username: 'admin', email: 'admin@example.com', real_name: '系统管理员', role: 'admin', created_at: '2025-01-01' },
        { id: 2, username: 'teacher', email: 'teacher@example.com', real_name: '示例教师', role: 'teacher', created_at: '2025-01-02' },
        { id: 3, username: 'student', email: 'student@example.com', real_name: '示例学生', role: 'student', created_at: '2025-01-03' }
      ])
    }
    setLoading(false)
  }

  const validateNewUserForm = () => {
    const errors = {}
    if (!newUser.username.trim()) {
      errors.username = '用户名不能为空'
    } else if (newUser.username.length < 3) {
      errors.username = '用户名至少需要3个字符'
    } else if (!/^[a-zA-Z0-9_]+$/.test(newUser.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
    }
    
    if (!newUser.email.trim()) {
      errors.email = '邮箱不能为空'
    } else if (!validateEmail(newUser.email)) {
      errors.email = '请输入有效的邮箱地址'
    }
    
    if (!newUser.real_name.trim()) {
      errors.real_name = '真实姓名不能为空'
    }
    
    if (!newUser.password) {
      errors.password = '密码不能为空'
    } else {
      const pwdValidation = validatePassword(newUser.password)
      if (!pwdValidation.valid) {
        errors.password = pwdValidation.message
      }
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateEditUserForm = () => {
    const errors = {}
    if (!editingUser.username.trim()) {
      errors.username = '用户名不能为空'
    } else if (editingUser.username.length < 3) {
      errors.username = '用户名至少需要3个字符'
    } else if (!/^[a-zA-Z0-9_]+$/.test(editingUser.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
    }
    
    if (!editingUser.email.trim()) {
      errors.email = '邮箱不能为空'
    } else if (!validateEmail(editingUser.email)) {
      errors.email = '请输入有效的邮箱地址'
    }
    
    if (!editingUser.real_name.trim()) {
      errors.real_name = '真实姓名不能为空'
    }
    
    setEditFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAddUser = async () => {
    if (!validateNewUserForm()) return
    
    try {
      await users.create(newUser)
      setIsAddDialogOpen(false)
      setNewUser({ username: '', email: '', real_name: '', role: 'student', password: '' })
      setFormErrors({})
      loadUsers()
      alert('用户添加成功！')
    } catch (error) {
      console.error('添加用户失败:', error)
      alert('用户添加失败：' + (error.message || '未知错误'))
    }
  }

  const handleEditUser = async () => {
    if (!validateEditUserForm()) return
    
    try {
      await users.update(editingUser.id, editingUser)
      setIsEditDialogOpen(false)
      setEditingUser(null)
      setEditFormErrors({})
      loadUsers()
      alert('用户更新成功！')
    } catch (error) {
      console.error('更新用户失败:', error)
      alert('用户更新失败：' + (error.message || '未知错误'))
    }
  }

  // 删除用户
  const handleDeleteUser = async (userId) => {
    if (!confirm('确定要删除这个用户吗？')) return
    
    try {
      await users.delete(userId)
      loadUsers()
      alert('用户删除成功！')
    } catch (error) {
      console.error('删除用户失败:', error)
      alert('用户删除失败：' + (error.message || '未知错误'))
    }
  }

  // 角色标签颜色
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'teacher': return 'bg-blue-100 text-blue-800'
      case 'student': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // 角色中文名
  const getRoleName = (role) => {
    switch (role) {
      case 'admin': return '管理员'
      case 'teacher': return '教师'
      case 'student': return '学生'
      default: return '未知'
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  return (
    <div className="space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">用户管理</h2>
          <p className="text-gray-600">管理系统中的所有用户</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              添加用户
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>添加新用户</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">用户名 <span className="text-red-500">*</span></Label>
                <Input
                  id="username"
                  value={newUser.username}
                  onChange={(e) => {
                    setNewUser({ ...newUser, username: e.target.value })
                    if (formErrors.username) setFormErrors({ ...formErrors, username: '' })
                  }}
                  placeholder="请输入用户名（3位以上字母数字）"
                  className={formErrors.username ? 'border-red-500' : ''}
                />
                {formErrors.username && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{formErrors.username}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="email">邮箱 <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => {
                    setNewUser({ ...newUser, email: e.target.value })
                    if (formErrors.email) setFormErrors({ ...formErrors, email: '' })
                  }}
                  placeholder="请输入有效邮箱地址"
                  className={formErrors.email ? 'border-red-500' : ''}
                />
                {formErrors.email && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{formErrors.email}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="real_name">真实姓名 <span className="text-red-500">*</span></Label>
                <Input
                  id="real_name"
                  value={newUser.real_name}
                  onChange={(e) => {
                    setNewUser({ ...newUser, real_name: e.target.value })
                    if (formErrors.real_name) setFormErrors({ ...formErrors, real_name: '' })
                  }}
                  placeholder="请输入真实姓名"
                  className={formErrors.real_name ? 'border-red-500' : ''}
                />
                {formErrors.real_name && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{formErrors.real_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="role">角色</Label>
                <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">学生</SelectItem>
                    <SelectItem value="teacher">教师</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="password">密码 <span className="text-red-500">*</span></Label>
                <Input
                  id="password"
                  type="password"
                  value={newUser.password}
                  onChange={(e) => {
                    setNewUser({ ...newUser, password: e.target.value })
                    if (formErrors.password) setFormErrors({ ...formErrors, password: '' })
                  }}
                  placeholder="请输入密码（至少6位，包含字母和数字）"
                  className={formErrors.password ? 'border-red-500' : ''}
                />
                {formErrors.password && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{formErrors.password}
                  </p>
                )}
                {newUser.password && !formErrors.password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500">密码强度</span>
                      <span className="text-xs text-gray-500">{getPasswordStrength(newUser.password).label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${getPasswordStrength(newUser.password).color}`}
                        style={{ width: `${getPasswordStrength(newUser.password).strength * 20}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsAddDialogOpen(false)
                  setFormErrors({})
                }}>
                  取消
                </Button>
                <Button onClick={handleAddUser}>
                  添加
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* 用户统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">总用户数</p>
                <p className="text-2xl font-bold text-gray-900">{userList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">管理员</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userList.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">教师</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userList.filter(u => u.role === 'teacher').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">学生</p>
                <p className="text-2xl font-bold text-gray-900">
                  {userList.filter(u => u.role === 'student').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>加载中...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>真实姓名</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userList.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.real_name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleName(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.created_at}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
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

      {/* 编辑用户对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open)
        if (!open) setEditFormErrors({})
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit_username">用户名 <span className="text-red-500">*</span></Label>
                <Input
                  id="edit_username"
                  value={editingUser.username}
                  onChange={(e) => {
                    setEditingUser({ ...editingUser, username: e.target.value })
                    if (editFormErrors.username) setEditFormErrors({ ...editFormErrors, username: '' })
                  }}
                  className={editFormErrors.username ? 'border-red-500' : ''}
                />
                {editFormErrors.username && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{editFormErrors.username}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit_email">邮箱 <span className="text-red-500">*</span></Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => {
                    setEditingUser({ ...editingUser, email: e.target.value })
                    if (editFormErrors.email) setEditFormErrors({ ...editFormErrors, email: '' })
                  }}
                  className={editFormErrors.email ? 'border-red-500' : ''}
                />
                {editFormErrors.email && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{editFormErrors.email}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit_real_name">真实姓名 <span className="text-red-500">*</span></Label>
                <Input
                  id="edit_real_name"
                  value={editingUser.real_name}
                  onChange={(e) => {
                    setEditingUser({ ...editingUser, real_name: e.target.value })
                    if (editFormErrors.real_name) setEditFormErrors({ ...editFormErrors, real_name: '' })
                  }}
                  className={editFormErrors.real_name ? 'border-red-500' : ''}
                />
                {editFormErrors.real_name && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />{editFormErrors.real_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="edit_role">角色</Label>
                <Select value={editingUser.role} onValueChange={(value) => setEditingUser({ ...editingUser, role: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">学生</SelectItem>
                    <SelectItem value="teacher">教师</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsEditDialogOpen(false)
                  setEditFormErrors({})
                }}>
                  取消
                </Button>
                <Button onClick={handleEditUser}>
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

