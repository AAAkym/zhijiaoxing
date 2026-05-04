import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Hand, MessageCircle, Users, CheckCircle, Clock, XCircle,
  Send, ThumbsUp, Pin, Eye, UserCheck, AlertCircle, MessageSquare
} from 'lucide-react'
import { interaction, courses } from '../services/api'
import websocketService from '../services/websocket'

export default function StudentInteractionPanel({ courseId, videoId }) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('handraises')
  
  // 举手状态
  const [currentHandRaise, setCurrentHandRaise] = useState(null)
  const [handRaiseReason, setHandRaiseReason] = useState('')
  const [showHandRaiseDialog, setShowHandRaiseDialog] = useState(false)
  
  // 问答状态
  const [questions, setQuestions] = useState([])
  const [showQuestionDialog, setShowQuestionDialog] = useState(false)
  const [questionTitle, setQuestionTitle] = useState('')
  const [questionContent, setQuestionContent] = useState('')
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [showQuestionDetail, setShowQuestionDetail] = useState(false)
  const [answerContent, setAnswerContent] = useState('')
  
  // 讨论状态
  const [discussions, setDiscussions] = useState([])
  const [showDiscussionDialog, setShowDiscussionDialog] = useState(false)
  const [discussionContent, setDiscussionContent] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  
  // 通知和错误
  const [notification, setNotification] = useState(null)
  const [error, setError] = useState(null)

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

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // 加载我的举手
      try {
        const hrRes = await interaction.getHandRaises(courseId, { status: 'waiting' })
        const myHandRaises = hrRes.hand_raises || []
        const myHandRaise = myHandRaises.find(hr => hr.user_id === JSON.parse(localStorage.getItem('user') || '{}').id)
        setCurrentHandRaise(myHandRaise || null)
      } catch (e) {
        console.log('No hand raises')
      }
      
      // 加载问题列表
      try {
        const qRes = await interaction.getQuestions(courseId)
        // 确保每个问题都有 answers 数组
        const questionsWithAnswers = (qRes.questions || []).map(q => ({
          ...q,
          answers: q.answers || []
        }))
        setQuestions(questionsWithAnswers)
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
      setError('加载数据失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 举手功能
  const handleHandRaise = async () => {
    try {
      const data = {
        video_id: videoId,
        reason: handRaiseReason || '请求帮助'
      }
      
      const result = await interaction.createHandRaise(courseId, data)
      setCurrentHandRaise(result.hand_raise)
      setHandRaiseReason('')
      setShowHandRaiseDialog(false)
      
      // 发送 WebSocket 事件
      websocketService.sendHandRaiseEvent(courseId)
      
      showNotification('举手成功，等待老师回应', 'success')
    } catch (error) {
      console.error('举手失败:', error)
      showNotification(error.message || '举手失败', 'error')
    }
  }

  // 取消举手
  const handleCancelHandRaise = async () => {
    if (!currentHandRaise) return
    
    try {
      await interaction.resolveHandRaise(currentHandRaise.id)
      setCurrentHandRaise(null)
      
      // 发送 WebSocket 事件
      websocketService.sendHandRaiseEvent(courseId)
      
      showNotification('已取消举手', 'info')
    } catch (error) {
      console.error('取消失败:', error)
      showNotification('取消失败', 'error')
    }
  }

  // 创建问题
  const handleCreateQuestion = async () => {
    if (!questionTitle.trim() || !questionContent.trim()) {
      showNotification('请填写标题和内容', 'error')
      return
    }
    
    try {
      const data = {
        title: questionTitle,
        content: questionContent,
        video_id: videoId
      }
      
      await interaction.createQuestion(courseId, data)
      setQuestionTitle('')
      setQuestionContent('')
      setShowQuestionDialog(false)
      
      // 发送 WebSocket 事件
      websocketService.sendQuestionEvent(courseId, null, 'created')
      
      showNotification('问题提交成功', 'success')
      loadData()
    } catch (error) {
      console.error('提交问题失败:', error)
      showNotification(error.message || '提交失败', 'error')
    }
  }

  // 提交答案
  const handleSubmitAnswer = async (questionId) => {
    if (!answerContent.trim()) {
      showNotification('请填写回答内容', 'error')
      return
    }
    
    try {
      await interaction.createAnswer(questionId, { content: answerContent })
      setAnswerContent('')
      setShowQuestionDetail(false)
      setSelectedQuestion(null)
      
      // 发送 WebSocket 事件
      websocketService.sendQuestionEvent(courseId, questionId, 'answered')
      
      showNotification('回答提交成功', 'success')
      loadData()
    } catch (error) {
      console.error('提交回答失败:', error)
      showNotification('提交失败', 'error')
    }
  }

  // 创建讨论
  const handleCreateDiscussion = async () => {
    if (!discussionContent.trim()) {
      showNotification('请填写讨论内容', 'error')
      return
    }
    
    try {
      const data = {
        content: discussionContent,
        parent_id: replyTo ? replyTo.id : null
      }
      
      await interaction.createDiscussion(courseId, data)
      setDiscussionContent('')
      setReplyTo(null)
      setShowDiscussionDialog(false)
      
      // 发送 WebSocket 事件
      websocketService.sendDiscussionEvent(courseId, null, 'created')
      
      showNotification('发布成功', 'success')
      loadData()
    } catch (error) {
      console.error('发布失败:', error)
      showNotification('发布失败', 'error')
    }
  }

  // 点赞讨论
  const handleLikeDiscussion = async (discussionId) => {
    try {
      await interaction.likeDiscussion(discussionId)
      showNotification('已点赞', 'success')
      loadData()
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }

  // 显示通知
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  // 获取状态徽章
  const getStatusBadge = (status) => {
    const statusMap = {
      'waiting': { label: '等待中', variant: 'secondary', icon: Clock },
      'called': { label: '已点名', variant: 'default', icon: UserCheck },
      'pending': { label: '待回答', variant: 'destructive', icon: AlertCircle },
      'answered': { label: '已回答', variant: 'secondary', icon: MessageCircle },
      'resolved': { label: '已解决', variant: 'default', icon: CheckCircle }
    }
    
    const config = statusMap[status] || { label: status, variant: 'outline', icon: Clock }
    const Icon = config.icon
    
    return (
      <Badge variant={config.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      {/* 通知提示 */}
      {notification && (
        <Alert variant={notification.type === 'error' ? 'destructive' : 'default'}>
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      )}

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="handraises" className="flex items-center gap-1">
            <Hand className="w-4 h-4" />
            举手
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-1">
            <MessageCircle className="w-4 h-4" />
            问答
          </TabsTrigger>
          <TabsTrigger value="discussions" className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            讨论
          </TabsTrigger>
        </TabsList>

        {/* 举手功能 */}
        <TabsContent value="handraises" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>举手提问</span>
                <Button size="sm" onClick={loadData}>
                  刷新
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentHandRaise ? (
                <div className="space-y-4">
                  <Alert>
                    <Hand className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span>
                          你的举手请求：{getStatusBadge(currentHandRaise.status)}
                        </span>
                        {currentHandRaise.status === 'waiting' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={handleCancelHandRaise}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            取消
                          </Button>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                  {currentHandRaise.reason && (
                    <p className="text-sm text-gray-600">原因：{currentHandRaise.reason}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    创建时间：{new Date(currentHandRaise.created_at).toLocaleString()}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Hand className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 mb-4">暂无举手请求</p>
                  <Button onClick={() => setShowHandRaiseDialog(true)}>
                    <Hand className="w-4 h-4 mr-2" />
                    举手提问
                  </Button>
                </div>
              )}

              {/* 举手弹窗 */}
              {showHandRaiseDialog && (
                <div 
                  className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center"
                  onClick={() => setShowHandRaiseDialog(false)}
                >
                  <div 
                    className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">举手提问</h3>
                      <button 
                        onClick={() => setShowHandRaiseDialog(false)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">举手原因（可选）</label>
                        <Textarea
                          value={handRaiseReason}
                          onChange={(e) => setHandRaiseReason(e.target.value)}
                          placeholder="请简要描述你需要帮助的问题..."
                          rows={4}
                          className="w-full"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowHandRaiseDialog(false)}>取消</Button>
                        <Button onClick={handleHandRaise}>提交</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 问答功能 */}
        <TabsContent value="questions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">问题列表</h3>
            <Button onClick={() => setShowQuestionDialog(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              提问
            </Button>
          </div>

          {/* 提问弹窗 */}
          {showQuestionDialog && (
            <div 
              className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center"
              onClick={() => setShowQuestionDialog(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">提出问题</h3>
                  <button 
                    onClick={() => setShowQuestionDialog(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">问题标题</label>
                    <Input
                      value={questionTitle}
                      onChange={(e) => setQuestionTitle(e.target.value)}
                      placeholder="简要描述你的问题"
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">问题详情</label>
                    <Textarea
                      value={questionContent}
                      onChange={(e) => setQuestionContent(e.target.value)}
                      placeholder="详细描述你的问题..."
                      rows={5}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>取消</Button>
                    <Button onClick={handleCreateQuestion}>提交</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {questions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">暂无问题</p>
                </CardContent>
              </Card>
            ) : (
              questions.map((q) => (
                <Card key={q.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{q.title}</h4>
                          {getStatusBadge(q.status)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{q.content}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>{q.user_name}</span>
                          <span>·</span>
                          <span>{new Date(q.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        {/* 显示已有回答 */}
                        {(q.answers && q.answers.length > 0) && (
                          <div className="mt-3 space-y-2">
                            {q.answers.map((a) => (
                              <div key={a.id} className={`p-2 rounded ${a.is_accepted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
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
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedQuestion(q)
                          setShowQuestionDetail(true)
                        }}
                      >
                        查看
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* 问题详情弹窗 */}
          {showQuestionDetail && selectedQuestion && (
            <div 
              className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center overflow-y-auto"
              onClick={() => setShowQuestionDetail(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 my-8 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">问题详情</h3>
                  <button 
                    onClick={() => setShowQuestionDetail(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium">{selectedQuestion.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedQuestion.status)}
                      <span className="text-xs text-gray-500">
                        {new Date(selectedQuestion.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{selectedQuestion.content}</p>
                  </div>
                  
                  {/* 回答列表 */}
                  {(selectedQuestion.answers && selectedQuestion.answers.length > 0) && (
                    <div className="space-y-3">
                      <h5 className="font-medium">回答</h5>
                      {selectedQuestion.answers.map((a) => (
                        <div key={a.id} className={`p-3 rounded ${a.is_accepted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{a.user_name}</span>
                            {a.is_teacher_answer && (
                              <Badge variant="outline" className="text-xs">教师</Badge>
                            )}
                            {a.is_accepted && (
                              <Badge className="text-xs bg-green-100 text-green-700">最佳答案</Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(a.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{a.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* 回答输入框 */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">你的回答</label>
                    <Textarea
                      value={answerContent}
                      onChange={(e) => setAnswerContent(e.target.value)}
                      placeholder="写下你的回答..."
                      rows={4}
                      className="w-full"
                    />
                    <div className="flex justify-end">
                      <Button onClick={() => handleSubmitAnswer(selectedQuestion.id)}>
                        <Send className="w-4 h-4 mr-2" />
                        提交回答
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* 讨论功能 */}
        <TabsContent value="discussions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">讨论区</h3>
            <Button onClick={() => setShowDiscussionDialog(true)}>
              <MessageSquare className="w-4 h-4 mr-2" />
              发起讨论
            </Button>
          </div>

          {/* 讨论弹窗 */}
          {showDiscussionDialog && (
            <div 
              className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center"
              onClick={() => {
                setReplyTo(null)
                setShowDiscussionDialog(false)
              }}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{replyTo ? '回复讨论' : '发起讨论'}</h3>
                  <button 
                    onClick={() => {
                      setReplyTo(null)
                      setShowDiscussionDialog(false)
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {replyTo && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-1">回复 {replyTo.user_name}:</p>
                      <p className="text-sm">{replyTo.content}</p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">讨论内容</label>
                    <Textarea
                      value={discussionContent}
                      onChange={(e) => setDiscussionContent(e.target.value)}
                      placeholder="分享你的想法或问题..."
                      rows={5}
                      className="w-full"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => {
                      setReplyTo(null)
                      setShowDiscussionDialog(false)
                    }}>取消</Button>
                    <Button onClick={handleCreateDiscussion}>发布</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {discussions.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">暂无讨论</p>
                </CardContent>
              </Card>
            ) : (
              discussions.map((d) => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
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
                              <button 
                                className="flex items-center gap-1 hover:text-blue-600"
                                onClick={() => handleLikeDiscussion(d.id)}
                              >
                                <ThumbsUp className="w-3 h-3" />
                                {d.likes_count || 0}
                              </button>
                              <span>{d.replies_count || 0} 回复</span>
                              <span>{new Date(d.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* 显示回复 */}
                      {d.replies && d.replies.length > 0 && (
                        <div className="ml-12 space-y-2 border-t pt-2">
                          {d.replies.map((reply) => (
                            <div key={reply.id} className="p-2 bg-gray-50 rounded">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium">{reply.user_name}</span>
                                <span className="text-xs text-gray-500">
                                  {new Date(reply.created_at).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700">{reply.content}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* 回复按钮 */}
                      <div className="ml-12">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setReplyTo(d)
                            setShowDiscussionDialog(true)
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          回复
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
