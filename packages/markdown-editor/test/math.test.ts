import { describe, expect, it } from 'vitest'
import MarkdownIt from 'markdown-it'
import mathjax3 from 'markdown-it-mathjax3'
import { EditorState } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { mathExtension } from '../src/livePreview/math'
import { parseImageSyntax } from '../src/livePreview/plugin'

/*
 * 通过生产环境使用的同一套配置取得语法树，
 * 避免直接调用解析器内部 API 而偏离真实装配方式。
 */
function stateOf(src: string): EditorState {
  return EditorState.create({
    doc: src,
    extensions: [
      markdown({ base: markdownLanguage, extensions: [mathExtension], addKeymap: false }),
    ],
  })
}

/*
 * 把语法树压成便于断言的形状：节点名与对应源码片段。
 */
function tree(src: string): Array<{ name: string; text: string }> {
  const result: Array<{ name: string; text: string }> = []
  syntaxTree(stateOf(src)).iterate({
    enter(node) {
      result.push({ name: node.name, text: src.slice(node.from, node.to) })
    },
  })
  return result
}

function names(src: string): string[] {
  return tree(src).map(node => node.name)
}

describe('公式语法', () => {
  it('行内公式成为独立节点，不再被解析为链接', () => {
    const nodes = tree('定义 $f[u]$ 表示距离\n')
    expect(nodes.some(node => node.name === 'Math' && node.text === '$f[u]$')).toBe(true)
    // 关键点：方括号不再产生链接节点，实时预览因此不会隐藏方括号。
    expect(names('定义 $f[u]$ 表示距离\n')).not.toContain('Link')
  })

  it('多个行内公式各自独立', () => {
    const mathNodes = tree('*size*$[u]$大小与$ans=min(f[i],1<=i<=n)$公式\n')
      .filter(node => node.name === 'Math')
    expect(mathNodes).toHaveLength(2)
    expect(mathNodes[0].text).toBe('$[u]$')
    expect(mathNodes[1].text).toBe('$ans=min(f[i],1<=i<=n)$')
  })

  it('公式内容的尖括号不会被当作 HTML 标签', () => {
    expect(names('$1<=i<=n$\n')).not.toContain('HTMLTag')
  })

  it('公式内容作为整体不被强调语法拆分', () => {
    const emphasis = names('$a*b*c$\n').filter(name => name === 'EmphasisMark')
    expect(emphasis).toHaveLength(0)
  })

  it('未闭合的美元符号保持为普通文本', () => {
    expect(names('这里 $abc 没有结束\n')).not.toContain('Math')
  })

  it('金额写法不被识别为公式', () => {
    expect(names('价格 $5 到 $10 之间\n')).not.toContain('Math')
  })

  it('空内容的美元符号对不被识别为公式', () => {
    expect(names('空 $ $ 内容\n')).not.toContain('Math')
  })

  it('公式可以与强调语法共存', () => {
    const nodeNames = names('**粗体** 与 $x^2$ 公式\n')
    expect(nodeNames).toContain('StrongEmphasis')
    expect(nodeNames).toContain('Math')
  })

  it('公式节点包含美元标记与内容两部分', () => {
    const nodes = tree('$a+b$\n')
    const kinds = nodes.filter(node => ['DollarMark', 'MathContent'].includes(node.name))
    expect(kinds.map(node => node.text)).toEqual(['$', 'a+b', '$'])
  })
})

describe('站点公式渲染一致性', () => {
  const site = MarkdownIt({ html: true, breaks: false, linkify: false }).use(mathjax3)

  it('站点渲染的公式与编辑器识别的区间一致', () => {
    const line = '定义几个数组：$f[u]$表示以u为根的总距离\n'
    // 站点侧渲染为公式
    expect(site.render(line)).toContain('mjx-container')

    // 编辑器侧识别出同样的公式文本
    const math = tree(line).find(node => node.name === 'Math')
    expect(math?.text).toBe('$f[u]$')
  })

  it('真实文章中的公式都能被编辑器正确识别', () => {
    const body = '显然，$ans=min(f[i],1<=i<=n)$\n'
    const math = tree(body).filter(node => node.name === 'Math')
    expect(math).toHaveLength(1)
    expect(math[0].text).toBe('$ans=min(f[i],1<=i<=n)$')
  })
})

describe('parseImageSyntax', () => {
  it('解析普通图片语法', () => {
    expect(parseImageSyntax('![替代](/images/a.png)')).toEqual({
      alt: '替代',
      src: '/images/a.png',
    })
  })

  it('解析空替代文字', () => {
    expect(parseImageSyntax('![](/images/a.png)')).toEqual({ alt: '图片', src: '/images/a.png' })
  })

  it('解析尖括号包裹的地址', () => {
    expect(parseImageSyntax('![a](<a b.png>)')).toEqual({ alt: 'a', src: 'a b.png' })
  })

  it('解析带标题的图片', () => {
    expect(parseImageSyntax('![a](/x.png "标题")')).toEqual({ alt: 'a', src: '/x.png' })
  })

  it('非图片语法返回 null', () => {
    expect(parseImageSyntax('[链接](/x)')).toBeNull()
    expect(parseImageSyntax('普通文字')).toBeNull()
  })
})
