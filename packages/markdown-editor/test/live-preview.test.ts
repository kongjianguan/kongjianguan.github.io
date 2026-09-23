import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { mathExtension } from '../src/livePreview/math'
import { buildDecorations, livePreview } from '../src/livePreview/plugin'

/*
 * 在真实编辑器状态上检查「光标进入才显示标记」的行为。
 * 判断依据是装饰集合：某区间被替换，说明它处于收起状态。
 */

function stateOf(doc: string, cursor: number): EditorState {
  return EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [
      markdown({ base: markdownLanguage, extensions: [mathExtension], addKeymap: false }),
    ],
  })
}

/* 被替换（隐藏或替换为部件）的区间清单。 */
function hidden(state: EditorState): Array<[number, number]> {
  const set = buildDecorations(state)
  const ranges: Array<[number, number]> = []
  set.between(0, state.doc.length, (from, to) => {
    ranges.push([from, to])
  })
  return ranges
}

function isHidden(state: EditorState, from: number, to: number): boolean {
  return hidden(state).some(([start, end]) => start === from && end === to)
}

/*
 * 把编辑器渲染到真实 DOM，用于验证语法高亮与部件确实生效。
 */
function render(doc: string, cursor = 0): { view: EditorView; cleanup: () => void } {
  const parent = document.createElement('div')
  document.body.append(parent)
  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: cursor },
      extensions: [
        markdown({ base: markdownLanguage, extensions: [mathExtension], addKeymap: false }),
        livePreview(),
      ],
    }),
    parent,
  })
  return { view, cleanup: () => view.destroy() }
}

describe('标题标记的显示与隐藏', () => {
  it('光标不在标题行时隐藏井号与随后的空格', () => {
    const doc = '## 标题\n正文'
    // 隐藏区间含标记与其后的一个空格，收起后标题文字紧贴行首
    expect(isHidden(stateOf(doc, doc.length), 0, 3)).toBe(true)
  })

  it('光标在标题行内时显示井号', () => {
    expect(isHidden(stateOf('## 标题\n正文', 3), 0, 3)).toBe(false)
  })

  it('光标位于标题行行尾时同样显示井号', () => {
    expect(isHidden(stateOf('## 标题\n正文', 4), 0, 3)).toBe(false)
  })

  it('多个标题各自独立判断', () => {
    const doc = '## 一\n\n## 二\n\n正文'
    const state = stateOf(doc, doc.indexOf('正文'))
    expect(isHidden(state, 0, 3)).toBe(true)
    expect(isHidden(state, 6, 9)).toBe(true)
  })

  it('光标在第二个标题时，第一个仍保持收起', () => {
    const doc = '## 一\n\n## 二\n\n正文'
    const state = stateOf(doc, doc.indexOf('二'))
    expect(isHidden(state, 0, 3)).toBe(true)
    expect(isHidden(state, 6, 9)).toBe(false)
  })
})

describe('强调标记的显示与隐藏', () => {
  it('光标在别处时隐藏粗体星号', () => {
    const doc = '前**重点**后'
    const state = stateOf(doc, 0)
    expect(isHidden(state, 1, 3)).toBe(true)
    expect(isHidden(state, 5, 7)).toBe(true)
  })

  it('光标位于粗体内容中央时显示星号', () => {
    const doc = '前**重点**后'
    const state = stateOf(doc, 3)
    expect(isHidden(state, 1, 3)).toBe(false)
    expect(isHidden(state, 5, 7)).toBe(false)
  })

  it('斜体星号同样按光标位置切换', () => {
    const doc = '前*斜*后'
    expect(isHidden(stateOf(doc, 0), 1, 2)).toBe(true)
    expect(isHidden(stateOf(doc, 2), 1, 2)).toBe(false)
  })

  it('嵌套结构中光标所在层级展开，外层随之内层规则', () => {
    const doc = '**粗 _斜_ 体**'
    // 光标在粗体起点，属于外层范围，外层展开；内层斜体仍收起
    const outer = hidden(stateOf(doc, 0))
    expect(outer).not.toContainEqual([0, 2])
    expect(outer).toContainEqual([4, 5])
    expect(outer).toContainEqual([6, 7])
  })

  it('光标进入内层斜体时内外层都展开', () => {
    const doc = '**粗 _斜_ 体**'
    // 光标位于内层斜体内部，其祖先链上的标记全部展开
    const inner = hidden(stateOf(doc, 5))
    expect(inner).not.toContainEqual([4, 5])
    expect(inner).not.toContainEqual([6, 7])
    expect(inner).not.toContainEqual([0, 2])
  })
})

