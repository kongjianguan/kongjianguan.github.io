<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

const props = defineProps<{ photos: string[]; title: string }>()
const active = ref(0)
const track = ref<HTMLDivElement>()
const preview = ref<HTMLDialogElement>()
const previewOpen = ref(false)
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

// Image loads can finish before VitePress hydrates the server-rendered gallery.
onMounted(() => track.value?.querySelectorAll('img').forEach((image, index) => measureImage(index, image)))

function updatePosition() {
  const element = track.value!
  active.value = Math.round(element.scrollLeft / element.clientWidth)
}

function goTo(index: number) {
  const element = track.value
  if (!element || index < 0 || index >= props.photos.length) return
  active.value = index
  element.scrollTo({ left: index * element.clientWidth })
}

function openPreview(index: number) {
  goTo(index)
  preview.value?.showModal()
  previewOpen.value = true
}
</script>

<template>
  <section
    class="photo-gallery"
    :style="{ '--frame-ratio': frameRatio }"
    aria-label="文章照片"
    @keydown.left.prevent="goTo(active - 1)"
    @keydown.right.prevent="goTo(active + 1)"
  >
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

    <Teleport to="body">
      <dialog
        ref="preview"
        class="photo-preview"
        aria-label="照片预览"
        @click.self="preview?.close()"
        @close="previewOpen = false"
        @keydown.left.prevent="goTo(active - 1)"
        @keydown.right.prevent="goTo(active + 1)"
      >
        <div class="photo-preview-frame" :style="{ aspectRatio: String(frameRatio), '--frame-ratio': frameRatio }">
          <img v-if="previewOpen" :src="photos[active]" :alt="`${title} · 照片 ${active + 1}`" />
          <button type="button" class="preview-close" aria-label="关闭照片预览" autofocus @click="preview?.close()">×</button>
        </div>
      </dialog>
    </Teleport>
  </section>
</template>

<style scoped>
.photo-gallery { position: relative; min-width: 0; background: var(--vp-c-bg-soft); }
.photo-track {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.photo-slide { position: relative; flex: 0 0 100%; min-width: 0; scroll-snap-align: start; scroll-snap-stop: always; cursor: zoom-in; }
.photo-slide:focus-visible { outline-offset: -4px; }
.photo-slide img, .photo-preview-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.photo-count, .photo-arrow, .photo-dots, .preview-close {
  position: absolute;
  border-radius: 999px;
  background: rgb(20 20 24 / 74%);
  color: white;
}
.photo-count { top: 12px; right: 12px; padding: 3px 11px; font-size: 13px; font-variant-numeric: tabular-nums; pointer-events: none; }
.photo-arrow { display: none; top: 50%; width: 44px; height: 44px; transform: translateY(-50%); font-size: 30px; }
.photo-arrow:disabled { opacity: .35; cursor: default; }
.previous { left: 12px; }
.next { right: 12px; }
.photo-dots { display: flex; max-width: calc(100% - 24px); overflow-x: auto; scrollbar-width: none; bottom: 12px; left: 50%; transform: translateX(-50%); padding-inline: 5px; }
.photo-dots button { display: grid; flex: 0 0 22px; height: 32px; place-items: center; }
.photo-dots button::before { content: ''; display: block; width: 7px; height: 7px; border-radius: 999px; background: rgb(255 255 255 / 59%); }
.photo-dots button[aria-current]::before { width: 14px; background: white; }
.photo-preview { position: fixed; inset: 0; width: 100%; height: 100%; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: hidden; }
.photo-preview[open] { display: grid; place-items: center; }
.photo-preview::backdrop { background: #0c0c10; }
.photo-preview-frame { position: relative; width: min(calc(100vw - 32px), calc((100dvh - 120px) * var(--frame-ratio))); }
.preview-close { top: 8px; right: 8px; width: 44px; height: 44px; font-size: 28px; }

@media (min-width: 960px) {
  .photo-gallery {
    align-self: start;
    justify-self: center;
    position: sticky;
    top: calc(var(--vp-nav-height) + 24px);
    width: min(100%, calc((100dvh - var(--vp-nav-height) - 48px) * var(--frame-ratio)));
  }
  .photo-arrow { display: block; }
}
</style>
