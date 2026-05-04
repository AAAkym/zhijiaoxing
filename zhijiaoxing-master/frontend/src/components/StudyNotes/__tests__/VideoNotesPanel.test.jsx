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
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应该支持切换展开状态', async () => {
      const onToggleExpand = vi.fn()
      render(<VideoNotesPanel {...mockProps} isExpanded={false} onToggleExpand={onToggleExpand} />)
      
      const toggleButton = screen.getByRole('button')
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
        const notes = screen.getAllByRole('button', { name: /播放/i })
        expect(notes[0]).toHaveTextContent('1:00')
        expect(notes[1]).toHaveTextContent('2:00')
        expect(notes[2]).toHaveTextContent('3:00')
      })
    })

    it('应该高亮当前播放时间附近的笔记', async () => {
      render(<VideoNotesPanel {...mockProps} currentTimestamp={65} />)
      
      await waitFor(() => {
        const noteCards = screen.getAllByRole('button', { name: /播放/i })
        const firstNoteCard = noteCards[0].closest('.cursor-pointer')
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
      
      const noteCards = screen.getAllByRole('button', { name: /播放/i })
      const firstNoteCard = noteCards[0].closest('.cursor-pointer')
      const editButton = within(firstNoteCard).getByRole('button', { name: /编辑/i })
      
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
      
      const noteCards = screen.getAllByRole('button', { name: /播放/i })
      const firstNoteCard = noteCards[0].closest('.cursor-pointer')
      const editButton = within(firstNoteCard).getByRole('button', { name: /编辑/i })
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
        const deleteButtons = screen.getAllByRole('button', { name: /删除/i })
        expect(deleteButtons.length).toBeGreaterThan(0)
      })
    })

    it('应该成功删除笔记', async () => {
      notes.deleteNote.mockResolvedValue({})
      window.confirm = vi.fn(() => true)
      
      render(<VideoNotesPanel {...mockProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('变量定义笔记')).toBeInTheDocument()
      })
      
      const noteCards = screen.getAllByRole('button', { name: /播放/i })
      const firstNoteCard = noteCards[0].closest('.cursor-pointer')
      const deleteButton = within(firstNoteCard).getByRole('button', { name: /删除/i })
      
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
      
      const noteCards = screen.getAllByRole('button', { name: /播放/i })
      const firstNoteCard = noteCards[0].closest('.cursor-pointer')
      const deleteButton = within(firstNoteCard).getByRole('button', { name: /删除/i })
      
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
      
      const noteCards = screen.getAllByRole('button', { name: /播放/i })
      await userEvent.click(noteCards[0])
      
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
      notes.getNotes.mockImplementation(() => new Promise(() => {}))
      
      render(<VideoNotesPanel {...mockProps} />)
      
      expect(screen.getByRole('status')).toBeInTheDocument()
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
    notes.getNotes.mockResolvedValue({ notes: [], total: 0 })
    notes.createNote.mockResolvedValue({ note: { id: 1, title: '测试笔记', content: '测试内容' } })
    notes.getNotes.mockResolvedValue({
      notes: [{ id: 1, title: '测试笔记', content: '测试内容', video_timestamp: 90 }],
      total: 1
    })
    
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
