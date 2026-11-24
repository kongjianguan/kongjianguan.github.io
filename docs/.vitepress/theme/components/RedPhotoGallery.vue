<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ photos: string[]; title: string }>()
const active = ref(0)
const track = ref<HTMLDivElement>()
const preview = ref<HTMLDialogElement>()
const previewOpen = ref(false)
const previewImage = ref<HTMLImageElement>()
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const isPanning = ref(false)
const canvasStyle = computed(() => ({
  transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
}))
const doubleTapDelay = 300
const tapSlop = 15
let closeTimer: number | undefined
let lastTap: { x: number; y: number; time: number } | undefined
let touchStart: { x: number; y: number; moved: boolean } | undefined
let panStart: { x: number; y: number; translateX: number; translateY: number; limitX: number; limitY: number } | undefined
const aspectRatios = ref<Record<number, number>>({})
const frameRatio = computed(() => {
  const ratios = Object.values(aspectRatios.value)
  return ratios.length ? Math.max(0.75, Math.min(...ratios)) : 1
})

function measureImage(index: number, image: HTMLImageElement) {
  if (image.naturalWidth && image.naturalHeight) {
    aspectRatios.value[index] = image.naturalWidth / image.naturalHeight
  }
}

const preloadedPhotos = new Set<string>()
function preloadAdjacent(index: number) {
  if (typeof window === 'undefined') return
  for (const offset of [-1, 1]) {
    const src = props.photos[index + offset]
    if (!src || preloadedPhotos.has(src)) continue
    preloadedPhotos.add(src)
    const img = new Image()
    img.src = src
  }
}

watch(active, index => preloadAdjacent(index))

// Image loads can finish before VitePress hydrates the server-rendered gallery.
onMounted(() => {
  track.value?.querySelectorAll('img').forEach((image, index) => measureImage(index, image))
  preloadAdjacent(active.value)
})

function updatePosition() {
  const element = track.value!
  active.value = Math.round(element.scrollLeft / element.clientWidth)
}

function goTo(index: number) {
  const element = track.value
  if (!element || index < 0 || index >= props.photos.length) return
  resetZoom()
  active.value = index
  element.scrollTo({ left: index * element.clientWidth })
}

function goToPrev() {
  goTo(active.value - 1)
}

function goToNext() {
  goTo(active.value + 1)
}

function openPreview(index: number) {
  goTo(index)
  preview.value?.showModal()
  previewOpen.value = true
}

function closePreview() {
  preview.value?.close()
  previewOpen.value = false
  resetZoom()
}

function clearCloseTimer() {
  window.clearTimeout(closeTimer)
  closeTimer = undefined
}

function scheduleClose() {
  clearCloseTimer()
  closeTimer = window.setTimeout(closePreview, doubleTapDelay)
}

function resetZoom() {
  clearCloseTimer()
  stopMousePan()
  lastTap = undefined
  touchStart = undefined
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}

function toggleZoom() {
  const nextScale = scale.value === 1 ? 2.5 : 1
  resetZoom()
  scale.value = nextScale
}

function handleStageClick(event: MouseEvent) {
  if (scale.value === 1 && event.detail <= 1) scheduleClose()
}

function startPan(x: number, y: number) {
  const image = previewImage.value
  const canvas = image?.parentElement
  if (!image || !canvas) return
  const availableHeight = canvas.clientHeight - Number.parseFloat(getComputedStyle(canvas).paddingTop)
  panStart = {
    x,
    y,
    translateX: translateX.value,
    translateY: translateY.value,
    limitX: Math.max(0, (image.clientWidth * scale.value - canvas.clientWidth) / 2),
    limitY: Math.max(0, (image.clientHeight * scale.value - availableHeight) / 2),
  }
}

function movePan(x: number, y: number) {
  if (!panStart) return
  const { limitX, limitY } = panStart
  isPanning.value = true
  translateX.value = Math.max(-limitX, Math.min(limitX, panStart.translateX + x - panStart.x))
  translateY.value = Math.max(-limitY, Math.min(limitY, panStart.translateY + y - panStart.y))
}

function handleMouseDown(event: MouseEvent) {
  if (scale.value === 1 || event.button !== 0) return
  event.preventDefault()
  startPan(event.clientX, event.clientY)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', stopMousePan)
  window.addEventListener('blur', stopMousePan)
}

function handleMouseMove(event: MouseEvent) {
  movePan(event.clientX, event.clientY)
}

function stopMousePan() {
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', stopMousePan)
  window.removeEventListener('blur', stopMousePan)
  stopPan()
}

function stopPan() {
  panStart = undefined
  isPanning.value = false
}

