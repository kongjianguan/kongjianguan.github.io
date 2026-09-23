import type { SyntaxNode } from '@lezer/common'

/*
 * 实时预览的判断逻辑。这里只做分类与区间判断，不接触 CodeMirror 的
 * Decoration，因此可以脱离编辑器单独测试。
 */

/*
 * 光标落在标记区间外扩这个距离以内时标记保持可见。
 * 扩大范围能让光标紧贴标记时稳定展开，避免边界处反复切换。
 */
export const REVEAL_MARGIN = 1

export interface MarkerRange {
  from: number
  to: number
}

/*
 * 代码块、HTML 块与注释块内部保持源码原样。这些区域里的
 * 井号、星号都是内容本身，隐藏它们会破坏文章。
 */
const VERBATIM_NODES = new Set([
  'FencedCode',
  'CodeBlock',
  'CodeText',
  'HTMLBlock',
  'CommentBlock',
])

export function isVerbatimContext(node: SyntaxNode | null): boolean {
  let current = node
  while (current) {
    if (VERBATIM_NODES.has(current.name)) return true
    current = current.parent
  }
  return false
}

/*
 * 判断区间是否与任一光标位置或选区相交。
 * 使用区间判断，多光标与跨行选区都能正确触发展开。
 */
export function intersectsSelection(
  from: number,
  to: number,
  ranges: readonly MarkerRange[],
  margin = REVEAL_MARGIN,
): boolean {
  for (const range of ranges) {
    const start = Math.min(range.from, range.to)
    const end = Math.max(range.from, range.to)
    if (from - margin <= end && to + margin >= start) return true
  }
  return false
}
