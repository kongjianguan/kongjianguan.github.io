/*
 * 公式排版。站点在构建期用 MathJax 把公式渲染成 SVG，这里用同一套
 * TeX 输入与 SVG 输出配置，使编辑态与阅读态的排版结果一致。
 * 引擎体积很大，只有文档里真正出现公式时才加载。
 */

export interface MathRenderer {
  render(tex: string, display: boolean): string
}

const STYLE_ID = 'mde-mathjax-style'

let pending: Promise<MathRenderer> | null = null

/* fontCache 为 none 时公共样式表需要单独挂到文档上 */
function injectStyle(css: string): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = css
  document.head.appendChild(style)
}

async function createRenderer(): Promise<MathRenderer> {
  const [mathjaxModule, texModule, packagesModule, svgModule, adaptorModule, htmlModule, assistiveModule] =
    await Promise.all([
      import('mathjax-full/js/mathjax.js'),
      import('mathjax-full/js/input/tex.js'),
      import('mathjax-full/js/input/tex/AllPackages.js'),
      import('mathjax-full/js/output/svg.js'),
      import('mathjax-full/js/adaptors/liteAdaptor.js'),
      import('mathjax-full/js/handlers/html.js'),
      import('mathjax-full/js/a11y/assistive-mml.js'),
    ])

  const adaptor = adaptorModule.liteAdaptor()
  const handler = htmlModule.RegisterHTMLHandler(adaptor)
  assistiveModule.AssistiveMmlHandler(handler)

  const mathDocument = mathjaxModule.mathjax.document('', {
    InputJax: new texModule.TeX({ packages: packagesModule.AllPackages }),
    OutputJax: new svgModule.SVG({ fontCache: 'none' }),
  })

  injectStyle(adaptor.textContent(mathDocument.outputJax.styleSheet(mathDocument)))

  return {
    render: (tex, display) => adaptor.outerHTML(mathDocument.convert(tex, { display })),
  }
}

export function loadMathRenderer(): Promise<MathRenderer> {
  if (!pending) pending = createRenderer()
  return pending
}

const cache = new Map<string, string>()

function cacheKey(tex: string, display: boolean): string {
  return `${display ? 'D' : 'I'}${tex}`
}

/* 已经排版过的公式同步返回，避免输入过程中出现跳动 */
export function cachedMathSvg(tex: string, display: boolean): string | undefined {
  return cache.get(cacheKey(tex, display))
}

export async function renderMathToSvg(tex: string, display: boolean): Promise<string> {
  const key = cacheKey(tex, display)
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const renderer = await loadMathRenderer()
  const svg = renderer.render(tex, display)
  cache.set(key, svg)
  return svg
}
