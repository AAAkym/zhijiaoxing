import React from 'react'
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { TextDecoder, TextEncoder } from 'util'

global.React = React
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder
global.vi = jest

afterEach(() => {
  cleanup()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
})

Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(() => null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
})

Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
})

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
  })
)

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}))

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  useParams: () => ({}),
}))

jest.mock('lucide-react', () => ({
  Search: () => <svg data-testid="search-icon" />,
  User: () => <svg data-testid="user-icon" />,
  Menu: () => <svg data-testid="menu-icon" />,
  X: () => <svg data-testid="x-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
  ChevronLeft: () => <svg data-testid="chevron-left-icon" />,
  ChevronRight: () => <svg data-testid="chevron-right-icon" />,
  Star: () => <svg data-testid="star-icon" />,
  Clock: () => <svg data-testid="clock-icon" />,
  TrendingUp: () => <svg data-testid="trending-up-icon" />,
  BookOpen: () => <svg data-testid="book-open-icon" />,
  FileText: () => <svg data-testid="file-text-icon" />,
  HelpCircle: () => <svg data-testid="help-circle-icon" />,
  Users: () => <svg data-testid="users-icon" />,
  SearchX: () => <svg data-testid="search-x-icon" />,
  Bold: () => <svg data-testid="bold-icon" />,
  Italic: () => <svg data-testid="italic-icon" />,
  Underline: () => <svg data-testid="underline-icon" />,
  Strikethrough: () => <svg data-testid="strikethrough-icon" />,
  Code: () => <svg data-testid="code-icon" />,
  List: () => <svg data-testid="list-icon" />,
  ListOrdered: () => <svg data-testid="list-ordered-icon" />,
  AlignLeft: () => <svg data-testid="align-left-icon" />,
  AlignCenter: () => <svg data-testid="align-center-icon" />,
  AlignRight: () => <svg data-testid="align-right-icon" />,
  Link: () => <svg data-testid="link-icon" />,
  Image: () => <svg data-testid="image-icon" />,
  Undo: () => <svg data-testid="undo-icon" />,
  Redo: () => <svg data-testid="redo-icon" />,
  Maximize2: () => <svg data-testid="maximize-icon" />,
  Minimize2: () => <svg data-testid="minimize-icon" />,
  Highlighter: () => <svg data-testid="highlighter-icon" />,
  Quote: () => <svg data-testid="quote-icon" />,
  CheckSquare: () => <svg data-testid="check-square-icon" />,
  Tag: () => <svg data-testid="tag-icon" />,
  Plus: () => <svg data-testid="plus-icon" />,
  ArrowLeft: () => <svg data-testid="arrow-left-icon" />,
  Save: () => <svg data-testid="save-icon" />,
  Eye: () => <svg data-testid="eye-icon" />,
  Edit3: () => <svg data-testid="edit-icon" />,
  Trash2: () => <svg data-testid="trash-icon" />,
  Calendar: () => <svg data-testid="calendar-icon" />,
  Bot: () => <svg data-testid="bot-icon" />,
  Filter: () => <svg data-testid="filter-icon" />,
  Play: () => <svg data-testid="play-icon" />,
  Video: () => <svg data-testid="video-icon" />,
  Hash: () => <svg data-testid="hash-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  GraduationCap: () => <svg data-testid="graduation-cap-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  Hand: () => <svg data-testid="hand-icon" />,
  MessageCircle: () => <svg data-testid="message-circle-icon" />,
  XCircle: () => <svg data-testid="x-circle-icon" />,
  Send: () => <svg data-testid="send-icon" />,
  ThumbsUp: () => <svg data-testid="thumbs-up-icon" />,
  Pin: () => <svg data-testid="pin-icon" />,
  UserCheck: () => <svg data-testid="user-check-icon" />,
  MessageSquare: () => <svg data-testid="message-square-icon" />,
  BarChart3: () => <svg data-testid="bar-chart-icon" />,
  ListTodo: () => <svg data-testid="list-todo-icon" />,
  PanelLeft: () => <svg data-testid="panel-left-icon" />,
  PanelLeftClose: () => <svg data-testid="panel-left-close-icon" />,
}))

const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
