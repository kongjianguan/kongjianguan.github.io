import { WidgetType, type EditorView } from '@codemirror/view'
import { cachedMathSvg, renderMathToSvg } from './mathjax'

/*
 * 公式部件。排版引擎按需加载，加载完成前先显示公式源码，
 * 因此打开包含公式的文章不会被打包体积拖慢，输入过程也不会被阻塞。
 */

class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly source: string,
    private readonly display: boolean,
  ) {
    super()
  }

  override eq(other: MathWidget): boolean {
    return other.source === this.source && other.display === this.display
  }

  override toDOM(view: EditorView): HTMLElement {
    const host = document.createElement(this.display ? 'div' : 'span')
    host.className = this.display ? 'mde-math' : 'mde-math-inline'

    const ready = cachedMathSvg(this.tex, this.display)
    if (ready !== undefined) {
      host.innerHTML = ready
      return host
    }

    host.textContent = this.tex
    host.classList.add('mde-math-pending')
    void renderMathToSvg(this.tex, this.display).then(svg => {
      // 部件可能已经被换掉，此时结果只进缓存不再写回
      if (!host.isConnected) return
      host.innerHTML = svg
      host.classList.remove('mde-math-pending')
      view.requestMeasure()
    })
    return host
  }

  override ignoreEvent(): boolean {
    return false
  }
}

export function mathWidget(tex: string, source: string, display: boolean): MathWidget {
  return new MathWidget(tex, source, display)
}
