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
import { intersectsSelection, isVerbatimContext, type MarkerRange } from './model'

/*
 * 块级实时预览。表格与 Setext 标题的下划线需要跨行替换，
 * CodeMirror 只允许由 StateField 提供这类装饰，ViewPlugin 会被拒绝。
 */

interface TableCells {
  headers: SyntaxNode[]
  rows: SyntaxNode[][]
}

/* 标记之间的文字不是独立节点，按区间取出来补上 */
function appendGap(target: Node, doc: Text, from: number, to: number): void {
  if (to > from) target.appendChild(document.createTextNode(doc.sliceString(from, to)))
}

/* 链接与图片只保留方括号内的可读文字，地址与括号不进入渲染结果 */
function renderLabel(node: SyntaxNode, doc: Text): string | null {
  const marks: SyntaxNode[] = []
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === 'LinkMark') marks.push(child)
  }
  if (marks.length < 2) return null
  return doc.sliceString(marks[0].to, marks[1].from)
}

/*
 * 按语法树取单元格文字，文本切分交给解析器完成。
 * 单元格内的强调、代码等行内结构递归渲染，避免把 `**粗**` 原样暴露出来。
 */
function renderInline(node: SyntaxNode, doc: Text): DocumentFragment {
  const fragment = document.createDocumentFragment()

  const wrap = (name: string, child: SyntaxNode, target: Node): boolean => {
    const tag = name === 'StrongEmphasis' ? 'strong'
      : name === 'Emphasis' ? 'em'
      : name === 'InlineCode' ? 'code'
      : name === 'Strikethrough' ? 'del'
      : null
    if (!tag) return false
    const element = document.createElement(tag)
    walk(child, element)
    target.appendChild(element)
    return true
  }

  const walk = (current: SyntaxNode, target: Node): void => {
    const first = current.firstChild
    if (first === null) {
      appendGap(target, doc, current.from, current.to)
      return
    }
    if (current.name === 'Link' || current.name === 'Image') {
      const label = renderLabel(current, doc)
      if (label !== null) {
        target.appendChild(document.createTextNode(label))
        return
      }
    }
    let pos = current.from
    for (let item: SyntaxNode | null = first; item; item = item.nextSibling) {
      appendGap(target, doc, pos, item.from)
      if (!item.name.endsWith('Mark') && !wrap(item.name, item, target)) {
        walk(item, target)
      }
      pos = item.to
    }
    appendGap(target, doc, pos, current.to)
  }

  walk(node, fragment)
  return fragment
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
