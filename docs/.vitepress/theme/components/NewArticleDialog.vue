<script setup lang="ts" name="NewArticleDialog">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { assembleMarkdown } from '@kongjianguan/markdown-editor/frontmatter'
import '@kongjianguan/markdown-editor/style.css'
import { createGitHubStorage } from '../composables/useGitHubStorage'

const CodeMirrorEditor = defineAsyncComponent(() => import('@kongjianguan/markdown-editor/CodeMirrorEditor'))

interface Photo {
  file: File
  preview: string
  uploaded?: string
  aspectRatio?: number
}

const emit = defineEmits<{
  'update:visible': [value: boolean]
  create: [payload: { path: string; title: string; template: string }]
}>()

const maxPhotos = 9
const maxUploadBytes = 4 * 1024 * 1024
const columns = [
  { directory: '随笔', category: '随笔' },
  { directory: 'Life', category: '生活' },
  { directory: 'programming', category: '编程' },
  { directory: 'Software', category: '软件' },
  { directory: '历程', category: '历程' },
]
const suggestedTags = ['日常', '摄影', '随笔', '旅行', '美食']
const storage = createGitHubStorage({ photoPost: true })
const modal = ref<HTMLDialogElement>()
const mode = ref<'red' | 'article'>('red')
const title = ref('')
const body = ref('')
const column = ref(0)
const tags = ref<string[]>([])
const photos = reactive<Photo[]>([])
const previewIndex = ref<number | null>(null)
const previewDialog = ref<HTMLDialogElement>()
const previewClose = ref<HTMLButtonElement>()
const tallestRatio = computed(() => {
  const ratios = photos.map(photo => photo.aspectRatio).filter((ratio): ratio is number => typeof ratio === 'number' && ratio > 0)
  return ratios.length ? Math.max(0.75, Math.min(...ratios)) : 1
})
const busy = ref(false)
const preparing = ref(false)
const published = ref(false)
const error = ref('')
const selectionNotice = ref('')
const uploadedCount = computed(() => photos.filter(photo => photo.uploaded).length)
const progress = computed(() => {
  if (preparing.value) return '正在处理照片…'
  if (uploadedCount.value < photos.length) return `正在上传照片 ${uploadedCount.value}/${photos.length}`
  return '正在发布…'
})
let publication: { date: string; path: string } | undefined

onMounted(() => modal.value?.showModal())
onBeforeUnmount(() => photos.forEach(photo => URL.revokeObjectURL(photo.preview)))

function getDate(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 19).replace('T', ' ')
}

function selectPhotos(event: Event) {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  const slots = maxPhotos - photos.length
  for (const file of files.slice(0, slots)) {
    const photo = reactive<Photo>({ file, preview: URL.createObjectURL(file) })
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) photo.aspectRatio = image.naturalWidth / image.naturalHeight
    }
    image.src = photo.preview
    photos.push(photo)
  }
  selectionNotice.value = files.length > slots ? `每篇动态最多添加 ${maxPhotos} 张照片` : ''
  error.value = ''
  input.value = ''
}

function removePhoto(index: number) {
  URL.revokeObjectURL(photos[index].preview)
  photos.splice(index, 1)
  selectionNotice.value = ''
  error.value = ''
}

async function openPreview(index: number) {
  previewIndex.value = index
  await nextTick()
  previewDialog.value?.showModal()
}

async function closePreview() {
  previewDialog.value?.close()
  previewIndex.value = null
  await nextTick()
  if (!modal.value?.contains(document.activeElement)) {
    modal.value?.querySelector<HTMLElement>('.compose-thumb-open, .compose-picker input')?.focus()
  }
}

function movePreview(offset: number) {
  if (previewIndex.value === null) return
  const index = previewIndex.value + offset
  if (index >= 0 && index < photos.length) previewIndex.value = index
}

function setCover(index: number) {
  if (index === 0) return
  const [photo] = photos.splice(index, 1)
  photos.unshift(photo)
  previewIndex.value = 0
  previewClose.value?.focus()
}

