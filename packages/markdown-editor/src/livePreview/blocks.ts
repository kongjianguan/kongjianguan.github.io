import {
  RangeSetBuilder,
  StateField,
  type EditorState,
  type Extension,
  type Text,
} from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import MarkdownIt from 'markdown-it'
import { intersectsSelection, isVerbatimContext, type MarkerRange } from './model'
import { mathWidget } from './mathWidget'

/*
 * 块级实时预览。表格与 Setext 标题的下划线需要跨行替换，
 * CodeMirror 只允许由 StateField 提供这类装饰，ViewPlugin 会被拒绝。
 */

interface TableCells {
  headers: SyntaxNode[]
  rows: SyntaxNode[][]
}

const tableMarkdown = new MarkdownIt({ html: false })

/*
 * 单元格范围由语法树提供，行内语法与链接校验交给 MarkdownIt。
 * 禁用原始 HTML，保证插入 DOM 的内容全部来自渲染器。
 */
function renderInline(node: SyntaxNode, doc: Text): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = tableMarkdown.renderInline(doc.sliceString(node.from, node.to))
  return template.content
}

function collectCells(node: SyntaxNode): TableCells {
  const headers: SyntaxNode[] = []
  const rows: SyntaxNode[][] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== 'TableHeader' && child.name !== 'TableRow') continue
    const cells: SyntaxNode[] = []
    for (let cell = child.firstChild; cell; cell = cell.nextSibling) {
      if (cell.name === 'TableCell') cells.push(cell)
    }
    if (child.name === 'TableHeader') headers.push(...cells)
    else rows.push(cells)
  }
  return { headers, rows }
}

/* 分隔行里的冒号决定每一列的对齐方式 */
function readAligns(node: SyntaxNode, doc: Text): Array<'left' | 'center' | 'right' | null> {
  const delimiter = node.getChild('TableDelimiter')
  if (!delimiter) return []
  return doc.sliceString(delimiter.from, delimiter.to)
    .split('|')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => {
      const left = part.startsWith(':')
      const right = part.endsWith(':')
      if (left && right) return 'center'
      if (right) return 'right'
      if (left) return 'left'
      return null
    })
}

/* 表格在光标离开整张表时渲染为真实表格。 */
class TableWidget extends WidgetType {
  constructor(
    private readonly cells: TableCells,
    private readonly aligns: Array<'left' | 'center' | 'right' | null>,
    private readonly doc: Text,
    private readonly source: string,
  ) {
    super()
  }

  override eq(other: TableWidget): boolean {
    return other.source === this.source
  }

  override toDOM(): HTMLElement {
    const table = document.createElement('table')
    table.className = 'mde-table'

    const head = document.createElement('thead')
    const headRow = document.createElement('tr')
    this.cells.headers.forEach((cell, index) => {
      const th = document.createElement('th')
      const align = this.aligns[index]
      if (align) th.style.textAlign = align
      th.appendChild(renderInline(cell, this.doc))
      headRow.appendChild(th)
    })
    head.appendChild(headRow)
    table.appendChild(head)

    const body = document.createElement('tbody')
    for (const row of this.cells.rows) {
      const tr = document.createElement('tr')
      for (let index = 0; index < this.cells.headers.length; index++) {
        const td = document.createElement('td')
        const align = this.aligns[index]
        if (align) td.style.textAlign = align
        const cell = row[index]
        if (cell) td.appendChild(renderInline(cell, this.doc))
        tr.appendChild(td)
      }
      body.appendChild(tr)
    }
    table.appendChild(body)

    return table
  }

  override ignoreEvent(): boolean {
    return false
  }
}

function buildBlockDecorations(state: EditorState): DecorationSet {
  const ranges: MarkerRange[] = state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }))
  const builder = new RangeSetBuilder<Decoration>()
  const doc = state.doc

  syntaxTree(state).iterate({
    enter(node) {
      const from = node.from
      const to = node.to
      if (from >= to || to > doc.length) return
      if (isVerbatimContext(node.node.parent)) return

      if (node.name === 'Table') {
        if (intersectsSelection(from, to, ranges, 0)) return
        const widget = new TableWidget(
          collectCells(node.node),
          readAligns(node.node, doc),
          doc,
          doc.sliceString(from, to),
        )
        builder.add(from, to, Decoration.replace({ widget, block: true }))
        return
      }

      if (node.name === 'MathBlock') {
        if (intersectsSelection(from, to, ranges, 0)) return
        const source = doc.sliceString(from, to)
        // 去掉首尾定界符与紧邻的换行，剩下的就是公式内容
        const tex = source.replace(/^\$\$/, '').replace(/\$\$$/, '').trim()
        builder.add(from, to, Decoration.replace({
          widget: mathWidget(tex, source, true),
          block: true,
        }))
        return
      }

      if (node.name === 'SetextHeading1' || node.name === 'SetextHeading2') {
        const underline = node.node.getChild('HeaderMark')
        if (!underline) return
        // 光标落在标题块内时保留下划线，便于编辑
        if (intersectsSelection(from, to, ranges, 0)) return
        const line = doc.lineAt(underline.from)
        builder.add(line.from, line.to, Decoration.replace({ block: true }))
      }
    },
  })

  return builder.finish()
}

const blockPreviewField = StateField.define<DecorationSet>({
  create: state => buildBlockDecorations(state),
  update(value, transaction) {
    if (transaction.docChanged || transaction.selection) {
      return buildBlockDecorations(transaction.state)
    }
    return value
  },
})

export function blockPreview(): Extension {
  return [
    blockPreviewField,
    EditorView.decorations.from(blockPreviewField),
    EditorView.atomicRanges.of(view => view.state.field(blockPreviewField, false) ?? Decoration.none),
  ]
}
