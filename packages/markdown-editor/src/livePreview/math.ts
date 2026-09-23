import type { BlockContext, InlineContext, Line, MarkdownConfig } from '@lezer/markdown'

/*
 * 站点使用 markdown-it-mathjax3 渲染公式，语法为 $行内$ 与 $$块级$$。
 * Lezer 的 CommonMark 解析器不认识美元符号，会把 $f[u]$ 里的 [u] 当成链接，
 * 实时预览随之隐藏方括号，公式会被改坏。这里补上公式语法，使其成为独立节点。
 *
 * 判定规则与常见 Markdown 实现一致：开头的 $ 之后不能是空白，结尾的 $ 之前不能是空白。
 * 这两条已经足以排除 "价格 $5 到 $10" 这类写法。
 */

const DOLLAR = 0x24
const BACKSLASH = 0x5c
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d

function isSpace(code: number): boolean {
  return code === SPACE || code === TAB || code === LF || code === CR
}

function parseMath(cx: InlineContext, next: number, pos: number): number {
  if (next !== DOLLAR) return -1

  // $$ 开头表示块级公式的定界符，行内公式只处理单个 $。
  if (cx.char(pos + 1) === DOLLAR) return -1

  const contentStart = pos + 1
  const first = cx.char(contentStart)
  if (first < 0 || isSpace(first)) return -1

  let index = contentStart
  while (index < cx.end) {
    const code = cx.char(index)
    if (code === BACKSLASH) {
      index += 2
      continue
    }
    if (code === DOLLAR) {
      if (isSpace(cx.char(index - 1))) return -1
      return cx.addElement(cx.elt('Math', pos, index + 1, [
        cx.elt('DollarMark', pos, contentStart),
        cx.elt('MathContent', contentStart, index),
        cx.elt('DollarMark', index, index + 1),
      ]))
    }
    index++
  }
  return -1
}

/*
 * 块级公式 $$...$$ 作为独立块处理，内部不参与行内解析，
 * 因此公式里的方括号与星号不会被误判为链接或强调。
 */
function parseMathBlock(cx: BlockContext, line: Line): boolean {
  if (line.next !== DOLLAR) return false
  const text = line.text.slice(line.pos)
  if (!text.startsWith('$$')) return false

  const start = cx.lineStart + line.pos

  // 单行形式：$$...$$
  const rest = text.slice(2)
  const trimmed = rest.trimEnd()
  if (trimmed.length >= 2 && trimmed.endsWith('$$')) {
    const end = start + 2 + trimmed.length
    cx.addElement(cx.elt('MathBlock', start, end, [
      cx.elt('DollarMark', start, start + 2),
      cx.elt('MathContent', start + 2, end - 2),
      cx.elt('DollarMark', end - 2, end),
    ]))
    cx.nextLine()
    return true
  }

  // 跨行形式：向下寻找以 $$ 结束的行
  while (cx.nextLine()) {
    const next = cx.peekLine()
    if (next.trimEnd().endsWith('$$')) {
      // 结束行本身也被消费，prevLineEnd 即该行末尾
      const end = cx.prevLineEnd() + next.length
      const contentEnd = cx.prevLineEnd() + next.trimEnd().length - 2
      cx.addElement(cx.elt('MathBlock', start, end, [
        cx.elt('DollarMark', start, start + 2),
        cx.elt('MathContent', start + 2, Math.max(start + 2, contentEnd)),
        cx.elt('DollarMark', end - 2, end),
      ]))
      cx.nextLine()
      return true
    }
  }
  return false
}

export const mathExtension: MarkdownConfig = {
  defineNodes: ['Math', 'MathContent', 'MathBlock', 'DollarMark'],
  parseInline: [{ name: 'Math', parse: parseMath, before: 'Link' }],
  parseBlock: [{ name: 'MathBlock', parse: parseMathBlock, before: 'FencedCode' }],
}
