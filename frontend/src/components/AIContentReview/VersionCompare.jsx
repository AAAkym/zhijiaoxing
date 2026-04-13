import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  GitCompare, 
  ArrowRight, 
  History, 
  RotateCcw,
  CheckCircle,
  Clock,
  User,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react'

const mockContentHistory = [
  {
    id: 1,
    title: 'Python函数基础教程',
    versions: [
      {
        version: 3,
        content: `# Python函数基础教程

## 什么是函数？

函数是一段可重复使用的代码块，用于执行特定任务。在Python中，函数是组织代码的基本方式之一。

## 函数的定义

使用 \`def\` 关键字定义函数：

\`\`\`python
def greet(name):
    """向用户问好"""
    return f"Hello, {name}!"
\`\`\`

## 函数参数

Python支持多种参数类型：
- 位置参数
- 关键字参数
- 默认参数
- 可变参数

## 返回值

函数可以返回一个或多个值，使用 \`return\` 语句。`,
        author: '张老师',
        createdAt: '2025-03-27 10:30',
        changes: '优化了参数说明部分，增加了代码示例',
        status: 'current'
      },
      {
        version: 2,
        content: `# Python函数基础教程

## 什么是函数？

函数是一段可重复使用的代码块，用于执行特定任务。

## 函数的定义

使用 \`def\` 关键字定义函数：

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\`

## 函数参数

Python支持多种参数类型：
- 位置参数
- 关键字参数
- 默认参数`,
        author: '张老师',
        createdAt: '2025-03-26 15:20',
        changes: '增加了函数参数类型说明',
        status: 'archived'
      },
      {
        version: 1,
        content: `# Python函数基础教程

## 什么是函数？

函数是一段可重复使用的代码块。

## 函数的定义

使用 \`def\` 关键字定义函数：

\`\`\`python
def greet(name):
    return f"Hello, {name}!"
\`\`\``,
        author: 'AI助手',
        createdAt: '2025-03-25 09:00',
        changes: '初始版本',
        status: 'archived'
      }
    ]
  },
  {
    id: 2,
    title: '数据结构练习题解答',
    versions: [
      {
        version: 2,
        content: `# 数据结构练习题解答

## 题目1：数组反转

**解答：**
\`\`\`python
def reverse_array(arr):
    return arr[::-1]
\`\`\`

时间复杂度：O(n)
空间复杂度：O(1)`,
        author: 'AI助手',
        createdAt: '2025-03-27 09:15',
        changes: '增加了复杂度分析',
        status: 'current'
      },
      {
        version: 1,
        content: `# 数据结构练习题解答

## 题目1：数组反转

**解答：**
\`\`\`python
def reverse_array(arr):
    return arr[::-1]
\`\`\``,
        author: 'AI助手',
        createdAt: '2025-03-26 14:30',
        changes: '初始版本',
        status: 'archived'
      }
    ]
  }
]

const DiffLine = ({ type, content, lineNumber }) => {
  const bgColor = type === 'added' ? 'bg-green-50' : type === 'removed' ? 'bg-red-50' : 'bg-white'
  const borderColor = type === 'added' ? 'border-l-4 border-green-500' : type === 'removed' ? 'border-l-4 border-red-500' : ''
  const prefix = type === 'added' ? '+' : type === 'removed' ? '-' : ' '

  return (
    <div className={`flex font-mono text-sm ${bgColor} ${borderColor}`}>
      <span className="w-12 text-right pr-3 text-gray-400 select-none">{lineNumber}</span>
      <span className={`w-6 text-center select-none ${type === 'added' ? 'text-green-600' : type === 'removed' ? 'text-red-600' : 'text-gray-300'}`}>
        {prefix}
      </span>
      <span className={`flex-1 pl-2 whitespace-pre-wrap ${type === 'added' ? 'text-green-800' : type === 'removed' ? 'text-red-800' : 'text-gray-700'}`}>
        {content || ' '}
      </span>
    </div>
  )
}

