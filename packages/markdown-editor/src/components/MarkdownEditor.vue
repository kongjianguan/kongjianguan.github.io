<script setup lang="ts" name="MarkdownEditor">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import { createEditSession } from '../composables/useEditMode'
import { createDraftStore } from '../composables/useDrafts'
import { createPendingImages } from '../composables/usePendingImages'
import type { EditorStorage } from '../types'
import { parseFrontmatter } from '../frontmatter'

// CodeMirror 及其语言包体积可观，且只在进入编辑模式后才需要，因此按需加载。
const CodeMirrorEditor = defineAsyncComponent(() => import('./CodeMirrorEditor.vue'))

const props = withDefaults(defineProps<{
  storage: EditorStorage
  active: boolean
  filePath: string
  fallbackContent?: string
  isLoggedIn?: boolean
  expectNew?: boolean
  standalone?: boolean
  notify?: (message: string) => void
  confirmAction?: (message: string) => boolean
  draftKeyPrefix?: string
  emptyPathLabel?: string
  labels?: Record<string, any>
}>(), {
  fallbackContent: '',
  isLoggedIn: false,
  expectNew: false,
  standalone: false,
})

const emit = defineEmits<{
  exit: []
  saved: []
  'content-change': [value: string]
}>()

defineSlots<{
  login?: () => unknown
  media?: (props: { frontmatter: Record<string, unknown>; title: string }) => unknown
  author?: (props: { frontmatter: Record<string, unknown> }) => unknown
}>()

const notify = (message: string) => {
  if (props.notify) props.notify(message)
  else if (typeof window !== 'undefined') window.alert(message)
}

const confirmAction = (message: string) => {
  if (props.confirmAction) return props.confirmAction(message)
  if (typeof window !== 'undefined') return window.confirm(message)
  return true
}

const session = createEditSession({
  storage: props.storage,
  draftStore: createDraftStore(
    props.draftKeyPrefix ? { keyPrefix: props.draftKeyPrefix } : {},
  ),
  confirmAction,
})

const {
  isEditing, filePath, content, bodyContent, frontmatter, draftImages, remoteSha,
  isDirty, isSaving, saveError, loadError, frontmatterError, isNewFile, newFileConflict,
  initEditor, updateBody, updateContent, updateFrontmatter, saveDraft, commit, getGeneration, finishEditing,
} = session

/*
 * 编辑态直接编辑正文，属性块由属性面板维护，因此这里只暴露正文给编辑器。
 */
const images = createPendingImages({
  uploadImage: (file: File) => props.storage.uploadImage(file),
})

const showCommitDialog = ref(false)
const fmCollapsed = ref(true)
const titleInputRef = ref<HTMLTextAreaElement>()
const bodyEditorRef = ref<{ focus: () => void }>()
const isPreparingCommit = ref(false)
const initialSelection = ref(0)
/*
 * 编辑器在内容取回之后再挂载：否则它会先以空文档创建，
 * 光标停在位置 0，内容载入后正好落在第一个标题行内，把该行标记显示出来。
 */
const contentLoaded = ref(false)
const draftSaved = ref(false)
const draftError = ref('')
const repairingFrontmatter = ref(false)
let draftSaveTimer: ReturnType<typeof setTimeout> | undefined

const inlineTitle = computed(() => String(frontmatter.value.title ?? ''))
const documentDate = computed(() => {
  const value = frontmatter.value.date
  return typeof value === 'string' ? value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? value : ''
})
const primaryCategory = computed(() => metadataList(frontmatter.value.categories)[0])
const currentTags = computed(() => [...new Set(metadataList(frontmatter.value.tags))])

function metadataList(value: unknown): string[] {
  const entries = typeof value === 'string' ? value.split(',') : Array.isArray(value) ? value : []
  return entries.filter((entry): entry is string => typeof entry === 'string')
    .map(entry => entry.trim())
    .filter(Boolean)
}

function resizeInlineTitle(): void {
  const input = titleInputRef.value
  if (!input) return
  input.style.height = 'auto'
  input.style.height = `${input.scrollHeight}px`
}

function handleInlineTitleInput(event: Event): void {
  const input = event.target as HTMLTextAreaElement
  void handleFrontmatterUpdate({ ...frontmatter.value, title: input.value })
}

function focusBodyEditor(event: KeyboardEvent): void {
  if (event.isComposing) return
  event.preventDefault()
  bodyEditorRef.value?.focus()
}

