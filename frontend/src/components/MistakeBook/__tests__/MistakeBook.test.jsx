/**
 * 错题本组件集成测试
 * 
 * 测试错题本前端组件的功能和交互
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import MistakeBook from '@/components/MistakeBook'
import MistakeList from '@/components/MistakeBook/MistakeList'
import MistakeDetail from '@/components/MistakeBook/MistakeDetail'
import MistakeStats from '@/components/MistakeBook/MistakeStats'

// 模拟 API
vi.mock('@/services/api', () => ({
  mistakeBook: {
    getMistakes: vi.fn(),
    getMistake: vi.fn(),
    updateStatus: vi.fn(),
    extractMistakes: vi.fn(),
    getStats: vi.fn()
  }
}))

import { mistakeBook } from '@/services/api'

const mockMistakes = [
  {
    id: 1,
    user_id: 1,
    course_id: 1,
    course_title: 'Python基础',
    assessment_id: 1,
    assessment_title: '第一章测试',
    question_index: 0,
    question_content: 'Python中如何定义变量？',
    user_answer: 'var x = 1',
    correct_answer: 'x = 1',
    mistake_count: 2,
    last_mistake_at: '2024-01-15T10:30:00',
    mastery_status: 'unmastered',
    knowledge_tags: ['变量', 'Python基础'],
    created_at: '2024-01-10T08:00:00',
    updated_at: '2024-01-15T10:30:00'
  },
  {
    id: 2,
    user_id: 1,
    course_id: 1,
    course_title: 'Python基础',
    question_content: '列表和元组的区别是什么？',
    user_answer: '没有区别',
    correct_answer: '列表可变，元组不可变',
    mistake_count: 1,
    last_mistake_at: '2024-01-14T14:20:00',
    mastery_status: 'reviewing',
    knowledge_tags: ['列表', '元组'],
    created_at: '2024-01-12T09:00:00',
    updated_at: '2024-01-14T14:20:00'
  },
  {
    id: 3,
    user_id: 1,
    course_id: 2,
    course_title: 'JavaScript进阶',
    question_content: '什么是闭包？',
    user_answer: '不知道',
    correct_answer: '函数和其词法环境的组合',
    mistake_count: 3,
    last_mistake_at: '2024-01-16T11:00:00',
    mastery_status: 'mastered',
    knowledge_tags: ['闭包', 'JavaScript'],
    created_at: '2024-01-08T10:00:00',
    updated_at: '2024-01-16T11:00:00'
  }
]

const mockStats = {
  stats: {
    total_mistakes: 3,
    by_status: {
      unmastered: 1,
      reviewing: 1,
      mastered: 1
    },
    by_course: [
      { course_id: 1, course_title: 'Python基础', count: 2 },
      { course_id: 2, course_title: 'JavaScript进阶', count: 1 }
    ],
    by_knowledge_point: {
      '变量': 1,
      'Python基础': 1,
      '列表': 1,
      '元组': 1,
      '闭包': 1,
      'JavaScript': 1
    }
  },
  recent_mistakes: mockMistakes.slice(0, 2)
}

const mockCourses = [
  { id: 1, title: 'Python基础' },
  { id: 2, title: 'JavaScript进阶' }
]

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  )
}

describe('MistakeBook 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mistakeBook.getMistakes.mockResolvedValue({
      mistakes: mockMistakes,
      total: 3,
      page: 1,
      per_page: 20,
      total_pages: 1
    })
    mistakeBook.getStats.mockResolvedValue(mockStats)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('应该正确渲染错题本主组件', async () => {
    renderWithRouter(<MistakeBook myCourses={mockCourses} />)
    
    expect(screen.getByText('错题本')).toBeInTheDocument()
    expect(screen.getByText('管理你的错题，针对性复习')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(mistakeBook.getMistakes).toHaveBeenCalled()
      expect(mistakeBook.getStats).toHaveBeenCalled()
    })
  })

  it('应该显示统计卡片', async () => {
    renderWithRouter(<MistakeBook myCourses={mockCourses} />)
    
    await waitFor(() => {
      expect(screen.getByText('总错题')).toBeInTheDocument()
      expect(screen.getByText('未掌握')).toBeInTheDocument()
      expect(screen.getByText('复习中')).toBeInTheDocument()
      expect(screen.getByText('已掌握')).toBeInTheDocument()
    })
  })

  it('应该支持课程筛选', async () => {
    renderWithRouter(<MistakeBook myCourses={mockCourses} />)
    
    await waitFor(() => {
      expect(screen.getByText('课程筛选:')).toBeInTheDocument()
    })
    
    const courseSelect = screen.getByRole('combobox', { name: /课程筛选/i })
    expect(courseSelect).toBeInTheDocument()
  })

  it('应该支持状态筛选', async () => {
    renderWithRouter(<MistakeBook myCourses={mockCourses} />)
    
    await waitFor(() => {
      expect(screen.getByText('状态筛选:')).toBeInTheDocument()
    })
  })

  it('应该支持视图切换（列表/统计）', async () => {
    renderWithRouter(<MistakeBook myCourses={mockCourses} />)
    
    await waitFor(() => {
      expect(screen.getByText('错题列表')).toBeInTheDocument()
      expect(screen.getByText('统计分析')).toBeInTheDocument()
    })
  })
})

describe('MistakeList 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确渲染错题列表', () => {
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
    expect(screen.getByText('列表和元组的区别是什么？')).toBeInTheDocument()
    expect(screen.getByText('什么是闭包？')).toBeInTheDocument()
  })

  it('应该显示正确的状态标签', () => {
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('未掌握')).toBeInTheDocument()
    expect(screen.getByText('复习中')).toBeInTheDocument()
    expect(screen.getByText('已掌握')).toBeInTheDocument()
  })

  it('应该显示错误次数', () => {
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('错误 2 次')).toBeInTheDocument()
    expect(screen.getByText('错误 3 次')).toBeInTheDocument()
  })

  it('应该显示知识点标签', () => {
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('变量')).toBeInTheDocument()
    expect(screen.getByText('Python基础')).toBeInTheDocument()
    expect(screen.getByText('闭包')).toBeInTheDocument()
  })

  it('应该支持快速状态更新', async () => {
    const onUpdateStatus = vi.fn()
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={onUpdateStatus}
      />
    )
    
    const startReviewButtons = screen.getAllByText('开始复习')
    await userEvent.click(startReviewButtons[0])
    
    expect(onUpdateStatus).toHaveBeenCalledWith(1, 'reviewing')
  })

  it('应该显示加载状态', () => {
    render(
      <MistakeList
        mistakes={[]}
        loading={true}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 0, total_pages: 0 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('应该显示空状态', () => {
    render(
      <MistakeList
        mistakes={[]}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 0, total_pages: 0 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('暂无错题记录')).toBeInTheDocument()
  })

  it('应该支持分页', () => {
    const onFilterChange = vi.fn()
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 30, total_pages: 3 }}
        onSelectMistake={vi.fn()}
        onFilterChange={onFilterChange}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument()
  })
})

describe('MistakeDetail 组件', () => {
  const mockMistake = mockMistakes[0]
  const mockOnBack = vi.fn()
  const mockOnUpdateStatus = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确渲染错题详情', () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
    expect(screen.getByText('var x = 1')).toBeInTheDocument()
    expect(screen.getByText('x = 1')).toBeInTheDocument()
  })

  it('应该显示用户答案和正确答案的对比', () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    expect(screen.getByText('你的答案')).toBeInTheDocument()
    expect(screen.getByText('正确答案')).toBeInTheDocument()
  })

  it('应该显示知识点标签', () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    expect(screen.getByText('变量')).toBeInTheDocument()
    expect(screen.getByText('Python基础')).toBeInTheDocument()
  })

  it('应该支持状态更新', async () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    const updateButton = screen.getByText('开始复习')
    await userEvent.click(updateButton)
    
    expect(mockOnUpdateStatus).toHaveBeenCalledWith(1, 'reviewing')
  })

  it('应该支持返回列表', async () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    const backButton = screen.getByText('返回列表')
    await userEvent.click(backButton)
    
    expect(mockOnBack).toHaveBeenCalled()
  })

  it('应该显示错误次数和日期信息', () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    expect(screen.getByText('错误次数')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('应该处理空笔记的情况', () => {
    render(
      <MistakeDetail
        mistake={mockMistake}
        onBack={mockOnBack}
        onUpdateStatus={mockOnUpdateStatus}
      />
    )
    
    expect(screen.getByText('暂无笔记，点击上方按钮添加')).toBeInTheDocument()
  })
})

describe('MistakeStats 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该正确渲染统计数据', () => {
    render(<MistakeStats stats={mockStats} />)
    
    expect(screen.getByText('掌握状态分布')).toBeInTheDocument()
    expect(screen.getByText('课程错题分布')).toBeInTheDocument()
    expect(screen.getByText('知识点错题统计')).toBeInTheDocument()
  })

  it('应该显示总体掌握率', () => {
    render(<MistakeStats stats={mockStats} />)
    
    expect(screen.getByText('总体掌握率')).toBeInTheDocument()
  })

  it('应该显示最近错题列表', () => {
    render(<MistakeStats stats={mockStats} />)
    
    expect(screen.getByText('最近错题')).toBeInTheDocument()
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
  })

  it('应该显示状态统计卡片', () => {
    render(<MistakeStats stats={mockStats} />)
    
    expect(screen.getByText('未掌握')).toBeInTheDocument()
    expect(screen.getByText('复习中')).toBeInTheDocument()
    expect(screen.getByText('已掌握')).toBeInTheDocument()
  })

  it('应该处理空统计数据', () => {
    render(<MistakeStats stats={null} />)
    
    expect(screen.getByText('暂无统计数据')).toBeInTheDocument()
  })
})

describe('响应式布局测试', () => {
  it('应该在移动端正确显示', () => {
    // 模拟移动端视口
    global.innerWidth = 375
    global.innerHeight = 667
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
  })

  it('应该在平板端正确显示', () => {
    // 模拟平板端视口
    global.innerWidth = 768
    global.innerHeight = 1024
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
  })

  it('应该在桌面端正确显示', () => {
    // 模拟桌面端视口
    global.innerWidth = 1920
    global.innerHeight = 1080
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByText('Python中如何定义变量？')).toBeInTheDocument()
  })
})

describe('可访问性测试', () => {
  it('应该有正确的按钮标签', () => {
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={vi.fn()}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    expect(screen.getByRole('button', { name: /刷新/i })).toBeInTheDocument()
  })

  it('应该支持键盘导航', async () => {
    const onSelectMistake = vi.fn()
    
    render(
      <MistakeList
        mistakes={mockMistakes}
        loading={false}
        myCourses={mockCourses}
        filters={{ page: 1, per_page: 10 }}
        pagination={{ total: 3, total_pages: 1 }}
        onSelectMistake={onSelectMistake}
        onFilterChange={vi.fn()}
        onUpdateStatus={vi.fn()}
      />
    )
    
    const cards = screen.getAllByRole('button', { name: /查看/i })
    expect(cards.length).toBeGreaterThan(0)
  })
})
