import { RangeSetBuilder, type EditorState, type Extension } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { intersectsSelection, isVerbatimContext, type MarkerRange } from './model'

/*
 * 实时预览：光标不落在某段标记内时把它隐藏，使正文看起来接近渲染结果；
 * 光标进入该区间后恢复原始字符，便于直接编辑。
 */

/* 收起状态下，无序列表的符号显示为圆点，更接近渲染结果。 */
class BulletWidget extends WidgetType {
  constructor(private readonly ordered: string | null) {
    super()
  }

  override eq(other: BulletWidget): boolean {
    return other.ordered === this.ordered
  }

  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'mde-list-bullet'
    span.textContent = this.ordered ?? '•'
    return span
  }

  override ignoreEvent(): boolean {
    return false
  }
}

/* 图片在收起状态下显示真实图像，光标进入图片语法后恢复源码。 */
class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
  ) {
    super()
  }

  override eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt
  }

  override toDOM(): HTMLElement {
    const img = document.createElement('img')
    img.className = 'mde-image'
    img.src = this.src
    img.alt = this.alt
    img.loading = 'lazy'
    return img
  }

  override ignoreEvent(): boolean {
    return false
  }
}

/*
 * 这些节点属于纯语法标记，光标不落在其所属结构内时隐藏。
 * DollarMark 是公式的美元定界符，与强调标记同样处理。
 */
const HIDDEN_MARK_NODES = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'DollarMark',
  'CodeMark',
  'LinkMark',
])

/*
 * 决定「光标进入才展开」的结构范围。标记的可见性由所在结构决定：
 * 光标位于结构内部时展开，位于结构之外时收起。
 * 例如 **重点** 的两个星号，只有光标进入这一段时才显示。
 */
const REVEAL_SCOPE_NODES = new Set([
  'StrongEmphasis',
  'Emphasis',
  'Strikethrough',
  'InlineCode',
  'Math',
  'MathBlock',
  'Link',
  'Image',
  'Autolink',
])

const hiddenMark = Decoration.replace({})

export function parseImageSyntax(raw: string): { src: string; alt: string } | null {
  const match = raw.match(
    /^!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)$/,
  )
  if (!match) return null
  return { alt: match[1] || '图片', src: match[2] || match[3] || '' }
}

/* 找到包裹当前节点的可展开结构，用于判断整段语法是否展开。 */
function findRevealScope(node: SyntaxNode): MarkerRange {
  let current: SyntaxNode | null = node
  while (current) {
    if (REVEAL_SCOPE_NODES.has(current.name)) {
      return { from: current.from, to: current.to }
    }
    current = current.parent
  }
  return { from: node.from, to: node.to }
}

function lineRangeAt(state: EditorState, pos: number): MarkerRange {
  const line = state.doc.lineAt(pos)
  return { from: line.from, to: line.to }
}

/*
 * 构建替换装饰。RangeSetBuilder 要求位置递增，语法树的先序遍历天然满足。
 */
export function buildDecorations(state: EditorState): DecorationSet {
  const ranges: MarkerRange[] = state.selection.ranges.map(range => ({
    from: range.from,
    to: range.to,
  }))
  const builder = new RangeSetBuilder<Decoration>()
  const docLength = state.doc.length

  syntaxTree(state).iterate({
    enter(node) {
      const from = node.from
      const to = node.to
      if (from >= to || to > docLength) return
      // 代码块与 HTML 块内部保持源码原样。
      if (isVerbatimContext(node.node.parent)) return

      const name = node.name

      if (name === 'Image') {
        if (intersectsSelection(from, to, ranges, 0)) return
        const parsed = parseImageSyntax(state.doc.sliceString(from, to))
        if (!parsed) return
        builder.add(from, to, Decoration.replace({ widget: new ImageWidget(parsed.src, parsed.alt) }))
        return
      }

      if (name === 'HeaderMark' || name === 'QuoteMark') {
        // 行首标记随光标所在行显示。连同标记后的一个空格一起隐藏，
        // 收起后标题与引用文字紧贴行首，与渲染结果一致。
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        const next = state.doc.sliceString(to, to + 1)
        builder.add(from, next === ' ' ? to + 1 : to, hiddenMark)
        return
      }

      if (name === 'ListMark') {
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        const raw = state.doc.sliceString(from, to)
        // 列表符号与其后的空格一并替换为圆点，避免多余空白。
        const next = state.doc.sliceString(to, to + 1)
        builder.add(from, next === ' ' ? to + 1 : to, Decoration.replace({
          widget: new BulletWidget(/^\d+[.)]$/.test(raw) ? raw : null),
        }))
        return
      }

      if (HIDDEN_MARK_NODES.has(name) || name === 'URL' || name === 'LinkTitle' || name === 'LinkLabel') {
        // 由所属结构的范围决定：光标进入该结构时显示标记，离开则收起。
        const scope = findRevealScope(node.node)
        if (!intersectsSelection(scope.from, scope.to, ranges, 0)) {
          builder.add(from, to, hiddenMark)
        }
      }
    },
  })

  return builder.finish()
}

/*
 * 隐藏的标记声明为原子区间，方向键会整段跳过，而不会停在不可见的字符上。
 */
const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state)
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.state)
      }
    }
  },
  { decorations: plugin => plugin.decorations },
)

export function livePreview(): Extension {
  return [
    livePreviewPlugin,
    EditorView.atomicRanges.of(view => view.plugin(livePreviewPlugin)?.decorations ?? Decoration.none),
  ]
}