async function saveEditorDraft(withNotice = true): Promise<boolean | 'changed'> {
  const path = filePath.value
  const generation = getGeneration()
  const snapshot = content.value
  const metadata = parseFrontmatter(snapshot).frontmatter
  const sha = remoteSha.value
  try {
    const portable = await images.prepareDraft(snapshot)
    await saveDraft(portable.content, portable.files, path, metadata, sha)
    const stillCurrent = getGeneration() === generation && filePath.value === path && content.value === snapshot
    if (stillCurrent) {
      draftSaved.value = isDirty.value
      draftError.value = ''
    }
    return stillCurrent ? true : 'changed'
  } catch (error) {
    if (generation === getGeneration()) {
      draftSaved.value = false
      draftError.value = error instanceof Error ? error.message : '本机草稿保存失败'
      if (withNotice) notify(draftError.value)
    }
    return false
  }
}

async function startEditing(): Promise<void> {
  clearTimeout(draftSaveTimer)
  contentLoaded.value = false
  draftSaved.value = false
  draftError.value = ''
  isPreparingCommit.value = false
  const loading = initEditor(props.filePath, props.fallbackContent, { expectNew: props.expectNew })
  const generation = getGeneration()
  await loading
  if (generation !== getGeneration() || !isEditing.value) return
  const restoredContent = await images.restoreDraft(content.value, draftImages.value)
  if (generation !== getGeneration() || !isEditing.value) return
  if (restoredContent !== content.value) updateContent(restoredContent)
  repairingFrontmatter.value = Boolean(frontmatterError.value)
  // 打开编辑态时停在文首，与阅读文章时从开头看起的习惯一致
  initialSelection.value = 0
  await nextTick()
  if (generation !== getGeneration() || !isEditing.value) return
  contentLoaded.value = true
}

async function handleFrontmatterUpdate(nextFrontmatter: Record<string, any>): Promise<void> {
  updateFrontmatter(nextFrontmatter)
}

async function openCommitDialog(): Promise<void> {
  showCommitDialog.value = true
}

async function handleExitEdit(): Promise<void> {
  const generation = getGeneration()
  if (isDirty.value && !confirmAction('有未保存的修改，确定退出吗？')) return
  if (contentLoaded.value) {
    let savedCurrentContent = false
    while (!savedCurrentContent) {
      const result = await saveEditorDraft()
      if (generation !== getGeneration()) return
      if (result === false) return
      savedCurrentContent = result === true
    }
  }
  clearTimeout(draftSaveTimer)
  if (generation !== getGeneration()) return
  images.release()
  finishEditing()
  emit('exit')
}

async function prepareRouteChange(): Promise<boolean> {
  const generation = getGeneration()
  if (!isDirty.value) return true
  if (!confirmAction('有未保存的修改，确定离开当前文章吗？')) return false
  let savedCurrentContent = false
  while (!savedCurrentContent) {
    const result = await saveEditorDraft()
    if (generation !== getGeneration()) return false
    if (result === false) return false
    savedCurrentContent = result === true
  }
  return true
}

