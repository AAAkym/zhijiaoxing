import { render, screen } from '@testing-library/react'
import MarkdownLite from '../markdownLite'

describe('MarkdownLite 轻量渲染', () => {
  test('渲染粗体与普通文本，不残留 ** 标记', () => {
    render(<MarkdownLite text={'机器学习是**利用数据自动归纳规律**的科学方法'} />)
    expect(screen.getByText('利用数据自动归纳规律').tagName).toBe('STRONG')
    expect(screen.getByText(/的科学方法/)).toBeInTheDocument()
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument()
  })

  test('渲染 ATX 标题（含闭合井号写法）', () => {
    render(<MarkdownLite text={'##核心要点解析##\n正文第一行'} />)
    expect(screen.getByText('核心要点解析')).toBeInTheDocument()
    expect(screen.getByText('正文第一行')).toBeInTheDocument()
  })

  test('渲染无序列表为 <li>，不残留 "- " 前缀', () => {
    render(<MarkdownLite text={'- **目标特征**：具备自主学习\n- 应用边界：覆盖多领域'} />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('目标特征')
    expect(items[0].querySelector('strong')).not.toBeNull()
    expect(screen.queryByText(/^- /)).not.toBeInTheDocument()
  })

  test('渲染有序列表', () => {
    render(<MarkdownLite text={'1. 第一步\n2. 第二步'} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    const list = screen.getByRole('list')
    expect(list.tagName).toBe('OL')
  })

  test('渲染围栏代码块且内容不被行内语法破坏', () => {
    render(<MarkdownLite text={'```python\ndef f(x):\n    return x ** 2\n```'} />)
    const code = screen.getByText(/def f\(x\):/)
    expect(code.closest('pre')).not.toBeNull()
    expect(code.textContent).toBe('def f(x):\n    return x ** 2')
  })

  test('渲染行内代码', () => {
    render(<MarkdownLite text={'使用 `session.get()` 替代旧写法'} />)
    expect(screen.getByText('session.get()').tagName).toBe('CODE')
  })

  test('空内容与普通换行安全降级', () => {
    const { container, rerender } = render(<MarkdownLite text="" />)
    expect(container.querySelector('div.leading-relaxed')).toBeNull()
    rerender(<MarkdownLite text={null} />)
    expect(container.querySelector('div.leading-relaxed')).toBeNull()
    rerender(<MarkdownLite text={'第一行\n第二行'} />)
    expect(screen.getByText('第一行')).toBeInTheDocument()
    expect(screen.getByText('第二行')).toBeInTheDocument()
  })

  test('流式输出中的残缺语法按普通文本渲染且不抛错', () => {
    render(<MarkdownLite text={'回答中**加粗未闭合，还有 ```python\n未闭合代码块'} />)
    // 关键是不抛异常且内容可见
    expect(screen.getByText(/回答中/)).toBeInTheDocument()
  })

  test('引用块渲染', () => {
    render(<MarkdownLite text={'> 引用内容'} />)
    expect(screen.getByText('引用内容')).toBeInTheDocument()
  })

  test('行内 #### 记号（无换行）按小节加粗渲染，不残留 # 号', () => {
    render(<MarkdownLite text={'对问题解答####一、决策树的定义：决策树是###二、核心优点可解释性强'} />)
    expect(screen.getByText('一、决策树的定义：决策树是').tagName).toBe('STRONG')
    expect(screen.getByText('二、核心优点可解释性强').tagName).toBe('STRONG')
    expect(screen.queryByText(/####/)).not.toBeInTheDocument()
  })

  test('行内单井号（如 C#）不受小节规则影响', () => {
    render(<MarkdownLite text={'推荐学习 C# 与 .NET 基础'} />)
    expect(screen.getByText(/C# 与 .NET 基础/)).toBeInTheDocument()
  })
})
