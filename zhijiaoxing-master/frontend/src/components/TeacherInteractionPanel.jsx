import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Hand, MessageCircle, Users, CheckCircle, Clock,
  Send, ThumbsUp, Pin, Eye, UserCheck, AlertCircle
} from 'lucide-react'
import { interaction, courses } from '../services/api'
import websocketService from '../services/websocket'

export default function TeacherInteractionPanel({ courseId }) {
  const [loading, setLoading] = useState(false)
  const [notification, setNotification] = useState(null)
  
  // 举手管理
  const [handRaises, setHandRaises] = useState([])
  
  // 问答管理
  const [questions, setQuestions] = useState([])
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [answerContent, setAnswerContent] = useState('')
  const [answerDialog, setAnswerDialog] = useState(false)
  
  // 讨论管理
  const [discussions, setDiscussions] = useState([])

  useEffect(() => {
    if (courseId) {
      initializeWebSocket()
      loadData()
    }

    return () => {
      if (courseId) {
        websocketService.leaveCourse(courseId)
      }
    }
  }, [courseId])

  // 初始化 WebSocket 连接
  const initializeWebSocket = () => {
    if (!websocketService.isConnected()) {
      websocketService.connect()
    }

    // 加入课程房间
    websocketService.joinCourse(courseId)

    // 监听实时更新
    websocketService.on('hand_raise_updated', handleHandRaiseUpdate)
    websocketService.on('question_updated', handleQuestionUpdate)
    websocketService.on('discussion_updated', handleDiscussionUpdate)
  }

  // 举手更新处理
  const handleHandRaiseUpdate = (data) => {
    if (data.course_id === courseId) {
      showNotification('举手状态已更新', 'info')
      loadData()
    }
  }

  // 问答更新处理
  const handleQuestionUpdate = (data) => {
    if (data.course_id === courseId) {
      showNotification('问答有更新', 'info')
      loadData()
    }
  }

  // 讨论更新处理
  const handleDiscussionUpdate = (data) => {
    if (data.course_id === courseId) {
      showNotification('讨论有更新', 'info')
      loadData()
    }
  }

  // 显示通知
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const loadData = async () => {
    try {
      setLoading(true)
      
      // 加载举手列表
      try {
        const hrRes = await interaction.getHandRaises(courseId, { status: 'waiting' })
        setHandRaises(hrRes.hand_raises || [])
      } catch (e) {
        console.log('No hand raises')
      }
      
      // 加载问题列表
      try {
        const qRes = await interaction.getQuestions(courseId, { status: 'pending' })
        setQuestions(qRes.questions || [])
      } catch (e) {
        console.log('No questions')
      }
      
      // 加载讨论
      try {
        const dRes = await interaction.getDiscussions(courseId)
        setDiscussions(dRes.discussions || [])
      } catch (e) {
        console.log('No discussions')
      }
      
    } catch (error) {
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 点名
  const handleCallStudent = async (handRaiseId) => {
    try {
      await interaction.callHandRaise(handRaiseId)
      loadData()
      alert('已点名')
    } catch (error) {
      console.error('点名失败:', error)
    }
  }

  // 解决举手
  const handleResolveHandRaise = async (handRaiseId) => {
    try {
      await interaction.resolveHandRaise(handRaiseId)
      loadData()
    } catch (error) {
      console.error('解决失败:', error)
    }
  }

  // 回答问题
  const handleSubmitAnswer = async () => {
    if (!answerContent.trim() || !selectedQuestion) return
    
    try {
      await interaction.createAnswer(selectedQuestion.id, { content: answerContent })
      setAnswerContent('')
      setAnswerDialog(false)
      setSelectedQuestion(null)
      loadData()
      alert('回答已提交')
    } catch (error) {
      console.error('回答失败:', error)
      alert('回答失败: ' + error.message)
    }
  }

  // 采纳答案
  const handleAcceptAnswer = async (answerId) => {
    try {
      await interaction.acceptAnswer(answerId)
      loadData()
    } catch (error) {
      console.error('采纳失败:', error)
    }
  }

  // 置顶讨论
  const handlePinDiscussion = async (discussionId) => {
    try {
      await interaction.pinDiscussion(discussionId)
      showNotification('讨论已置顶', 'success')
      loadData()
    } catch (error) {
      console.error('置顶失败:', error)
      showNotification('置顶失败', 'error')
    }
  }

  // 删除讨论
  const handleDeleteDiscussion = async (discussionId) => {
    if (!confirm('确定要删除这个讨论吗？')) return
    
    try {
      await interaction.deleteDiscussion(discussionId)
      showNotification('讨论已删除', 'success')
      loadData()
    } catch (error) {
      console.error('删除失败:', error)
      showNotification('删除失败', 'error')
    }
  }

  return (
    <div className="space-y-6">
      {/* 通知提示 */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">互动管理</h3>
        <Button variant="outline" size="sm" onClick={loadData}>
          刷新
        </Button>
      </div>

      <Tabs defaultValue="handraises">
        <TabsList>
          <TabsTrigger value="handraises" className="flex items-center gap-1">
            <Hand className="w-4 h-4" />
            举手 ({handRaises.length})
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            问答 ({questions.length})
          </TabsTrigger>
          <TabsTrigger value="discussions" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            讨论 ({discussions.length})
          </TabsTrigger>
        </TabsList>

        {/* 举手管理 */}
        <TabsContent value="handraises" className="space-y-4">
          {handRaises.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Hand className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">暂无学生举手</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {handRaises.map((hr) => (
                <Card key={hr.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Hand className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{hr.user_name}</span>
                            <Badge variant="secondary">
                              <Clock className="w-3 h-3 mr-1" />
                              等待中
                            </Badge>
                          </div>
                          {hr.reason && (
                            <p className="text-sm text-gray-600 mt-1">{hr.reason}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(hr.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleCallStudent(hr.id)}>
                          <UserCheck className="w-4 h-4 mr-1" />
                          点名
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleResolveHandRaise(hr.id)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          完成
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 问答管理 */}
        <TabsContent value="questions" className="space-y-4">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">暂无待回答问题</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{q.title}</h4>
                          <Badge variant={
                            q.status === 'resolved' ? 'default' :
                            q.status === 'answered' ? 'secondary' : 'destructive'
                          }>
                            {q.status === 'resolved' ? '已解决' :
                             q.status === 'answered' ? '已回答' : '待回答'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{q.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{q.user_name}</span>
                          <span>·</span>
                          <span>{new Date(q.created_at).toLocaleDateString()}</span>
                          {q.video_timestamp && (
                            <>
                              <span>·</span>
                              <span>视频 {Math.floor(q.video_timestamp / 60)}:{Math.floor(q.video_timestamp % 60).toString().padStart(2, '0')}</span>
                            </>
                          )}
                        </div>
                        
                        {/* 显示已有回答 */}
                        {q.answers && q.answers.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {q.answers.map((a) => (
                              <div key={a.id} className={`p-2 rounded ${a.is_accepted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{a.user_name}</span>
                                      {a.is_teacher_answer && (
                                        <Badge variant="outline" className="text-xs">教师</Badge>
                                      )}
                                      {a.is_accepted && (
                                        <Badge className="text-xs bg-green-100 text-green-700">最佳答案</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-gray-600 mt-1">{a.content}</p>
                                  </div>
                                  {!a.is_accepted && q.status !== 'resolved' && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      onClick={() => handleAcceptAnswer(a.id)}
                                    >
                                      采纳
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedQuestion(q)
                          setAnswerDialog(true)
                        }}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        回答
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 讨论管理 */}
        <TabsContent value="discussions" className="space-y-4">
          {discussions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">暂无讨论</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {discussions.map((d) => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{d.user_name}</span>
                            {d.is_pinned && (
                              <Badge variant="outline">
                                <Pin className="w-3 h-3 mr-1" />
                                置顶
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{d.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              {d.likes_count || 0}
                            </span>
                            <span>{d.replies_count || 0} 回复</span>
                            <span>{new Date(d.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handlePinDiscussion(d.id)}
                        >
                          <Pin className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteDiscussion(d.id)}
                        >
                          <AlertCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 回答问题对话框 */}
      <Dialog open={answerDialog} onOpenChange={setAnswerDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>回答问题</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuestion && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="font-medium">{selectedQuestion.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{selectedQuestion.content}</p>
              </div>
            )}
            <div>
              <Label>回答内容</Label>
              <Textarea
                value={answerContent}
                onChange={(e) => setAnswerContent(e.target.value)}
                placeholder="输入你的回答..."
                rows={5}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAnswerDialog(false)}>取消</Button>
              <Button onClick={handleSubmitAnswer}>提交回答</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
