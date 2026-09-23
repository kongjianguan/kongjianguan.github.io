import type { BlockContext, InlineContext, Line, MarkdownConfig } from '@lezer/markdown'

/*
 * 站点使用 markdown-it-mathjax3 渲染公式，语法为 $行内$ 与 $$块级$$。
 * Lezer 的 CommonMark 解析器不认识美元符号，会把 $f[u]$ 里的 [u] 当成链接，
 * 实时预览随之隐藏方括号，公式会被改坏。这里补上公式语法，使其成为独立节点。
 *
 * 定界符规则与 markdown-it-mathjax3 的 isValidDelim 保持一致：
 * 开头的 $ 之后不能是空白，结尾的 $ 之前不能是空白，且结尾的 $ 之后不能紧跟数字。
 * 后一条用于排除 "价格 $5 到 $10" 这类金额写法。判定不成立时继续向后寻找定界符，
 * 与站点逐字符扫描的行为相同。
 */

const DOLLAR = 0x24
const BACKSLASH = 0x5c
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d
const DIGIT_ZERO = 0x30
const DIGIT_NINE = 0x39

function isSpace(code: number): boolean {
  return code === SPACE || code === TAB || code === LF || code === CR
}

function isDigit(code: number): boolean {
  return code >= DIGIT_ZERO && code <= DIGIT_NINE
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
      // 结束定界符前面不能是空白，后面不能紧跟数字，否则继续向后找
      const acceptable = !isSpace(cx.char(index - 1)) && !isDigit(cx.char(index + 1))
      if (acceptable) {
        return cx.addElement(cx.elt('Math', pos, index + 1, [
          cx.elt('DollarMark', pos, contentStart),
          cx.elt('MathContent', contentStart, index),
          cx.elt('DollarMark', index, index + 1),
        ]))
      }
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
  const rest = text.slice(2).trimEnd()
  if (rest.length >= 2 && rest.endsWith('$$')) {
    const end = start + 2 + rest.length
    cx.addElement(cx.elt('MathBlock', start, end, [
      cx.elt('DollarMark', start, start + 2),
      cx.elt('MathContent', start + 2, end - 2),
      cx.elt('DollarMark', end - 2, end),
    ]))
    cx.nextLine()
    return true
  }

  /*
   * 跨行形式：逐行向下寻找以 $$ 结束的行。消费顺序与内置的 FencedCode 一致：
   * 先 nextLine 推进到下一行，在结束行上取缩进后的行尾作为结束位置，再 nextLine
   * 把结束行本身消费掉。cx.lineStart 在 nextLine 之后已经指向当前行行首。
   */
  for (;;) {
    if (!cx.nextLine()) break
    const closing = line.text.trimEnd()
    if (closing.length >= 2 && closing.endsWith('$$')) {
      const end = cx.lineStart + closing.length
      cx.addElement(cx.elt('MathBlock', start, end, [
        cx.elt('DollarMark', start, start + 2),
        cx.elt('MathContent', start + 2, end - 2),
        cx.elt('DollarMark', end - 2, end),
      ]))
      cx.nextLine()
      return true
    }
  }

  // 未闭合时按围栏代码的处理方式，把余下内容整体作为公式块，避免正文失去语法树。
  const end = cx.prevLineEnd()
  cx.addElement(cx.elt('MathBlock', start, end, [
    cx.elt('DollarMark', start, start + 2),
    cx.elt('MathContent', start + 2, Math.max(start + 2, end)),
  ]))
  return true
}

export const mathExtension: MarkdownConfig = {
  defineNodes: ['Math', 'MathContent', 'MathBlock', 'DollarMark'],
  parseInline: [{ name: 'Math', parse: parseMath, before: 'Link' }],
  parseBlock: [{ name: 'MathBlock', parse: parseMathBlock, before: 'FencedCode' }],
}
