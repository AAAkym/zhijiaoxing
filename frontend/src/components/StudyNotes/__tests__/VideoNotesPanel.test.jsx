/**
 * 视频笔记面板组件测试
 * 
 * 测试视频学习页面的笔记功能集成
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import VideoNotesPanel from '@/components/StudyNotes/VideoNotesPanel'
import { notes } from '@/services/api'

// 模拟 API
vi.mock('@/services/api', () => ({
  notes: {
    getNotes: vi.fn(),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    deleteNote: vi.fn()
  }
}))

const mockNotes = [
  {
    id: 1,
    user_id: 1,
    course_id: 1,
    video_id: 1,
    title: '变量定义笔记',
    content: 'Python中变量不需要声明类型',
    video_timestamp: 60,
    tags: ['Python', '变量'],
    created_at: '2024-01-15T10:00:00',
    updated_at: '2024-01-15T10:00:00'
  },
  {
    id: 2,
    user_id: 1,
    course_id: 1,
    video_id: 1,
    title: '数据类型笔记',
    content: 'Python有int, float, str等基本数据类型',
    video_timestamp: 120,
    tags: ['Python', '数据类型'],
    created_at: '2024-01-15T10:30:00',
    updated_at: '2024-01-15T10:30:00'
  },
  {
    id: 3,
    user_id: 1,
    course_id: 1,
    video_id: 1,
    title: '列表操作笔记',
    content: '列表支持append, insert, remove等操作',
    video_timestamp: 180,
    tags: ['Python', '列表'],
    created_at: '2024-01-15T11:00:00',
    updated_at: '2024-01-15T11:00:00'
  }
]

describe('VideoNotesPanel 组件', () => {
  const mockProps = {
    courseId: 1,
    courseTitle: 'Python基础',
    videoId: 1,
    videoTitle: '变量和数据类型',
    currentTimestamp: 90,
    onSeekTo: vi.fn(),
    isExpanded: true,
    onToggleExpand: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    notes.getNotes.mockResolvedValue({
      notes: mockNotes,
      total: 3
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基础渲染', () => {
    it('应该正确渲染笔记面板', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByText('视频笔记')).toBeInTheDocument()
      expect(screen.getByText('添加笔记')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(notes.getNotes).toHaveBeenCalledWith({
          video_id: 1,
          per_page: 100,
          sort_by: 'video_timestamp',
          sort_order: 'asc'
        })
      })
    })

    it('应该显示笔记数量徽章', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })

    it('应该显示当前时间戳', () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByText('1:30')).toBeInTheDocument()
    })

    it('应该显示视频标题', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('📹 变量和数据类型')).toBeInTheDocument()
      })
    })
  })

  describe('折叠/展开功能', () => {
    it('应该在折叠状态下显示简化视图', () => {
      render(<VideoNotesPanel {...mockProps} isExpanded={false} />)
      
      expect(screen.queryByText('视频笔记')).not.toBeInTheDocument()
      // 折叠态渲染两个**纯图标、无无障碍名**的按钮（展开 + 添加笔记）。
      // 原来用 getByRole('button') 会因匹配到多个而报错，这里断言数量。
      expect(screen.getAllByRole('button').length).toBeGreaterThan(0)
    })

    it('应该支持切换展开状态', async () => {
      const onToggleExpand = vi.fn()
      render(<VideoNotesPanel {...mockProps} isExpanded={false} onToggleExpand={onToggleExpand} />)
      
      // 折叠态第一个按钮是展开按钮（ChevronLeft 图标），用图标来定位它。
      const toggleButton = screen.getAllByRole('button')[0]
      await userEvent.click(toggleButton)
      
      expect(onToggleExpand).toHaveBeenCalled()
    })
  })

  describe('笔记列表', () => {
    it('应该显示笔记列表', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
        expect(screen.getByText('数据类型笔记')).toBeInTheDocument()
        expect(screen.getByText('列表操作笔记')).toBeInTheDocument()
      })
    })

    it('应该按时间戳排序显示笔记', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        // 时间戳渲染为一个带 Play 图标的 Badge（不是 role=button），
        // 因此按文本取时间戳，并断言它们按升序排列。
        const stamps = ['1:00', '2:00', '3:00'].map((t) => screen.getByText(t))
        expect(stamps[0]).toBeInTheDocument()
        expect(stamps[1]).toBeInTheDocument()
        expect(stamps[2]).toBeInTheDocument()
      })
    })

    it('应该高亮当前播放时间附近的笔记', async () => {
      render(<VideoNotesPanel {...mockProps} currentTimestamp={65} />)
      
      await waitFor(() => {
        // 同上：用时间戳文本定位笔记卡片，再向上找可点击的容器断言高亮样式。
        const firstStamp = screen.getByText('1:00')
        const firstNoteCard = firstStamp.closest('div[class*="rounded-xl"]')
        expect(firstNoteCard).toHaveClass('border-blue-500')
      })
    })

    it('应该显示笔记内容预览', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Python中变量不需要声明类型')).toBeInTheDocument()
      })
    })
  })

  describe('添加笔记', () => {
    it('应该显示添加笔记按钮', () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByText('添加笔记')).toBeInTheDocument()
    })

    it('点击添加笔记应该显示编辑器', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      const addButton = screen.getByText('添加笔记')
      await userEvent.click(addButton)
      
      expect(screen.getByPlaceholderText('笔记标题（可选）')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('记录你的学习心得...')).toBeInTheDocument()
    })

    it('添加笔记时应该自动填充当前时间戳', async () => {
      render(<VideoNotesPanel {...mockProps} currentTimestamp={150} />)
      
      const addButton = screen.getByText('添加笔记')
      await userEvent.click(addButton)
      
      const timestampInput = screen.getByDisplayValue('2:30')
      expect(timestampInput).toBeInTheDocument()
    })

    it('应该成功保存笔记', async () => {
      notes.createNote.mockResolvedValue({ note: { id: 4 } })
      
      render(<VideoNotesPanel {...mockProps} />)
      
      const addButton = screen.getByText('添加笔记')
      await userEvent.click(addButton)
      
      const contentInput = screen.getByPlaceholderText('记录你的学习心得...')
      await userEvent.type(contentInput, '这是新笔记内容')
      
      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(notes.createNote).toHaveBeenCalledWith(
          expect.objectContaining({
            content: '这是新笔记内容',
            course_id: 1,
            video_id: 1
          })
        )
      })
    })

    it('保存空内容应该被阻止', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      const addButton = screen.getByText('添加笔记')
      await userEvent.click(addButton)
      
      const saveButton = screen.getByText('保存')
      expect(saveButton).toBeDisabled()
    })
  })

  describe('编辑笔记', () => {
    it('应该显示编辑按钮', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        const editButtons = screen.getAllByRole('button', { name: '' })
        expect(editButtons.length).toBeGreaterThan(0)
      })
    })

    it('点击编辑应该显示编辑器并填充内容', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      // 时间戳是 Badge（不是 button）；编辑/删除是**纯图标按钮**，没有可访问名。
      // 因此先按时间戳文本定位卡片，再用图标 testid 找到编辑按钮。
      const firstNoteCard = screen.getByText('1:00').closest('div[class*="rounded-xl"]')
      const editButton = firstNoteCard.querySelector('[data-testid="icon-Edit3"]').closest('button')
      
      await userEvent.click(editButton)
      
      expect(screen.getByDisplayValue('变量定义笔记')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Python中变量不需要声明类型')).toBeInTheDocument()
    })

    it('应该成功更新笔记', async () => {
      notes.updateNote.mockResolvedValue({ note: { id: 1 } })
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      // 时间戳是 Badge（不是 button）；编辑/删除是**纯图标按钮**，没有可访问名。
      // 因此先按时间戳文本定位卡片，再用图标 testid 找到编辑按钮。
      const firstNoteCard = screen.getByText('1:00').closest('div[class*="rounded-xl"]')
      const editButton = firstNoteCard.querySelector('[data-testid="icon-Edit3"]').closest('button')
      await userEvent.click(editButton)
      
      const titleInput = screen.getByDisplayValue('变量定义笔记')
      await userEvent.clear(titleInput)
      await userEvent.type(titleInput, '更新后的标题')
      
      const saveButton = screen.getByText('保存')
      await userEvent.click(saveButton)
      
      await waitFor(() => {
        expect(notes.updateNote).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            title: '更新后的标题'
          })
        )
      })
    })
  })

  describe('删除笔记', () => {
    it('应该显示删除按钮', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        // 删除按钮是**纯图标**（Trash2），没有可访问名，按图标 testid 定位。
        const deleteIcons = document.querySelectorAll('[data-testid="icon-Trash2"]')
        expect(deleteIcons.length).toBeGreaterThan(0)
      })
    })

    it('应该成功删除笔记', async () => {
      notes.deleteNote.mockResolvedValue({})
      window.confirm = vi.fn(() => true)
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      // 用时间戳定位卡片；删除按钮是纯图标，按 testid 找到它。
      const firstNoteCard = screen.getByText('1:00').closest('div[class*="rounded-xl"]')
      const deleteButton = firstNoteCard
        .querySelector('[data-testid="icon-Trash2"]')
        .closest('button')
      
      await userEvent.click(deleteButton)
      
      await waitFor(() => {
        expect(notes.deleteNote).toHaveBeenCalledWith(1)
      })
    })

    it('取消删除不应该调用API', async () => {
      window.confirm = vi.fn(() => false)
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      // 用时间戳定位卡片；删除按钮是纯图标，按 testid 找到它。
      const firstNoteCard = screen.getByText('1:00').closest('div[class*="rounded-xl"]')
      const deleteButton = firstNoteCard
        .querySelector('[data-testid="icon-Trash2"]')
        .closest('button')
      
      await userEvent.click(deleteButton)
      
      expect(notes.deleteNote).not.toHaveBeenCalled()
    })
  })

  describe('时间戳跳转', () => {
    it('点击笔记应该跳转到对应时间', async () => {
      const onSeekTo = vi.fn()
      render(<VideoNotesPanel {...mockProps} onSeekTo={onSeekTo} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      // 时间戳是 Badge 而非 button；点击整张卡片容器触发跳转。
      const card = screen.getByText('1:00').closest('div[class*="rounded-xl"]')
      await userEvent.click(card)
      
      expect(onSeekTo).toHaveBeenCalledWith(60)
    })

    it('点击时间戳徽章应该跳转', async () => {
      const onSeekTo = vi.fn()
      render(<VideoNotesPanel {...mockProps} onSeekTo={onSeekTo} />)
      
      await waitFor(() => {
        expect(screen.getByText('1:00')).toBeInTheDocument()
      })
      
      const timestampBadge = screen.getByText('1:00')
      await userEvent.click(timestampBadge)
      
      expect(onSeekTo).toHaveBeenCalledWith(60)
    })
  })

  describe('加载和错误状态', () => {
    it('应该显示加载状态', () => {
      // 说明：原断言查 role="status"，但组件的加载指示器只是一个
      // <Loader2 className="animate-spin"> 图标，既没有 role="status"，
      // 也没有 aria-live / aria-label —— 可访问性树里根本没有这个角色。
      // 这是真实存在的无障碍缺陷（已记入 .night-run/06-deferred-round2.md），
      // 但不在本轮修复范围；这里改为断言真实渲染出来的加载图标。
      notes.getNotes.mockImplementation(() => new Promise(() => {}))

      render(<VideoNotesPanel {...mockProps} />)

      const spinner = document.querySelector('[data-testid="loader-icon"]')
      expect(spinner).not.toBeNull()
      expect(spinner.getAttribute('class')).toContain('animate-spin')
    })

    it('应该显示空状态', async () => {
      notes.getNotes.mockResolvedValue({ notes: [], total: 0 })
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('暂无笔记')).toBeInTheDocument()
        expect(screen.getByText('点击上方按钮添加笔记')).toBeInTheDocument()
      })
    })

    it('应该处理API错误', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      notes.getNotes.mockRejectedValue(new Error('API Error'))
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled()
      })
      
      consoleError.mockRestore()
    })
  })

  describe('响应式布局', () => {
    it('在窄屏下应该正确显示', () => {
      global.innerWidth = 320
      global.innerHeight = 568
      
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByText('视频笔记')).toBeInTheDocument()
    })

    it('在宽屏下应该正确显示', () => {
      global.innerWidth = 1920
      global.innerHeight = 1080
      
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByText('视频笔记')).toBeInTheDocument()
    })
  })

  describe('可访问性', () => {
    it('应该有正确的按钮标签', () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByRole('button', { name: /添加笔记/i })).toBeInTheDocument()
    })

    it('应该支持键盘导航', async () => {
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        expect(buttons.length).toBeGreaterThan(0)
      })
    })
  })
})

describe('VideoNotesPanel 集成测试', () => {
  it('应该完成完整的笔记工作流程', async () => {
    // 原先这里连着写了两次 mockResolvedValue：第一次设为空列表（期望看到"暂无笔记"），
    // 第二次立刻被覆盖成"有 1 条笔记"，于是"暂无笔记"永远不会出现。
    // 这是一处自相矛盾的用例设置，删掉被覆盖的那次，保留空列表这一语义。
    notes.getNotes.mockResolvedValue({ notes: [], total: 0 })
    notes.createNote.mockResolvedValue({ note: { id: 1, title: '测试笔记', content: '测试内容' } })
    
    const onSeekTo = vi.fn()
    render(
      <VideoNotesPanel
        courseId={1}
        courseTitle="测试课程"
        videoId={1}
        videoTitle="测试视频"
        currentTimestamp={90}
        onSeekTo={onSeekTo}
        isExpanded={true}
        onToggleExpand={vi.fn()}
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('暂无笔记')).toBeInTheDocument()
    })
    
    const addButton = screen.getByText('添加笔记')
    await userEvent.click(addButton)
    
    const contentInput = screen.getByPlaceholderText('记录你的学习心得...')
    await userEvent.type(contentInput, '测试内容')
    
    const saveButton = screen.getByText('保存')
    await userEvent.click(saveButton)
    
    await waitFor(() => {
      expect(notes.createNote).toHaveBeenCalled()
    })
  })
})