function deleteCurrent() {
  const index = previewIndex.value
  if (index === null) return
  removePhoto(index)
  if (!photos.length) {
    closePreview()
    return
  }
  previewIndex.value = Math.min(index, photos.length - 1)
}

function toggleTag(tag: string) {
  tags.value = tags.value.includes(tag) ? tags.value.filter(item => item !== tag) : [...tags.value, tag]
}

async function preparePhoto(photo: Photo): Promise<File> {
  const { file, preview } = photo
  if (file.size <= maxUploadBytes && /^image\/(jpeg|png|gif|webp)$/.test(file.type)) return file
  if (file.type === 'image/gif') throw new Error('GIF 超过 4 MB，请选择较小的文件')

  const image = new Image()
  image.src = preview
  await image.decode().catch(() => { throw new Error('浏览器无法读取此格式，请选用 JPEG、PNG、WebP 或 GIF 照片') })
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')!
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob || blob.size > maxUploadBytes) throw new Error('照片转换失败，请选择较小的照片')
  return new File([blob], 'photo.jpg', { type: blob.type })
}

function startArticle() {
  const name = title.value.trim()
  if (!name) return
  const slug = name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 72)
  const { directory, category } = columns[column.value]
  const suffix = crypto.randomUUID().slice(0, 8)
  const template = assembleMarkdown({ title: name, date: getDate(new Date()), categories: [category], tags: [] }, '\n')
  emit('create', { path: `${directory}/${slug ? `${slug}-` : ''}${suffix}.md`, title: name, template })
  modal.value?.close()
}