async function handleCommit({ message }: { message: string }): Promise<void> {
  if (isPreparingCommit.value) return
  isPreparingCommit.value = true
  const submittedPath = filePath.value
  const submittedGeneration = getGeneration()
  try {
    // 图片的本机地址只出现在正文，提交前替换为远程地址。
    let submittedContent: string
    while (true) {
      if (filePath.value !== submittedPath || getGeneration() !== submittedGeneration) return
      const currentContent = content.value
      const currentBody = bodyContent.value
      const uploadedBody = await images.uploadAll(currentBody)
      if (filePath.value !== submittedPath || getGeneration() !== submittedGeneration) return
      if (content.value !== currentContent) continue
      if (uploadedBody !== currentBody) updateBody(uploadedBody)
      submittedContent = content.value
      break
    }

    const ok = await commit(message, submittedContent)
    if (filePath.value !== submittedPath || getGeneration() !== submittedGeneration) return
    if (!ok) {
      await saveEditorDraft(false)
      notify(saveError.value || '提交失败')
      return
    }

    clearTimeout(draftSaveTimer)
    if (isDirty.value) await saveEditorDraft(false)
    if (filePath.value !== submittedPath || getGeneration() !== submittedGeneration) return
    images.releaseUnused(content.value)
    showCommitDialog.value = false
    emit('saved')
  } catch (error) {
    if (getGeneration() !== submittedGeneration) return
    await saveEditorDraft(false)
    notify(error instanceof Error ? error.message : '图片上传失败')
  } finally {
    if (filePath.value === submittedPath && getGeneration() === submittedGeneration) {
      isPreparingCommit.value = false
    }
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (isDirty.value) {
    saveEditorDraft(false)
    event.preventDefault()
    event.returnValue = ''
  }
}

watch(
  () => [props.active, props.filePath, props.standalone] as const,
  async ([active], previous) => {
    if (!active) {
      clearTimeout(draftSaveTimer)
      if (isEditing.value && isDirty.value) saveEditorDraft(false)
      images.release()
      showCommitDialog.value = false
      finishEditing()
      return
    }

    const pathChanged = previous !== undefined && previous[1] !== props.filePath
    if (isEditing.value && !pathChanged) return
    if (isEditing.value && isDirty.value) saveEditorDraft(false)
    images.release()
    await startEditing()
  },
  { immediate: true },
)

watch(content, (value) => emit('content-change', value))
watch(content, () => {
  draftSaved.value = false
  clearTimeout(draftSaveTimer)
  if (!contentLoaded.value || !isEditing.value) return
  draftSaveTimer = setTimeout(() => { void saveEditorDraft(false) }, 400)
})

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

watch([titleInputRef, inlineTitle], resizeInlineTitle, { flush: 'post' })

watch(titleInputRef, (input, _previous, onCleanup) => {
  if (!input) return
  let width = input.clientWidth
  const observer = new ResizeObserver(() => {
    if (input.clientWidth === width) return
    width = input.clientWidth
    resizeInlineTitle()
  })
  observer.observe(input)
  onCleanup(() => observer.disconnect())
}, { flush: 'post' })

onBeforeUnmount(() => {
  clearTimeout(draftSaveTimer)
  if (isEditing.value && contentLoaded.value) saveEditorDraft(false)
  finishEditing()
  window.removeEventListener('beforeunload', handleBeforeUnload)
  images.release()
})

defineExpose({
  filePath,
  content,
  isEditing,
  isDirty,
  startEditing,
  requestCommit: openCommitDialog,
  requestExit: handleExitEdit,
  prepareRouteChange,
})
</script>

<template>
  <div v-if="isEditing" class="editor-controls" :class="{ 'mde-media-editor': $slots.media }">
    <EditorToolbar
      :file-path="filePath"
      :is-dirty="isDirty"
      :is-saving="isSaving || isPreparingCommit"
      :draft-saved="draftSaved"
      :is-logged-in="isLoggedIn"
      :is-new-file="isNewFile"
      :can-commit="contentLoaded && !newFileConflict"
      :empty-path-label="emptyPathLabel"
      @save-draft="saveEditorDraft"
      @commit="openCommitDialog"
      @exit-edit="handleExitEdit"
    />

    <div v-if="!isLoggedIn" class="login-banner">
      <slot name="login" />
      <span>{{ labels?.loginHint || '登录后可提交文章，草稿可先保存在本机' }}</span>
    </div>

    <div v-if="loadError" class="editor-error">{{ loadError }}</div>
    <p v-if="!contentLoaded" role="status">正在载入文章…</p>
    <div v-if="draftError" class="editor-error" role="alert">{{ draftError }}</div>
    <div v-if="frontmatterError" class="editor-error">
      {{ frontmatterError }}{{ labels?.frontmatterErrorSuffix || '，请修改文章属性后再提交。' }}
    </div>

    <textarea
      v-if="repairingFrontmatter"
      class="mde-invalid-frontmatter"
      :value="content"
      aria-label="修复文章属性 YAML"
      @input="updateContent(($event.target as HTMLTextAreaElement).value)"
    />
    <button
      v-if="repairingFrontmatter"
      :disabled="Boolean(frontmatterError)"
      @click="repairingFrontmatter = false"
    >应用文章属性修复</button>

    <div v-if="contentLoaded && !repairingFrontmatter" class="mde-editor-body" :class="{ 'with-media': $slots.media }">
      <div v-if="$slots.media" class="mde-media">
        <slot name="media" :frontmatter="frontmatter" :title="inlineTitle" />
      </div>
      <div class="mde-doc-copy">
        <div class="mde-doc-header">
          <textarea
            ref="titleInputRef"
            class="mde-inline-title"
            :value="inlineTitle"
            aria-label="文章标题"
            placeholder="无标题文章"
            rows="1"
            @input="handleInlineTitleInput"
            @keydown.enter="focusBodyEditor"
          />
          <div class="mde-doc-meta">
            <span v-if="$slots.media && $slots.author" class="mde-doc-author">
              <slot name="author" :frontmatter="frontmatter" />
            </span>
            <time v-if="documentDate" class="mde-doc-date" :datetime="documentDate">{{ documentDate }}</time>
            <template v-if="!$slots.media">
              <span v-if="primaryCategory" class="mde-doc-category">{{ primaryCategory }}</span>
              <span v-for="tag in currentTags" :key="tag" class="mde-doc-tag">#{{ tag }}</span>
            </template>
            <button
              v-if="isLoggedIn"
              type="button"
              class="mde-properties-btn"
              :aria-expanded="!fmCollapsed"
              @click="fmCollapsed = !fmCollapsed"
            >
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path d="M4 6h12M4 10h12M4 14h8" />
              </svg>
              {{ labels?.frontmatter?.toggle ?? '文章属性' }}
            </button>
          </div>
          <FrontmatterPanel
            v-if="isLoggedIn && !fmCollapsed"
            :frontmatter="frontmatter"
            :show-photos="Boolean($slots.media)"
            :labels="labels?.frontmatter"
            :placeholders="labels?.placeholders"
            @update:frontmatter="handleFrontmatterUpdate"
          />
        </div>
        <CodeMirrorEditor
          ref="bodyEditorRef"
          :model-value="bodyContent"
          :initial-selection="initialSelection"
          :auto-focus="!$slots.media"
          :stage-image="images.stage"
          :on-image-error="notify"
          :on-save="() => saveEditorDraft()"
          :placeholder-text="labels?.placeholder || '开始写作…'"
          @update:model-value="updateBody"
        />
        <ul v-if="$slots.media && currentTags.length" class="mde-doc-tags" aria-label="标签">
          <li v-for="tag in currentTags" :key="tag">#{{ tag }}</li>
        </ul>
      </div>
    </div>

    <CommitDialog
      v-model:visible="showCommitDialog"
      :is-new-file="isNewFile"
      :is-saving="isSaving || isPreparingCommit"
      :title="labels?.commitTitle"
      :hint="labels?.commitHint"
      :new-file-message="labels?.newFileMessage"
      :update-message="labels?.updateMessage"
      @confirm="handleCommit"
    />
  </div>
</template>

<style scoped>
.editor-controls.mde-media-editor {
  max-width: none;
  padding: 0;
}

.mde-media-editor > :not(.mde-editor-body) {
  width: min(680px, calc(100% - 24px));
  margin-inline: auto;
}

.mde-editor-body.with-media {
  width: min(680px, calc(100% - 24px));
  margin: 20px auto 48px;
  border: 1px solid var(--mde-divider);
  border-radius: 16px;
  background: var(--mde-bg);
  box-shadow: 0 12px 48px rgb(78 66 95 / 10%);
  overflow: clip;
}

.mde-media {
  min-width: 0;
}

.mde-media:empty,
.mde-doc-author:empty {
  display: none;
}

.with-media .mde-doc-copy {
  min-width: 0;
  padding: clamp(20px, 2.5vw, 36px);
  overflow-wrap: anywhere;
}

.with-media .mde-doc-header {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.with-media .mde-doc-meta {
  order: -1;
  gap: 0 14px;
  margin: 0;
  line-height: 24px;
}

.mde-doc-author {
  color: var(--mde-text-1);
  font-weight: 650;
}

.with-media .mde-properties-btn {
  min-height: 24px;
  padding-block: 0;
}

.with-media .mde-inline-title {
  margin: 12px 0 16px;
  font-size: clamp(22px, 2.2vw, 32px);
  line-height: 1.28;
  text-wrap: pretty;
  word-break: normal;
  overflow-wrap: break-word;
}

.with-media .mde-live-editor :deep(.cm-scroller) {
  padding: 0;
  line-height: 28px;
}

.with-media .mde-live-editor :deep(.cm-content) {
  padding: 0;
}

.with-media .mde-live-editor :deep(.cm-line:not(.mde-quote)) {
  padding-inline: 0;
}

.with-media .mde-live-editor :deep(.mde-paragraph-gap) {
  line-height: 16px;
}

.with-media .mde-live-editor :deep(.cm-line:is(:first-child, :last-child):not(:only-child):has(> br:only-child)) {
  line-height: 1px;
}

.mde-doc-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.mde-doc-tags li {
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--mde-brand-soft);
  color: var(--mde-brand);
  font-size: 13px;
}

@media (min-width: 960px) {
  .mde-media-editor > :not(.mde-editor-body),
  .mde-editor-body.with-media:has(> .mde-media > *) {
    width: min(1180px, calc(100% - 64px));
  }

  .mde-editor-body.with-media {
    margin-top: 28px;
  }

  .mde-editor-body.with-media:has(> .mde-media > *) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.mde-invalid-frontmatter {
  width: 100%;
  min-height: 12rem;
  margin: 0 0 12px;
  padding: 10px;
  border: 1px solid var(--mde-divider);
  border-radius: 6px;
  background: var(--mde-bg);
  color: var(--mde-text-1);
  font: 13px/1.6 monospace;
  resize: vertical;
}
</style>