describe('代码与链接标记', () => {
  it('行内代码的反引号在光标离开时隐藏', () => {
    const doc = '使用 `code` 示例'
    const state = stateOf(doc, 0)
    expect(isHidden(state, 3, 4)).toBe(true)
    expect(isHidden(state, 8, 9)).toBe(true)
  })

  it('光标进入行内代码时显示反引号', () => {
    expect(isHidden(stateOf('使用 `code` 示例', 5), 3, 4)).toBe(false)
  })

  it('光标离开时隐藏链接地址', () => {
    const doc = '见 [文字](https://a.b) 结束'
    const state = stateOf(doc, 0)
    const start = doc.indexOf('https')
    expect(isHidden(state, start, start + 'https://a.b'.length)).toBe(true)
  })

  it('光标进入链接时显示地址', () => {
    const doc = '见 [文字](https://a.b) 结束'
    const state = stateOf(doc, 4)
    const start = doc.indexOf('https')
    expect(isHidden(state, start, start + 'https://a.b'.length)).toBe(false)
  })

  it('隐藏链接的方括号与圆括号', () => {
    const doc = '见 [文字](https://a.b) 结束'
    const ranges = hidden(stateOf(doc, 0))
    expect(ranges).toContainEqual([2, 3])
    expect(ranges).toContainEqual([5, 6])
    expect(ranges).toContainEqual([6, 7])
  })

  it('图片语法收起时整体替换为图像部件', () => {
    const doc = '前 ![替代](/images/a.png) 后'
    const ranges = hidden(stateOf(doc, 0))
    const start = doc.indexOf('![')
    const end = start + '![替代](/images/a.png)'.length
    expect(ranges).toContainEqual([start, end])
  })

  it('光标进入图片语法时恢复源码', () => {
    const doc = '前 ![替代](/images/a.png) 后'
    const state = stateOf(doc, doc.indexOf('替代') + 1)
    const start = doc.indexOf('![')
    const end = start + '![替代](/images/a.png)'.length
    expect(isHidden(state, start, end)).toBe(false)
  })
})

describe('代码块与公式内部不受影响', () => {
  it('代码块内的井号不被隐藏', () => {
    const doc = '```\n## 不是标题\n```\n'
    const ranges = hidden(stateOf(doc, 0))
    expect(ranges.some(([from]) => from === 4)).toBe(false)
  })

  it('代码块内的星号不被隐藏', () => {
    const doc = '```\n**不是粗体**\n```\n'
    const ranges = hidden(stateOf(doc, 0))
    const lineStart = doc.indexOf('**')
    expect(ranges.some(([from]) => from === lineStart)).toBe(false)
  })

  it('公式的美元定界符按光标位置切换', () => {
    const doc = '定义 $f[u]$ 距离'
    const state = stateOf(doc, 0)
    // 两个 $ 分别位于 [3,4) 与 [8,9)
    expect(isHidden(state, 3, 4)).toBe(true)
    expect(isHidden(state, 8, 9)).toBe(true)
  })

  it('光标进入公式时显示美元定界符', () => {
    const doc = '定义 $f[u]$ 距离'
    const state = stateOf(doc, 5)
    expect(isHidden(state, 3, 4)).toBe(false)
  })

  it('公式内的方括号不被当作链接隐藏', () => {
    const doc = '定义 $f[u]$ 距离'
    const ranges = hidden(stateOf(doc, 0))
    const bracket = doc.indexOf('[u]')
    expect(ranges.some(([from]) => from === bracket)).toBe(false)
  })
})

describe('正文中的裸地址', () => {
  it('裸地址不产生任何隐藏装饰', () => {
    const doc = '正文 https://c.d 结束\n'
    expect(hidden(stateOf(doc, doc.length))).toEqual([])
  })

  it('裸地址在光标位于别处时仍然可见', () => {
    const doc = '正文 https://c.d 结束\n'
    const start = doc.indexOf('https')
    expect(isHidden(stateOf(doc, doc.length), start, start + 'https://c.d'.length)).toBe(false)
  })

  it('属于链接的地址仍然按链接整体收起', () => {
    const doc = '见 [文字](https://a.b) 结束'
    const start = doc.indexOf('https')
    expect(isHidden(stateOf(doc, 0), start, start + 'https://a.b'.length)).toBe(true)
  })

  it('引用式链接的定义行不丢失文字', () => {
    const doc = '[文字][引用]\n\n[引用]: https://a.b "标题"\n'
    const state = stateOf(doc, doc.length)
    // 定义行里的地址属于定义本身，不应被隐藏
    const definition = doc.indexOf('https://a.b')
    expect(isHidden(state, definition, definition + 'https://a.b'.length)).toBe(false)
  })

  it('引用式链接的使用处仍然按链接整体收起', () => {
    const doc = '[文字][引用]\n\n[引用]: https://a.b "标题"\n'
    // 光标停在定义行上，使用处的链接整体收起，只留下「文字」
    const state = stateOf(doc, doc.length)
    expect(isHidden(state, 0, 1)).toBe(true)
    expect(isHidden(state, 3, 4)).toBe(true)
    expect(isHidden(state, 4, 8)).toBe(true)
  })

  it('定义行整体保持可见，不会塌陷成一个空格', () => {
    const doc = '[文字][引用]\n\n[引用]: https://a.b "标题"\n'
    const state = stateOf(doc, doc.length)
    const line = state.doc.lineAt(doc.indexOf('[引用]:'))
    const cuts = hidden(state).filter(([from]) => from >= line.from && from <= line.to)
    expect(cuts).toEqual([])
  })
})