export default function VersionCompare() {
  const [selectedContent, setSelectedContent] = useState(mockContentHistory[0])
  const [leftVersion, setLeftVersion] = useState(1)
  const [rightVersion, setRightVersion] = useState(3)
  const [showDiff, setShowDiff] = useState(true)
  const [rollbackDialog, setRollbackDialog] = useState({ open: false, version: null })
  const [previewDialog, setPreviewDialog] = useState({ open: false, version: null })

  const currentVersion = selectedContent.versions.find(v => v.status === 'current')
  const leftContent = selectedContent.versions.find(v => v.version === leftVersion)
  const rightContent = selectedContent.versions.find(v => v.version === rightVersion)

  const computeDiff = (left, right) => {
    const leftLines = left.split('\n')
    const rightLines = right.split('\n')
    const diff = []
    let leftIdx = 0
    let rightIdx = 0

    while (leftIdx < leftLines.length || rightIdx < rightLines.length) {
      if (leftIdx >= leftLines.length) {
        diff.push({ type: 'added', content: rightLines[rightIdx], lineNumber: rightIdx + 1 })
        rightIdx++
      } else if (rightIdx >= rightLines.length) {
        diff.push({ type: 'removed', content: leftLines[leftIdx], lineNumber: leftIdx + 1 })
        leftIdx++
      } else if (leftLines[leftIdx] === rightLines[rightIdx]) {
        diff.push({ type: 'unchanged', content: leftLines[leftIdx], lineNumber: leftIdx + 1 })
        leftIdx++
        rightIdx++
      } else {
        const leftInRight = rightLines.slice(rightIdx).indexOf(leftLines[leftIdx])
        const rightInLeft = leftLines.slice(leftIdx).indexOf(rightLines[rightIdx])

        if (leftInRight === -1 && rightInLeft === -1) {
          diff.push({ type: 'removed', content: leftLines[leftIdx], lineNumber: leftIdx + 1 })
          diff.push({ type: 'added', content: rightLines[rightIdx], lineNumber: rightIdx + 1 })
          leftIdx++
          rightIdx++
        } else if (leftInRight !== -1 && (rightInLeft === -1 || leftInRight <= rightInLeft)) {
          for (let i = 0; i < leftInRight; i++) {
            diff.push({ type: 'added', content: rightLines[rightIdx + i], lineNumber: rightIdx + i + 1 })
          }
          rightIdx += leftInRight
        } else {
          for (let i = 0; i < rightInLeft; i++) {
            diff.push({ type: 'removed', content: leftLines[leftIdx + i], lineNumber: leftIdx + i + 1 })
          }
          leftIdx += rightInLeft
        }
      }
    }

    return diff
  }

  const diffResult = showDiff && leftContent && rightContent 
    ? computeDiff(leftContent.content, rightContent.content)
    : []

  const handleRollback = (version) => {
    setRollbackDialog({ open: true, version })
  }

  const confirmRollback = () => {
    console.log('回滚到版本:', rollbackDialog.version)
    setRollbackDialog({ open: false, version: null })
  }

  const handlePreview = (version) => {
    setPreviewDialog({ open: true, version })
  }

  return (
    <div className="space-y-6">
      {/* 内容选择器 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600" />
              <span className="font-medium">选择内容:</span>
            </div>
            <Select 
              value={selectedContent.id.toString()} 
              onValueChange={(value) => {
                const content = mockContentHistory.find(c => c.id === parseInt(value))
                setSelectedContent(content)
                setLeftVersion(1)
                setRightVersion(content.versions[0].version)
              }}
            >
              <SelectTrigger className="w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mockContentHistory.map(content => (
                  <SelectItem key={content.id} value={content.id.toString()}>
                    {content.title} ({content.versions.length} 个版本)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant={showDiff ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowDiff(!showDiff)}
                className={showDiff ? 'bg-slate-900' : ''}
              >
                <GitCompare className="h-4 w-4 mr-1" />
                {showDiff ? '显示差异' : '并排对比'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 版本时间线 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Clock className="h-5 w-5 mr-2 text-slate-600" />
            版本历史
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 overflow-x-auto pb-2">
            {selectedContent.versions.map((version, index) => (
              <div key={version.version} className="flex items-center">
                <div 
                  className={`flex-shrink-0 w-48 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    version.version === leftVersion ? 'border-blue-500 bg-blue-50' :
                    version.version === rightVersion ? 'border-purple-500 bg-purple-50' :
                    'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => {
                    if (version.version !== leftVersion && version.version !== rightVersion) {
                      setRightVersion(version.version)
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant={version.status === 'current' ? 'default' : 'outline'} 
                      className={version.status === 'current' ? 'bg-green-600' : ''}>
                      v{version.version}
                    </Badge>
                    {version.status === 'current' && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{version.author}</p>
                  <p className="text-xs text-gray-400">{version.createdAt}</p>
                </div>
                {index < selectedContent.versions.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-300 mx-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 版本对比区域 */}
      {showDiff ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <GitCompare className="h-5 w-5 mr-2 text-slate-600" />
                差异对比
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">对比版本:</span>
                  <Select value={leftVersion.toString()} onValueChange={(v) => setLeftVersion(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedContent.versions.map(v => (
                        <SelectItem key={v.version} value={v.version.toString()}>
                          v{v.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <Select value={rightVersion.toString()} onValueChange={(v) => setRightVersion(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedContent.versions.map(v => (
                        <SelectItem key={v.version} value={v.version.toString()}>
                          v{v.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <ScrollArea className="h-96">
                <div className="bg-gray-50">
                  {diffResult.map((line, index) => (
                    <DiffLine key={index} type={line.type} content={line.content} lineNumber={line.lineNumber} />
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex items-center gap-4 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-100 border-l-4 border-green-500"></div>
                <span className="text-gray-600">新增内容</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-100 border-l-4 border-red-500"></div>
                <span className="text-gray-600">删除内容</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-white border"></div>
                <span className="text-gray-600">未变更内容</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* 左侧版本 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center">
                  <Badge variant="outline" className="mr-2">v{leftVersion}</Badge>
                  {leftContent?.author}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(leftContent)}>
                    <Eye className="h-4 w-4 mr-1" />
                    预览
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRollback(leftContent)}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    回滚
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">{leftContent?.createdAt}</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <pre className="text-sm whitespace-pre-wrap font-mono">{leftContent?.content}</pre>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* 右侧版本 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center">
                  <Badge variant="outline" className="mr-2">v{rightVersion}</Badge>
                  {rightContent?.author}
                  {rightContent?.status === 'current' && (
                    <Badge className="ml-2 bg-green-600">当前版本</Badge>
                  )}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handlePreview(rightContent)}>
                    <Eye className="h-4 w-4 mr-1" />
                    预览
                  </Button>
                  {rightContent?.status !== 'current' && (
                    <Button variant="outline" size="sm" onClick={() => handleRollback(rightContent)}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      回滚
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-500">{rightContent?.createdAt}</p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <pre className="text-sm whitespace-pre-wrap font-mono">{rightContent?.content}</pre>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 版本变更记录 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <Sparkles className="h-5 w-5 mr-2 text-slate-600" />
            变更记录
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {selectedContent.versions.map(version => (
              <div key={version.version} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0">
                  <Badge variant={version.status === 'current' ? 'default' : 'outline'}
                    className={version.status === 'current' ? 'bg-green-600' : ''}>
                    v{version.version}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{version.author}</span>
                    <span className="text-sm text-gray-500">{version.createdAt}</span>
                  </div>
                  <p className="text-sm text-gray-600">{version.changes}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => handlePreview(version)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  {version.status !== 'current' && (
                    <Button variant="ghost" size="sm" onClick={() => handleRollback(version)}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 回滚确认弹窗 */}
      <Dialog open={rollbackDialog.open} onOpenChange={(open) => setRollbackDialog({ open, version: rollbackDialog.version })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认版本回滚</DialogTitle>
            <DialogDescription>
              您确定要将内容回滚到版本 v{rollbackDialog.version?.version} 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              回滚后，当前版本将被归档，所选版本将成为新的当前版本。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackDialog({ open: false, version: null })}>
              取消
            </Button>
            <Button onClick={confirmRollback} className="bg-slate-900 hover:bg-slate-800">
              确认回滚
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 预览弹窗 */}
      <Dialog open={previewDialog.open} onOpenChange={(open) => setPreviewDialog({ open, version: previewDialog.version })}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Badge variant="outline" className="mr-2">v{previewDialog.version?.version}</Badge>
              内容预览
            </DialogTitle>
            <DialogDescription>
              {previewDialog.version?.author} · {previewDialog.version?.createdAt}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            <pre className="text-sm whitespace-pre-wrap font-mono p-4 bg-gray-50 rounded-lg">
              {previewDialog.version?.content}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog({ open: false, version: null })}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
