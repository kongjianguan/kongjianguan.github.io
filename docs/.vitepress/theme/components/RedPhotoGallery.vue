<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ photos: string[]; title: string }>()
const active = ref(0)
const track = ref<HTMLDivElement>()
const preview = ref<HTMLDialogElement>()
const previewOpen = ref(false)

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
    aria-label="文章照片"
    @keydown.left.prevent="goTo(active - 1)"
    @keydown.right.prevent="goTo(active + 1)"
  >
    <div ref="track" class="photo-track" @scroll.passive="updatePosition">
      <button
        v-for="(photo, index) in photos"
        :key="index"
        class="photo-slide"
        type="button"
        :tabindex="index === active ? 0 : -1"
        :aria-label="`预览第 ${index + 1} 张照片`"
        @click="openPreview(index)"
      >
        <img :src="photo" :alt="`${title} · 照片 ${index + 1}`" :loading="index === 0 ? 'eager' : 'lazy'" draggable="false" />
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
        <img v-if="previewOpen" :src="photos[active]" :alt="`${title} · 照片 ${active + 1}`" />
        <button type="button" class="preview-close" aria-label="关闭照片预览" autofocus @click="preview?.close()">×</button>
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
.photo-slide { flex: 0 0 100%; aspect-ratio: 1; scroll-snap-align: start; scroll-snap-stop: always; cursor: zoom-in; }
.photo-slide:focus-visible { outline-offset: -4px; }
.photo-slide img { width: 100%; height: 100%; object-fit: contain; }
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
.photo-preview { position: fixed; inset: 0; margin: auto; padding: 0; max-width: calc(100vw - 24px); max-height: calc(100dvh - 24px); background: transparent; overflow: visible; }
.photo-preview::backdrop { background: rgb(12 12 17 / 90%); }
.photo-preview img { max-height: calc(100dvh - 24px); object-fit: contain; }
.preview-close { top: 8px; right: 8px; width: 44px; height: 44px; font-size: 28px; }

@media (min-width: 960px) {
  .photo-gallery { align-self: start; position: sticky; top: calc(var(--vp-nav-height) + 24px); }
  .photo-slide { max-height: calc(100dvh - var(--vp-nav-height) - 48px); }
  .photo-arrow { display: block; }
}
</style>