describe('列表标记', () => {
  it('无序列表符号收起时替换为圆点', () => {
    const doc = '- 第一项\n- 第二项\n\n正文'
    const state = stateOf(doc, doc.indexOf('正文'))
    // 只替换标记字符本身，其后的空格保留
    expect(isHidden(state, 0, 1)).toBe(true)
    expect(isHidden(state, 6, 7)).toBe(true)
  })

  it('光标停在条目正文中时标记收起为项目符号', () => {
    // 判定范围是标记自身，与标题的整行判定不同
    const doc = '- 第一项\n- 第二项'
    expect(isHidden(stateOf(doc, 3), 0, 1)).toBe(true)
  })

  it('光标落在标记字符上时显示源码', () => {
    const doc = '- 第一项\n- 第二项'
    expect(isHidden(stateOf(doc, 0), 0, 1)).toBe(false)
  })

  it('光标紧邻标记之后时显示源码', () => {
    const doc = '- 第一项\n- 第二项'
    expect(isHidden(stateOf(doc, 1), 0, 1)).toBe(false)
  })

  it('光标位于标记之后第二位时标记收起', () => {
    const doc = '- 第一项\n- 第二项'
    expect(isHidden(stateOf(doc, 2), 0, 1)).toBe(true)
  })

  it('有序列表标记连同序号一起判定', () => {
    const doc = '1. 第一\n2. 第二'
    // ListMark 覆盖 "1."，光标落在序号里时显示源码
    expect(isHidden(stateOf(doc, 0), 0, 2)).toBe(false)
    // 光标进入正文后收起
    expect(isHidden(stateOf(doc, 4), 0, 2)).toBe(true)
  })

  it('有序列表保留序号而不是圆点', () => {
    const doc = '1. 第一\n2. 第二\n\n正文'
    const { view, cleanup } = render(doc, doc.indexOf('正文'))
    const bullets = Array.from(view.dom.querySelectorAll('.mde-list-bullet'))
      .map(element => element.textContent)
    expect(bullets).toEqual(['1.', '2.'])
    cleanup()
  })

  it('收起后的项目符号与正文之间保留一个空格', () => {
    const doc = '- 项目内容\n\n正文'
    const { view, cleanup } = render(doc, doc.indexOf('正文'))
    expect(view.dom.querySelector('.cm-line')?.textContent).toBe('• 项目内容')
    cleanup()
  })
})

describe('回车后的文档结构', () => {
  it('标题后回车产生独立段落，而不是并入标题', () => {
    const doc = '## 复数\n新行'
    const tops: string[] = []
    syntaxTree(stateOf(doc, doc.length)).iterate({
      enter(node) {
        if (node.node.parent?.name === 'Document') tops.push(node.name)
      },
    })
    expect(tops).toEqual(['ATXHeading2', 'Paragraph'])
  })

  it('标题行尾回车后标题标记仍按行判断可见性', () => {
    const doc = '## 复数\n新行'
    const state = stateOf(doc, doc.length)
    // 光标在第二行，标题收起
    expect(isHidden(state, 0, 3)).toBe(true)
  })
})

describe('渲染结果', () => {
  it('高亮样式作用于标题文字', () => {
    const { view, cleanup } = render('## 复数\n\n正文', 0)
    const heading = view.dom.querySelector('.cm-line')
    expect(heading?.textContent).toContain('复数')
    cleanup()
  })

  it('收起的列表符号渲染为部件元素', () => {
    const { view, cleanup } = render('- 项目\n\n正文', 7)
    expect(view.dom.querySelector('.mde-list-bullet')).not.toBeNull()
    cleanup()
  })

  it('收起的图片渲染为真实图像元素', () => {
    const doc = '![替代](/images/a.png)\n\n正文'
    // 光标放在末尾段落中，图片语法整体处于收起状态
    const { view, cleanup } = render(doc, doc.indexOf('正文'))
    const img = view.dom.querySelector('img.mde-image')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('alt')).toBe('替代')
    expect(img?.getAttribute('src')).toBe('/images/a.png')
    cleanup()
  })

  it('光标进入图片语法后恢复为源码文本', () => {
    const doc = '![替代](/images/a.png)\n\n正文'
    const { view, cleanup } = render(doc, 2)
    expect(view.dom.querySelector('img.mde-image')).toBeNull()
    expect(view.dom.textContent).toContain('![替代](/images/a.png)')
    cleanup()
  })
})
