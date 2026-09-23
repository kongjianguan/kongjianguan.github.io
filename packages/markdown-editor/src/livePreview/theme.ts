import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Extension } from '@codemirror/state'

/*
 * 编辑器主题。字号与间距对齐站点正文的排版尺度，
 * 使编辑态与阅读态的视觉结果接近，避免切换时元素跳动。
 */

export const editorTheme = EditorView.theme({
  '&': {
    width: '100%',
    fontSize: '16px',
    color: 'var(--mde-text-1)',
    backgroundColor: 'var(--mde-bg)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    lineHeight: '1.75',
    fontFamily: 'var(--mde-font-family)',
    padding: '8px 0',
  },
  '.cm-content': {
    padding: '8px 4px',
    caretColor: 'var(--mde-brand)',
  },
  '.cm-line': {
    padding: '0 8px',
  },
  '.cm-gutters': {
    display: 'none',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--mde-brand-soft) !important',
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--mde-brand)',
  },
  '.mde-list-bullet': {
    color: 'var(--mde-text-2)',
  },
  '.mde-image': {
    display: 'block',
    maxWidth: '100%',
    margin: '8px 0',
    borderRadius: '4px',
  },
})

/*
 * 高亮样式让编辑态呈现接近渲染结果的观感：
 * 标题加大加粗、强调加粗倾斜、行内代码使用等宽字体与底色。
 */
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '28px', fontWeight: '600', lineHeight: '1.4' },
  { tag: tags.heading2, fontSize: '24px', fontWeight: '600', lineHeight: '1.4' },
  { tag: tags.heading3, fontSize: '20px', fontWeight: '600', lineHeight: '1.4' },
  { tag: tags.heading4, fontSize: '18px', fontWeight: '600' },
  { tag: tags.heading5, fontSize: '16px', fontWeight: '600' },
  { tag: tags.heading6, fontSize: '16px', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  // 行内代码加底色与圆角，贴近站点渲染结果。
  {
    tag: tags.monospace,
    fontFamily: 'var(--mde-font-mono, monospace)',
    fontSize: '0.9em',
    padding: '0.1em 0.3em',
    borderRadius: '3px',
    backgroundColor: 'var(--mde-bg-mute)',
  },
  { tag: tags.link, color: 'var(--mde-brand)' },
  { tag: tags.url, color: 'var(--mde-text-3)' },
  // 语法标记本身弱化显示，光标进入前不可见，进入后呈灰色。
  { tag: tags.processingInstruction, color: 'var(--mde-text-3)' },
  { tag: tags.contentSeparator, color: 'var(--mde-text-3)' },
  { tag: tags.labelName, color: 'var(--mde-text-3)' },
])

export function editorHighlighting(): Extension {
  return syntaxHighlighting(markdownHighlightStyle)
}
