import { onBeforeUnmount, onMounted } from 'vue'
import isMobile from 'is-mobile'

export function useLive2D(enabled: () => boolean) {
  let dispose = () => {}

  onMounted(() => {
    if (!enabled() || isMobile({ tablet: false })) return

    let started = false
    let disposed = false
    let frame = 0
    let timer = 0

    function schedule() {
      if (started || disposed || !enabled() || document.readyState !== 'complete') return
      started = true
      // 等待页面资源加载完成，并让浏览器完成下一次绘制。
      frame = requestAnimationFrame(() => {
        timer = window.setTimeout(async () => {
          if (disposed || !enabled()) {
            started = false
            return
          }
          const { loadLive2D } = await import('../live2d')
          if (!disposed && enabled()) loadLive2D()
        }, 0)
      })
    }

    window.addEventListener('load', schedule, { once: true })
    schedule()

    dispose = () => {
      disposed = true
      window.removeEventListener('load', schedule)
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
  })

  onBeforeUnmount(() => dispose())
}