function handleTouchStart(event: TouchEvent) {
  clearCloseTimer()
  if (event.touches.length !== 1) {
    cancelTouch()
    return
  }
  const { clientX: x, clientY: y } = event.touches[0]
  touchStart = { x, y, moved: false }
  if (scale.value > 1) startPan(x, y)
}

function handleTouchMove(event: TouchEvent) {
  if (!touchStart) return
  const { clientX: x, clientY: y } = event.touches[0]
  if (Math.hypot(x - touchStart.x, y - touchStart.y) >= tapSlop) touchStart.moved = true
  if (touchStart.moved && scale.value > 1) movePan(x, y)
}

function handleTouchEnd(event: TouchEvent) {
  event.preventDefault()
  const start = touchStart
  touchStart = undefined
  stopPan()
  if (!start) return

  const { clientX: x, clientY: y } = event.changedTouches[0]
  const dx = x - start.x
  const dy = y - start.y
  if (start.moved || Math.hypot(dx, dy) >= tapSlop) {
    lastTap = undefined
    if (scale.value === 1 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      goTo(active.value + (dx < 0 ? 1 : -1))
    }
    return
  }

  const time = performance.now()
  if (lastTap && time - lastTap.time < doubleTapDelay && Math.hypot(x - lastTap.x, y - lastTap.y) < tapSlop) {
    toggleZoom()
    return
  }
  lastTap = { x, y, time }
  if (scale.value === 1) scheduleClose()
}

function cancelTouch() {
  touchStart = undefined
  lastTap = undefined
  stopPan()
}

onBeforeUnmount(resetZoom)
</script>

<template>
  <section
    class="photo-gallery"
    :style="{ '--frame-ratio': frameRatio }"
    aria-label="文章照片"
    @keydown.left.prevent="goTo(active - 1)"
    @keydown.right.prevent="goTo(active + 1)"
  >
    <div class="photo-sticky-wrap">
      <div class="photo-stage">
        <div ref="track" class="photo-track" @scroll.passive="updatePosition">
          <button
            v-for="(photo, index) in photos"
            :key="index"
            class="photo-slide"
            :style="{ aspectRatio: String(frameRatio) }"
            type="button"
            :tabindex="index === active ? 0 : -1"
            :aria-label="`预览第 ${index + 1} 张照片`"
            @click="openPreview(index)"
          >
            <img :src="photo" :alt="`${title} · 照片 ${index + 1}`" draggable="false" @load="measureImage(index, $event.currentTarget as HTMLImageElement)" />
          </button>
        </div>

        <template v-if="photos.length > 1">
          <span class="photo-count" aria-live="polite">{{ active + 1 }} / {{ photos.length }}</span>
          <button class="photo-arrow previous" type="button" aria-label="上一张照片" :disabled="active === 0" @click="goTo(active - 1)">‹</button>
          <button class="photo-arrow next" type="button" aria-label="下一张照片" :disabled="active === photos.length - 1" @click="goTo(active + 1)">›</button>
          <div class="photo-dots" aria-label="选择照片">
            <button
              v-for="(_, index) in photos"
              :key="index"
              type="button"
              :aria-label="`查看第 ${index + 1} 张照片`"
              :aria-current="index === active ? 'true' : undefined"
              @click="goTo(index)"
            />
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <dialog
        ref="preview"
        class="photo-preview"
        aria-label="照片预览"
        @click.self="closePreview"
        @close="!preview?.open && closePreview()"
        @cancel.prevent="closePreview"
        @keydown.left.prevent="goToPrev"
        @keydown.right.prevent="goToNext"
      >
        <div
          class="photo-preview-stage"
          :class="{ 'is-zoomed': scale > 1, 'is-panning': isPanning }"
          @click="handleStageClick"
          @dblclick="toggleZoom"
          @touchstart.passive="handleTouchStart"
          @touchmove.passive="handleTouchMove"
          @touchend="handleTouchEnd"
          @touchcancel="cancelTouch"
          @mousedown="handleMouseDown"
        >
          <div class="photo-preview-viewport">
            <div class="photo-preview-canvas" :style="canvasStyle">
              <img
                v-if="previewOpen"
                ref="previewImage"
                :src="photos[active]"
                :alt="`${title} · 照片 ${active + 1}`"
                class="photo-preview-img"
                draggable="false"
              />
            </div>
          </div>
        </div>

        <div v-if="photos.length > 1" class="preview-counter" aria-live="polite">
          {{ active + 1 }} / {{ photos.length }}
        </div>

        <button type="button" class="preview-close-btn" aria-label="关闭照片预览" autofocus @click="closePreview">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <template v-if="photos.length > 1">
          <button class="preview-arrow prev" type="button" aria-label="上一张照片" :disabled="active === 0" @click.stop="goToPrev">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button class="preview-arrow next" type="button" aria-label="下一张照片" :disabled="active === photos.length - 1" @click.stop="goToNext">
            <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </template>
      </dialog>
    </Teleport>
  </section>
