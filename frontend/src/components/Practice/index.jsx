import React, { useCallback, useState } from 'react'
import { PracticeProvider, usePractice } from './PracticeContext'
import PracticeSelector from './PracticeSelector'
import QuestionPanel from './QuestionPanel'
import ResultPage from './ResultPage'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, BookOpen, AlertCircle, CheckCircle } from 'lucide-react'
import { student } from '@/services/api'

function PracticeContent({ myCourses, onBack }) {
  const { currentView, selectPractice, result, reset, selectedPractice } = usePractice()
  const [submitStatus, setSubmitStatus] = useState(null)
  const [submitResponse, setSubmitResponse] = useState(null)

  const handleSelectPractice = useCallback((practice, questions) => {
    selectPractice(practice, questions)
    setSubmitStatus(null)
    setSubmitResponse(null)
  }, [selectPractice])

  const handleSubmit = useCallback(async (resultData) => {
    console.log('Practice submitted:', resultData)
    
    if (!selectedPractice || !selectedPractice.id) {
      setSubmitStatus({
        type: 'error',
        message: '无法提交：未找到练习信息'
      })
      return
    }

    try {
      setSubmitStatus({ type: 'loading', message: '正在提交答案...' })
      
      const answersArray = resultData.results.map(r => r.userAnswer)
      
      const submissionData = {
        submissions: [{
          assessment_id: selectedPractice.id,
          answers: JSON.stringify(answersArray),
          score: resultData.totalScore,
          evaluation_result: JSON.stringify({
            totalScore: resultData.totalScore,
            maxScore: resultData.maxScore,
            timeElapsed: resultData.timeElapsed,
            answeredCount: resultData.answeredCount,
            totalQuestions: resultData.totalQuestions,
            results: resultData.results.map(r => ({
              questionId: r.questionId,
              question: r.question,
              userAnswer: r.userAnswer,
              correctAnswer: r.correctAnswer,
              isCorrect: r.isCorrect,
              score: r.score,
              explanation: r.explanation,
              options: r.options
            }))
          })
        }]
      }

      console.log('Submitting data:', submissionData)
      
      const response = await student.syncPracticeData(submissionData)
      
      console.log('Submit response:', response)
      
      if (response && (response.synced_count > 0 || response.message)) {
        const mistakeCount = response.extracted_mistakes ?? response.extracted_mistake_count ?? 0
        setSubmitResponse(response)
        
        let successMessage = `答案提交成功！得分：${resultData.totalScore}/${resultData.maxScore}`
        if (mistakeCount > 0) {
          successMessage += ` | 已同步 ${mistakeCount} 道错题至错题本`
        } else if (resultData.totalScore >= resultData.maxScore) {
          successMessage += ` | 全部正确，无错题`
        }
        
        setSubmitStatus({
          type: 'success',
          message: successMessage
        })
      } else {
        throw new Error('提交失败，服务器未返回确认')
      }
    } catch (error) {
      console.error('Submit error:', error)
      
      const errorMessage = error.message || '网络错误，请检查连接后重试'
      
      setSubmitStatus({
        type: 'error',
        message: `提交失败：${errorMessage}`
      })
      
      try {
        const pendingSubmissions = JSON.parse(localStorage.getItem('pendingPracticeSubmissions') || '[]')
        const answersArray = resultData.results.map(r => r.userAnswer)
        
        const cachedSubmission = {
          assessmentId: selectedPractice.id,
          answers: answersArray,
          score: resultData.totalScore,
          timestamp: Date.now(),
          evaluationResult: JSON.stringify({
            totalScore: resultData.totalScore,
            maxScore: resultData.maxScore,
            timeElapsed: resultData.timeElapsed,
            results: resultData.results
          })
        }
        
        const existingIndex = pendingSubmissions.findIndex(s => s.assessmentId === selectedPractice.id)
        if (existingIndex >= 0) {
          if (resultData.totalScore > (pendingSubmissions[existingIndex].score || 0)) {
            pendingSubmissions[existingIndex] = cachedSubmission
          }
        } else {
          pendingSubmissions.push(cachedSubmission)
        }
        
        localStorage.setItem('pendingPracticeSubmissions', JSON.stringify(pendingSubmissions))
        console.log('答案已缓存到本地，将在网络恢复后同步')
      } catch (cacheError) {
        console.error('本地缓存失败:', cacheError)
      }
    }
  }, [selectedPractice])

  const handleRestart = useCallback(() => {
    reset()
    setSubmitStatus(null)
    setSubmitResponse(null)
  }, [reset])

  const handleBackToList = useCallback(() => {
    reset()
    setSubmitStatus(null)
    setSubmitResponse(null)
  }, [reset])

  return (
    <div className="max-w-5xl mx-auto">
      {submitStatus && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
          submitStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : submitStatus.type === 'error'
              ? 'bg-red-50 border border-red-200'
              : 'bg-blue-50 border border-blue-200'
        }`}>
          {submitStatus.type === 'success' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {submitStatus.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600" />}
          {submitStatus.type === 'loading' && <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />}
          <span className={`${
            submitStatus.type === 'success' 
              ? 'text-green-800' 
              : submitStatus.type === 'error'
                ? 'text-red-800'
                : 'text-blue-800'
          }`}>
            {submitStatus.message}
          </span>
        </div>
      )}
      
      {currentView === 'selector' && (
        <>
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={onBack}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回概览
            </Button>
          </div>
          <PracticeSelector 
            myCourses={myCourses} 
            onSelectPractice={handleSelectPractice}
          />
        </>
      )}

      {currentView === 'practice' && (
        <QuestionPanel onSubmit={handleSubmit} />
      )}

      {currentView === 'result' && result && (
        <ResultPage 
          onRestart={handleRestart}
          onBackToList={handleBackToList}
          submitResponse={submitResponse}
        />
      )}
    </div>
  )
}

export default function PracticeModule({ myCourses, onBack }) {
  return (
    <PracticeProvider>
      <PracticeContent myCourses={myCourses} onBack={onBack} />
    </PracticeProvider>
  )
}

export { PracticeProvider, usePractice }
