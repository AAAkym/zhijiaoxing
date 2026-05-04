import React, { useEffect, useRef, useCallback } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, indentOnInput } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'

const LANG_EXTENSIONS = {
  python: () => python(),
  javascript: () => javascript(),
  java: () => java(),
  cpp: () => cpp(),
  c: () => cpp(),
}

export default function CodeEditor({
  value = '',
  onChange,
  language = 'python',
  height = '320px',
  readOnly = false,
  placeholder = '在这里输入代码...',
}) {
  const editorRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)

  onChangeRef.current = onChange
  valueRef.current = value

  const langExt = LANG_EXTENSIONS[language]?.() || python()

  const createEditor = useCallback(() => {
    if (!editorRef.current) return

    if (viewRef.current) {
      viewRef.current.destroy()
    }

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        const newVal = update.state.doc.toString()
        valueRef.current = newVal
        onChangeRef.current(newVal)
      }
    })

    const state = EditorState.create({
      doc: valueRef.current || '',
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightSelectionMatches(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        oneDark,
        langExt,
        updateListener,
        EditorView.lineWrapping,
        EditorView.theme({
          '&': { height },
          '.cm-scroller': { overflow: 'auto' },
        }),
        EditorState.readOnly.of(readOnly),
        EditorState.tabSize.of(4),
        placeholder ? EditorView.placeholder.of(placeholder) : [],
      ],
    })

    viewRef.current = new EditorView({
      state,
      parent: editorRef.current,
    })
  }, [language, height, readOnly, placeholder])

  useEffect(() => {
    createEditor()
    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [createEditor])

  useEffect(() => {
    if (viewRef.current && value !== undefined) {
      const currentVal = viewRef.current.state.doc.toString()
      if (value !== currentVal) {
        viewRef.current.dispatch({
          changes: { from: 0, to: currentVal.length, insert: value },
        })
      }
    }
  }, [value])

  return (
    <div
      ref={editorRef}
      className="rounded-lg overflow-hidden border border-slate-700"
      style={{ height }}
    />
  )
}
