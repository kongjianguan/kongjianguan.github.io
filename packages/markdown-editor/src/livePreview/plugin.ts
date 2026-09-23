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
import { blockPreview } from './blocks'

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

/* 任务列表的复选框，点击切换 `[ ]` 与 `[x]`。 */
class TaskWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super()
  }

  override eq(other: TaskWidget): boolean {
    return other.checked === this.checked
  }

  override toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.className = 'mde-task'
    input.checked = this.checked
    input.addEventListener('click', event => {
      event.preventDefault()
      // 位置在点击时重新求取，避免部件被复用后坐标过期。
      const pos = view.posAtDOM(input)
      view.dispatch({
        changes: { from: pos, to: pos + 3, insert: this.checked ? '[ ]' : '[x]' },
      })
    })
    return input
  }

  /* 返回 true 让编辑器不接管点击，勾选动作由部件自己处理 */
  override ignoreEvent(): boolean {
    return true
  }
}

/* 水平分割线用一个占满整行的细线替代源码。 */
class RuleWidget extends WidgetType {
  override eq(): boolean {
    return true
  }

  override toDOM(): HTMLElement {
    const rule = document.createElement('span')
    rule.className = 'mde-rule'
    return rule
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
  'SubscriptMark',
  'SuperscriptMark',
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
  'Subscript',
  'Superscript',
  'InlineCode',
  'Math',
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

/*
 * 找到包裹当前节点的可展开结构，用于判断整段语法是否展开。
 * 返回 null 表示这个节点不属于任何可展开结构，此时不做隐藏：
 * 正文里的裸地址（`正文 https://a.b 结束`）以及引用式链接的定义行都属此类，
 * 按节点自身区间隐藏会把可见文字整段抹掉。
 */
function findRevealScope(node: SyntaxNode): MarkerRange | null {
  let current: SyntaxNode | null = node
  while (current) {
    if (REVEAL_SCOPE_NODES.has(current.name)) {
      return { from: current.from, to: current.to }
    }
    current = current.parent
  }
  return null
}

/* 判断节点是否处于某个结构之内 */
function hasAncestor(node: SyntaxNode, name: string): boolean {
  let current: SyntaxNode | null = node.parent
  while (current) {
    if (current.name === name) return true
    current = current.parent
  }
  return false
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
        // Setext 标题的下划线由块级模块整行处理，这里只接手行首标记
        const parent = node.node.parent
        if (parent?.name === 'SetextHeading1' || parent?.name === 'SetextHeading2') return
        // 行首标记随光标所在行显示。连同标记后的一个空格一起隐藏，
        // 收起后标题与引用文字紧贴行首，与渲染结果一致。
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        const next = state.doc.sliceString(to, to + 1)
        builder.add(from, next === ' ' ? to + 1 : to, hiddenMark)
        return
      }

      if (name === 'ListMark') {
        /*
         * 判定范围是标记自身，标题与引用才用整行判定。
         * 光标落在条目正文里时标记被替换为项目符号，落在标记上或紧邻其后时才显示源码。
         * 只替换标记字符，保留其后的空格，收起后与渲染结果一样是「符号 + 空格 + 正文」。
         */
        const item = node.node.parent
        const isTask = item?.name === 'ListItem' && item.getChild('Task') !== null
        if (intersectsSelection(from, to, ranges, 0)) return
        if (isTask) {
          // 任务项由复选框接管，标记连同其后的空格一起让位
          const next = state.doc.sliceString(to, to + 1)
          builder.add(from, next === ' ' ? to + 1 : to, hiddenMark)
          return
        }
        const raw = state.doc.sliceString(from, to)
        builder.add(from, to, Decoration.replace({
          widget: new BulletWidget(/^\d+[.)]$/.test(raw) ? raw : null),
        }))
        return
      }

      if (name === 'TaskMarker') {
        // 与列表标记同粒度：光标落在复选框上时显示原始 `[ ]`
        if (intersectsSelection(from, to, ranges, 0)) return
        const raw = state.doc.sliceString(from, to)
        builder.add(from, to, Decoration.replace({ widget: new TaskWidget(raw.slice(1, 2) !== ' ') }))
        return
      }

      if (name === 'HorizontalRule') {
        // 与标题一致，按光标所在行判定
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        builder.add(from, to, Decoration.replace({ widget: new RuleWidget() }))
        return
      }

      if (name === 'Escape') {
        // 隐藏反斜杠，保留被转义的字符本身
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        builder.add(from, from + 1, hiddenMark)
        return
      }

      if (name === 'HardBreak') {
        // 只隐藏行尾的反斜杠，换行本身保留为一次换行
        const line = lineRangeAt(state, from)
        if (intersectsSelection(line.from, line.to, ranges, 0)) return
        builder.add(from, from + 1, hiddenMark)
        return
      }

      if (HIDDEN_MARK_NODES.has(name) || name === 'URL' || name === 'LinkTitle' || name === 'LinkLabel') {
        // 块级公式整块由块级模块处理，定界符不再单独隐藏
        if (name === 'DollarMark' && hasAncestor(node.node, 'MathBlock')) return
        // 由所属结构的范围决定：光标进入该结构时显示标记，离开则收起。
        const scope = findRevealScope(node.node)
        if (scope && !intersectsSelection(scope.from, scope.to, ranges, 0)) {
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
    blockPreview(),
    EditorView.atomicRanges.of(view => view.plugin(livePreviewPlugin)?.decorations ?? Decoration.none),
  ]
}