async function publishPost() {
  if (!photos.length || busy.value) return
  busy.value = true
  error.value = ''
  const text = body.value.trim()
  const firstLine = text.split('\n', 1)[0].replace(/^#{1,6}\s+/, '').trim()
  const name = title.value.trim() || Array.from(firstLine).slice(0, 40).join('') || '图文动态'
  publication ??= {
    date: getDate(new Date()),
    path: `docs/Life/photo-${crypto.randomUUID().slice(0, 12)}.md`,
  }

  try {
    preparing.value = true
    const pending: { index: number; file: File }[] = []
    for (const [index, photo] of photos.entries()) {
      if (photo.uploaded) continue
      try {
        pending.push({ index, file: await preparePhoto(photo) })
      } catch (reason) {
        throw new Error(`第 ${index + 1} 张照片无法处理。${reason instanceof Error ? reason.message : '请重新选择'}`)
      }
    }
    preparing.value = false

    const results = await Promise.allSettled(pending.map(async ({ index, file }) => {
      const url = await storage.uploadImage(file)
      if (!url) throw new Error('上传响应缺少照片地址')
      photos[index].uploaded = url
    }))
    for (const [index, result] of results.entries()) {
      if (result.status === 'fulfilled') continue
      throw new Error(`第 ${pending[index].index + 1} 张照片上传失败。${result.reason instanceof Error ? result.reason.message : '请重试'}`)
    }
    const markdown = assembleMarkdown({
      layout: 'red', title: name, date: publication.date,
      photos: photos.map(photo => photo.uploaded!), categories: ['生活'], tags: tags.value,
    }, text ? `\n${text}\n` : '')
    await storage.createFile(publication.path, markdown, `发布图文动态：${Array.from(name).slice(0, 70).join('')}`)
    published.value = true
    await nextTick()
    modal.value?.querySelector('button')?.focus()
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '发布失败，请重试'
  } finally {
    preparing.value = false
    busy.value = false
  }
}

function dismiss() {
  if (busy.value) return
  if (!published.value && (title.value || body.value || photos.length || tags.value.length) && !window.confirm('放弃这次编辑？')) return
  modal.value?.close()
}
</script>

<template>
  <Teleport to="body">
    <dialog ref="modal" class="compose-dialog" aria-labelledby="compose-title" @cancel.prevent="dismiss" @close="emit('update:visible', false)">
      <section v-if="published" class="compose-success">
        <h2 id="compose-title">发布成功</h2>
        <p>图文动态已提交到 GitHub，网站更新后会出现在首页。</p>
        <button class="compose-primary" type="button" @click="dismiss">完成</button>
      </section>
      <form v-else class="compose-form" @submit.prevent="mode === 'red' ? publishPost() : startArticle()">
        <header class="compose-header">
          <h2 id="compose-title">新建文章</h2>
          <button class="compose-close" type="button" aria-label="取消" :disabled="busy" @click="dismiss">×</button>
        </header>
        <fieldset :disabled="busy" class="compose-fields">
          <div class="compose-modes" role="group" aria-label="文章类型">
            <button type="button" :aria-pressed="mode === 'red'" @click="mode = 'red'">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span>图文动态</span>
            </button>
            <button type="button" :aria-pressed="mode === 'article'" @click="mode = 'article'">
              <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M8 13h8M8 17h8" />
              </svg>
              <span>专栏文章</span>
            </button>
          </div>

          <template v-if="mode === 'red'">
            <div class="photo-label"><span>照片</span><span>{{ photos.length }} / {{ maxPhotos }}</span></div>
            <div class="compose-photos" :class="{ empty: !photos.length }">
              <div v-for="(photo, index) in photos" :key="photo.preview" class="compose-thumb">
                <button class="compose-thumb-open" type="button" :aria-label="`预览第 ${index + 1} 张照片`" @click="openPreview(index)">
                  <img :src="photo.preview" alt="" />
                </button>
                <button class="compose-thumb-remove" type="button" :aria-label="`移除第 ${index + 1} 张照片`" @click.stop="removePhoto(index)"><span aria-hidden="true">×</span></button>
              </div>
              <label v-if="photos.length < maxPhotos" class="compose-picker">
                <input type="file" multiple accept="image/*" aria-label="添加照片" @change="selectPhotos" />
                <svg aria-hidden="true" viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="1.5"/><path d="m21 16-5-5L5 21"/>
                </svg>
                <span>添加照片</span>
              </label>
            </div>
            <p v-if="selectionNotice" class="compose-notice" role="status">{{ selectionNotice }}</p>
          </template>

          <label class="compose-text">
            <span class="compose-sr-only">标题</span>
            <input v-model="title" :placeholder="mode === 'red' ? '添加标题（可选）' : '文章标题'" :required="mode === 'article'" maxlength="200" />
          </label>

          <template v-if="mode === 'red'">
            <div class="compose-editor-wrap">
              <CodeMirrorEditor
                v-model="body"
                class="compose-editor"
                placeholder-text="记录这一刻…"
                aria-label="正文"
                :max-length="10000"
                :auto-focus="false"
                :read-only="busy"
              />
            </div>
            <div class="compose-tags" role="group" aria-label="常用标签">
              <button v-for="tag in suggestedTags" :key="tag" type="button" :aria-pressed="tags.includes(tag)" @click="toggleTag(tag)">#{{ tag }}</button>
            </div>
          </template>
          <label v-else class="compose-column">
            <span>专栏</span>
            <select v-model.number="column">
              <option v-for="(item, index) in columns" :key="item.directory" :value="index">{{ item.category }}</option>
            </select>
          </label>
        </fieldset>

        <footer class="compose-footer">
          <p v-if="error" class="compose-error" role="alert">{{ error }}</p>
          <p v-if="busy" class="compose-notice" role="status">{{ progress }}</p>
          <button class="compose-primary" type="submit" :disabled="busy || (mode === 'red' ? !photos.length : !title.trim())">
            {{ mode === 'red' ? '立即发布' : '开始写作' }}
          </button>
        </footer>
      </form>
    </dialog>
  </Teleport>

  <Teleport to="body">
    <dialog
      v-if="previewIndex !== null"
      ref="previewDialog"
      class="compose-preview"
      aria-label="照片预览"
      @click.self="closePreview"
      @cancel.prevent="closePreview"
      @keydown.left.prevent="movePreview(-1)"
      @keydown.right.prevent="movePreview(1)"
    >
      <div class="compose-preview-actions" role="group" aria-label="照片操作">
        <button type="button" :disabled="previewIndex === 0" @click="setCover(previewIndex)">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
          设为封面
        </button>
        <button type="button" aria-label="删除照片" @click="deleteCurrent">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
          删除
        </button>
        <button ref="previewClose" type="button" aria-label="关闭" autofocus @click="closePreview">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <div class="compose-preview-frame" :style="{ aspectRatio: String(tallestRatio), '--frame-ratio': tallestRatio }">
        <img :src="photos[previewIndex].preview" :alt="`所选照片 ${previewIndex + 1}`" />
      </div>
      <template v-if="photos.length > 1">
        <button class="compose-preview-arrow previous" type="button" aria-label="上一张照片" :aria-disabled="previewIndex === 0" @click="movePreview(-1)">‹</button>
        <button class="compose-preview-arrow next" type="button" aria-label="下一张照片" :aria-disabled="previewIndex === photos.length - 1" @click="movePreview(1)">›</button>
        <div class="compose-preview-dots" role="group" aria-label="选择照片">
          <button
            v-for="(photo, index) in photos"
            :key="photo.preview"
            type="button"
            :aria-label="`查看第 ${index + 1} 张照片`"
            :aria-current="index === previewIndex ? 'true' : undefined"
            @click="previewIndex = index"
          />
        </div>
      </template>
    </dialog>
  </Teleport>
</template>

<style scoped>
.compose-dialog {
  --compose-padding: clamp(16px, 4vw, 30px);
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(510px, calc(100% - 24px));
  max-height: calc(100dvh - 24px);
  padding: 0;
  overflow: auto;
  color: var(--vp-c-text-1);
  background: color-mix(in srgb, var(--vp-c-bg) 92%, transparent);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  box-shadow: 0 18px 80px rgb(23 18 44 / 26%);
  backdrop-filter: blur(24px);
}
.compose-dialog[open] { animation: compose-in 180ms ease-out; }
.compose-dialog::backdrop { background: rgb(25 21 36 / 42%); }
.compose-form, .compose-success { padding: var(--compose-padding); }
.compose-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.compose-dialog h2 { font-size: 24px; line-height: 1.2; font-weight: 720; }
.compose-close { width: 44px; height: 44px; border-radius: 50%; font-size: 26px; color: var(--vp-c-text-2); }
.compose-close:hover { background: var(--vp-c-bg-soft); }
.compose-fields { min-inline-size: 0; display: grid; gap: 14px; margin: 0; padding: 0; border: 0; }
.compose-modes { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; gap: 4px; border-radius: 12px; background: var(--vp-c-bg-soft); }
.compose-modes button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; border-radius: 9px; font-size: 14px; font-weight: 620; color: var(--vp-c-text-2); }
.compose-modes svg { flex-shrink: 0; }
.compose-modes button[aria-pressed='true'] { background: var(--vp-c-bg); color: var(--vp-c-brand-1); box-shadow: 0 2px 10px rgb(0 0 0 / 8%); }
.photo-label { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; color: var(--vp-c-text-2); }
.compose-photos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.compose-photos.empty { grid-template-columns: 1fr; }
.compose-thumb, .compose-picker { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: var(--vp-c-bg-soft); }
.compose-thumb-open { position: absolute; inset: 0; cursor: zoom-in; }
.compose-thumb-open:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -3px; }
.compose-thumb img { width: 100%; height: 100%; object-fit: cover; }
.compose-thumb-remove { position: absolute; top: 0; right: 0; display: grid; place-items: center; width: 44px; height: 44px; }
.compose-thumb-remove span { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: rgb(20 20 24 / 76%); color: white; font-size: 19px; }
.compose-picker { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 1px dashed var(--vp-c-brand-1); color: var(--vp-c-brand-1); font-size: 13px; cursor: pointer; }
.compose-picker:hover { background: var(--vp-c-brand-soft); }
.compose-picker:focus-within { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.compose-photos.empty .compose-picker { min-height: 104px; aspect-ratio: auto; }
.compose-picker input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.compose-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.compose-text input { display: block; width: 100%; padding: 7px 0; font-size: 20px; font-weight: 670; border: 0; border-radius: 0; background: transparent; color: var(--vp-c-text-1); }
.compose-text input:focus { outline: none; box-shadow: 0 1px var(--vp-c-brand-1); }
.compose-text input::placeholder { color: var(--vp-c-text-2); }
.compose-editor-wrap { width: 100%; min-width: 0; min-height: 90px; border-radius: 4px; }
.compose-editor { width: 100%; }
.compose-editor :deep(.cm-editor) { background: transparent; }
.compose-editor :deep(.cm-scroller) {
  min-height: 90px;
  max-height: 38dvh;
  overflow-y: auto;
  line-height: 1.65;
  padding: 0;
}
.compose-editor :deep(.cm-content) { padding: 6px 0 12px !important; caret-color: var(--vp-c-brand-1); }
.compose-editor :deep(.cm-line) { padding: 0; }
.compose-editor:focus-within { box-shadow: 0 1px var(--vp-c-brand-1); }
.compose-tags { display: flex; flex-wrap: wrap; gap: 4px 8px; }
.compose-tags button { min-height: 40px; border-radius: 999px; padding: 0 12px; background: var(--vp-c-bg-soft); font-size: 13px; color: var(--vp-c-text-2); }
.compose-tags button[aria-pressed='true'] { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); box-shadow: inset 0 0 0 1px var(--vp-c-brand-1); }
.compose-column { display: flex; align-items: center; gap: 14px; font-size: 14px; color: var(--vp-c-text-2); }
.compose-column select { flex: 1; min-height: 44px; appearance: auto; padding: 0 10px; border-radius: 9px; background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.compose-footer { display: grid; justify-items: end; gap: 8px; margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--vp-c-divider); }
.compose-primary { min-height: 44px; padding: 0 20px; border-radius: 999px; background: linear-gradient(135deg, var(--vp-button-brand-bg), var(--vp-button-brand-hover-bg)); color: var(--vp-button-brand-text); font-size: 14px; font-weight: 650; }
.compose-primary:disabled { opacity: .55; cursor: default; }
.compose-primary:not(:disabled):hover { filter: brightness(1.1); }
.compose-error, .compose-notice { width: 100%; font-size: 13px; }
.compose-error { color: var(--vp-c-danger-1); }
.compose-notice { color: var(--vp-c-text-2); }
.compose-success p { margin-block: 12px 22px; color: var(--vp-c-text-2); }

