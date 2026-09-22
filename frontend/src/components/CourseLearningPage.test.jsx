// CourseLearningPage 的真实测试。
//
// 背景：本文件此前是**一个死文件** —— 内容是 CourseLearningPage.jsx 的一份手工拷贝
// （函数名 TestCourseLearningPage、满屏 console.log('[Test] ...')），
// 且**一个 test() 都没有**。Jest 因此报 "Your test suite must contain at least one test"，
// 维护者没有修复它，而是把它加进 jest.config.js 的 testPathIgnorePatterns 静默排除。
//
// 2026-09-22 巡检的处理：不删除、不继续隐藏，而是**为真实组件补上真正的测试**，
// 让这个文件名重新代表它本该代表的东西。
//
// 两个关键约定（都踩过坑，写在这里避免下次重犯）：
//
// 1. API 的 mock：jest.config.js 把 '@/services/api' 和 '../services/api' 都指向
//    共享 mock 模块 src/test/api-mock.js。因此本文件**不写** jest.mock 工厂
//    （moduleNameMapper 在 mock 解析之前生效，工厂会被忽略），而是 import 到
//    共享 mock 再配置行为。这与 PersonalizedLearningTasks.test.jsx 一致。
//
// 2. 路由参数：jest.setup.js 全局把 useParams 固定为返回 {}，组件会一直停在
//    「正在加载课程...」，永远走不到真实的加载分支。本文件必须覆盖它。
//    注意要保留 requireActual 的其余导出，并沿用 setup 里对 useNavigate /
//    useLocation 的处理方式，避免影响组件其它逻辑。

import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, jest, test } from '@jest/globals'
import CourseLearningPage from '@/components/CourseLearningPage'
// 用 '@/' 别名导入共享 mock。jest.config.js 里用的是**绝对路径**型 mapper
// （'.*/src/services/api$'），组件写的 '../services/api' 与这里的 '@/services/api'
// 会解析到同一个文件，从而共享同一个模块实例，断言 mock 调用次数才有意义。
import { courses, notes } from '@/services/api'

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/courses/1', search: '', hash: '', state: null }),
  useParams: () => ({ courseId: '1' }),
}))

// 该页面挂载了多个重组件（播放器、笔记面板、AI 侧栏、思维导图、代码练习场、PPT 查看器）。
// 本测试只关心「页面自身的数据加载与状态渲染」，因此把这些子组件换成轻量替身，
// 避免测试因无关依赖而脆弱。这是仓库既有测试的通用做法。
jest.mock('@/components/VideoPlayer', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/StudentInteractionPanel', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/StudyNotes/VideoNotesPanel', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/AITutor', () => ({ AITutorPanel: () => <div /> }))
jest.mock('@/components/ui/InteractiveMindMap', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/ui/CodePlayground', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/PPTViewer', () => ({ __esModule: true, default: () => <div /> }))

const COURSE = { id: 1, title: '数据结构与算法', teacher_name: '张老师' }

/** 渲染真实的 CourseLearningPage（courseId 由上面的 useParams mock 提供）。 */
function renderPage(user = { id: 1, role: 'student' }) {
  return render(<CourseLearningPage user={user} />)
}

// 注意：jest.config.js 开了 resetMocks，它会在每个用例前清掉 mock 的实现。
// 因此这里在每个用例体内重新设置返回值，而不只依赖 beforeEach。
beforeEach(() => {
  courses.getAll.mockResolvedValue({ courses: [COURSE] })
  courses.getContent.mockResolvedValue({ contents: [] })
  notes.getNotes.mockResolvedValue({ notes: [] })
})

test('renders the real component and loads the course matching the route param', async () => {
  courses.getAll.mockResolvedValue({ courses: [COURSE] })

  renderPage()
  await new Promise((r) => setTimeout(r, 300))
  console.log('DBG body =', document.body.textContent.slice(0, 160))
  console.log('DBG calls =', courses.getAll.mock.calls.length)
  console.log('DBG impl =', String(courses.getAll.getMockImplementation && courses.getAll.getMockImplementation()))
  console.log('DBG resolved =', JSON.stringify(await courses.getAll()))

  await waitFor(() => {
    expect(courses.getAll).toHaveBeenCalled()
  })

  // 课程数据加载完成后，页面应展示课程名。这条断言证明组件**真的渲染出来了**，
  // 而不是只证明"没抛异常"——后者正是本仓库最该避免的假绿。
  expect(await screen.findByText(/数据结构与算法/)).toBeInTheDocument()
})

test('reports an honestly-labelled error when the course list request fails', async () => {
  courses.getAll.mockRejectedValue(new Error('网络不可用'))

  renderPage()

  // 组件在 catch 里 setError(err.message || '加载失败')。
  // 这里断言错误界面确实出现（标题为「加载失败」），而不是静默停在加载态。
  expect(await screen.findByText('加载失败')).toBeInTheDocument()
})