</template>

<style scoped>
.photo-gallery { min-width: 0; background: transparent; }
.photo-stage { position: relative; }
.photo-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
  background: transparent;
}
.photo-slide { position: relative; flex: 0 0 100%; min-width: 0; scroll-snap-align: start; scroll-snap-stop: always; cursor: zoom-in; background: transparent; border: none; }
.photo-slide:focus-visible { outline-offset: -4px; }
.photo-slide img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.photo-count, .photo-arrow, .photo-dots {
  position: absolute;
  border-radius: 999px;
  color: white;
}
.photo-count, .photo-dots { background: rgb(20 20 24 / 74%); }
.photo-count { top: 12px; right: 12px; padding: 3px 11px; font-size: 13px; font-variant-numeric: tabular-nums; pointer-events: none; }
.photo-arrow { display: none; top: 50%; width: 44px; height: 44px; transform: translateY(-50%); font-size: 30px; background: transparent; text-shadow: 0 1px 4px rgb(0 0 0 / 90%); }
.photo-arrow:disabled { opacity: .35; cursor: default; }
.previous { left: 12px; }
.next { right: 12px; }
.photo-dots { display: flex; max-width: calc(100% - 24px); overflow-x: auto; scrollbar-width: none; bottom: 12px; left: 50%; transform: translateX(-50%); padding-inline: 5px; }
.photo-dots button { display: grid; flex: 0 0 22px; height: 32px; place-items: center; }
.photo-dots button::before { content: ''; display: block; width: 7px; height: 7px; border-radius: 999px; background: rgb(255 255 255 / 59%); }
.photo-dots button[aria-current]::before { width: 14px; background: white; }
.photo-preview {
  --preview-top: max(16px, env(safe-area-inset-top));
  --preview-controls-space: calc(var(--preview-top) + 48px);
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: rgba(10, 10, 15, 0.94);
  backdrop-filter: blur(20px);
  overflow: hidden;
  user-select: none;
}
.photo-preview::backdrop { background: transparent; }
.photo-preview-stage {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  touch-action: none;
  cursor: zoom-in;
}
.photo-preview-stage.is-zoomed { cursor: grab; }
.photo-preview-stage.is-panning { cursor: grabbing; }
.photo-preview-viewport { clip-path: inset(var(--preview-controls-space) 0 0); }
.photo-preview-canvas {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  height: 100dvh;
  padding-top: var(--preview-controls-space);
  transform-origin: center calc(50% + var(--preview-controls-space) / 2);
  transition: transform 0.25s cubic-bezier(0.2, 0, 0.2, 1);
  will-change: transform;
}
.is-panning .photo-preview-canvas { transition: none; }
.photo-preview-img {
  max-width: 100vw;
  max-height: calc(100dvh - var(--preview-controls-space));
  width: auto;
  height: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.preview-close-btn, .preview-arrow {
  position: fixed;
  place-items: center;
  border-radius: 50%;
  backdrop-filter: blur(12px);
  color: #fff;
}
.preview-close-btn {
  display: grid;
  top: var(--preview-top);
  right: max(16px, env(safe-area-inset-right));
  width: 40px;
  height: 40px;
  background: rgba(30, 30, 36, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 60;
}
.preview-counter {
  position: fixed;
  top: var(--preview-top);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 14px;
  border-radius: 999px;
  background: rgba(30, 30, 36, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #fff;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  z-index: 55;
}
.preview-arrow {
  display: none;
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translateY(-50%);
  background: rgba(30, 30, 36, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  z-index: 55;
}
.preview-arrow.prev { left: max(16px, env(safe-area-inset-left)); }
.preview-arrow.next { right: max(16px, env(safe-area-inset-right)); }
.preview-arrow:disabled { opacity: 0.35; cursor: default; }

@media (min-width: 768px) {
  .preview-arrow { display: grid; }
}

@media (prefers-reduced-motion: reduce) {
  .photo-preview-canvas { transition: none; }
}

@media (min-width: 960px) {
  .photo-gallery {
    --photo-available-height: calc(100dvh - var(--red-gallery-nav-height, var(--vp-nav-height)) - 48px);
    align-self: stretch;
    height: 100%;
    min-height: 0;
  }
  .photo-sticky-wrap {
    position: sticky;
    top: calc(var(--red-gallery-nav-height, var(--vp-nav-height)) + 24px);
    height: var(--photo-available-height);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .photo-stage { width: min(100%, calc(var(--photo-available-height) * var(--frame-ratio))); }
  .photo-arrow { display: block; }
}
</style>