.compose-preview {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: white;
  overflow: hidden;
}
.compose-preview[open] { display: grid; place-items: center; }
.compose-preview::backdrop { background: #0c0c10; }
.compose-preview-frame { width: min(calc(100vw - 32px), calc((100dvh - 120px) * var(--frame-ratio))); }
.compose-preview-frame img { width: 100%; height: 100%; object-fit: contain; }
.compose-preview-actions { position: absolute; top: 8px; right: 16px; display: flex; gap: 4px; }
.compose-preview-actions button, .compose-preview-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 14px;
}
.compose-preview button:focus-visible { outline: 2px solid white; outline-offset: -2px; }
.compose-preview button:disabled, .compose-preview button[aria-disabled='true'] { opacity: .38; cursor: default; }
.compose-preview-actions button:not(:disabled):hover { background: rgb(255 255 255 / 14%); }
.compose-preview-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgb(20 20 24 / 76%); font-size: 30px; }
.compose-preview-arrow.previous { left: 8px; }
.compose-preview-arrow.next { right: 8px; }
.compose-preview-dots { position: absolute; bottom: 8px; display: flex; }
.compose-preview-dots button { display: grid; width: 28px; height: 44px; place-items: center; }
.compose-preview-dots button::before { content: ''; width: 6px; height: 6px; border-radius: 999px; background: rgb(255 255 255 / 52%); }
.compose-preview-dots button[aria-current]::before { width: 14px; background: white; }

@keyframes compose-in { from { opacity: 0; transform: translateY(7px); } }
@media (max-width: 599px) {
  .compose-dialog { inset: auto 0 0; width: 100%; max-width: 100%; max-height: calc(100dvh - 12px); border-radius: 16px 16px 0 0; padding-bottom: env(safe-area-inset-bottom); }
  .compose-primary { width: 100%; }
}
@media (prefers-reduced-motion: reduce) { .compose-dialog[open] { animation: none; } }
</style>
