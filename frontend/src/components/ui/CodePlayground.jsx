import React, { useState, useRef } from 'react'
import { Play, RotateCcw, Loader2, Terminal, AlertTriangle } from 'lucide-react'
import CodeEditor from './CodeEditor'
import { codeExecution } from '../../services/api'
import { Button } from './button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const LANGUAGE_OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
]

const EXECUTION_TIMEOUT = 30000

export default function CodePlayground({
  initialCode = '',
  language: languageProp = 'python',
  height = '400px',
  onRun,
}) {
  const [language, setLanguage] = useState(languageProp)
  const [code, setCode] = useState(initialCode)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('output')
  const abortRef = useRef(null)

  const handleRun = async () => {
    if (isRunning) return

    setIsRunning(true)
    setOutput('')
    setError('')

    const controller = new AbortController()
    abortRef.current = controller

    const timeoutId = setTimeout(() => {
      controller.abort()
    }, EXECUTION_TIMEOUT)

    try {
      let result
      if (onRun) {
        result = await onRun(code, language)
      } else {
        result = await codeExecution.runCode(code, language)
      }

      if (result.output) {
        setOutput(result.output)
        setActiveTab('output')
      }
      if (result.error) {
        setError(result.error)
        setActiveTab('error')
      }
      if (!result.output && !result.error) {
        setOutput(result.stdout || result.result || '程序执行完毕（无输出）')
        setActiveTab('output')
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('执行超时：程序运行时间过长，请检查是否存在无限循环')
      } else if (err.isNetworkError) {
        setError('网络连接失败，请检查网络后重试')
      } else {
        setError(err.message || '代码执行失败，请检查代码是否有误')
      }
      setActiveTab('error')
    } finally {
      clearTimeout(timeoutId)
      setIsRunning(false)
      abortRef.current = null
    }
  }

  const handleReset = () => {
    setCode(initialCode)
    setOutput('')
    setError('')
    setActiveTab('output')
  }

  const handleLanguageChange = (val) => {
    setLanguage(val)
    setOutput('')
    setError('')
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-[#282c34] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-700 bg-[#21252b]">
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[130px] h-8 bg-slate-800 border-slate-600 text-slate-200 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {LANGUAGE_OPTIONS.map((lang) => (
                <SelectItem
                  key={lang.value}
                  value={lang.value}
                  className="text-slate-200 text-xs focus:bg-slate-700 focus:text-slate-100"
                >
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            onClick={handleRun}
            disabled={isRunning}
            size="sm"
            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs font-medium shadow-none"
          >
            {isRunning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            {isRunning ? '运行中' : '运行'}
          </Button>

          <Button
            onClick={handleReset}
            disabled={isRunning}
            size="sm"
            variant="ghost"
            className="h-8 text-slate-400 hover:text-slate-200 hover:bg-slate-700 gap-1.5 text-xs"
          >
            <RotateCcw className="size-3.5" />
            重置代码
          </Button>
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
            <span>正在执行...</span>
          </div>
        )}
      </div>

      <div className="flex" style={{ height }}>
        <div className="flex-1 min-w-0 border-r border-slate-700">
          <CodeEditor
            value={code}
            onChange={setCode}
            language={language}
            height={height}
            placeholder="在这里输入代码..."
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col bg-[#21252b]">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col h-full"
          >
            <TabsList className="w-full justify-start rounded-none bg-[#21252b] border-b border-slate-700 h-9 p-0">
              <TabsTrigger
                value="output"
                className="data-[state=active]:bg-slate-800 data-[state=active]:text-slate-200 text-slate-500 h-9 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 text-xs gap-1.5"
              >
                <Terminal className="size-3.5" />
                输出
              </TabsTrigger>
              <TabsTrigger
                value="error"
                className="data-[state=active]:bg-slate-800 data-[state=active]:text-red-400 text-slate-500 h-9 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-red-500 text-xs gap-1.5"
              >
                <AlertTriangle className="size-3.5" />
                错误
              </TabsTrigger>
            </TabsList>

            <TabsContent value="output" className="flex-1 m-0 overflow-auto">
              <pre className="p-4 text-sm font-mono text-slate-200 whitespace-pre-wrap leading-relaxed min-h-full">
                {output || (
                  <span className="text-slate-500 italic">点击运行按钮执行代码</span>
                )}
              </pre>
            </TabsContent>

            <TabsContent value="error" className="flex-1 m-0 overflow-auto">
              <pre className="p-4 text-sm font-mono text-red-300 bg-red-950/30 whitespace-pre-wrap leading-relaxed min-h-full border-l-2 border-red-500/50">
                {error || (
                  <span className="text-slate-500 italic">暂无错误信息</span>
                )}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
