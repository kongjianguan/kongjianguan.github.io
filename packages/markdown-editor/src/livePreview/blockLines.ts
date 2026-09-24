import {
  RangeSetBuilder,
  StateField,
  type EditorState,
  type Extension,
} from '@codemirror/state'
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { isVerbatimContext } from './model'

/*
 * 行级样式：标题的上下间距与引用的边框、底色。
 *
 * 单独作为一层装饰，因为行装饰的插入位置与行内替换交错。
 * 放在同一个构建器里，先加的行装饰会被后加的、位置更靠前的替换装饰打乱顺序。
 * 这里先把要加装饰的行收集起来，再按行号顺序一次性构建。
 */

/* 标题行加上与阅读态接近的上下间距。阅读态用外边距排版，
   这里改用内边距，因为内边距计入行高测量，外边距不计入。 */
const HEADING_LINE_CLASS: Record<string, string> = {
  ATXHeading1: 'mde-h1',
  ATXHeading2: 'mde-h2',
  ATXHeading3: 'mde-h3',
  ATXHeading4: 'mde-h4',
  ATXHeading5: 'mde-h5',
  ATXHeading6: 'mde-h6',
  SetextHeading1: 'mde-h1',
  SetextHeading2: 'mde-h2',
}

/* 引用嵌套的层数决定缩进，超过三层按三层处理 */
const MAX_QUOTE_DEPTH = 3

function quoteDepth(node: SyntaxNode): number {
  let depth = 0
  let current: SyntaxNode | null = node
  while (current) {
    if (current.name === 'Blockquote') depth++
    current = current.parent
  }
  return Math.min(depth, MAX_QUOTE_DEPTH)
}

function collect(state: EditorState): Map<number, string[]> {
  const byLineStart = new Map<number, string[]>()

  const push = (lineStart: number, className: string): void => {
    const classes = byLineStart.get(lineStart)
    if (classes) classes.push(className)
    else byLineStart.set(lineStart, [className])
  }

  syntaxTree(state).iterate({
    enter(node) {
      if (isVerbatimContext(node.node.parent)) return

      const headingClass = HEADING_LINE_CLASS[node.name]
      if (headingClass) {
        push(state.doc.lineAt(node.from).from, `mde-heading ${headingClass}`)
        return
      }

      if (node.name === 'Blockquote') {
        const depth = quoteDepth(node.node)
        const first = state.doc.lineAt(node.from).number
        const last = state.doc.lineAt(node.to).number
        for (let number = first; number <= last; number++) {
          push(state.doc.line(number).from, `mde-quote mde-quote-d${depth}`)
        }
      }
    },
  })

  return byLineStart
}

function buildLineDecorations(state: EditorState): DecorationSet {
  const byLineStart = collect(state)
  const builder = new RangeSetBuilder<Decoration>()
  for (const lineStart of [...byLineStart.keys()].sort((a, b) => a - b)) {
    const classes = byLineStart.get(lineStart) ?? []
    builder.add(lineStart, lineStart, Decoration.line({ class: classes.join(' ') }))
  }
  return builder.finish()
}

const lineStyleField = StateField.define<DecorationSet>({
  create: state => buildLineDecorations(state),
  update(value, transaction) {
    if (transaction.docChanged) return buildLineDecorations(transaction.state)
    return value
  },
})

export function blockLines(): Extension {
  return [
    lineStyleField,
    EditorView.decorations.from(lineStyleField),
  ]
}
