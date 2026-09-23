<script setup lang="ts" name="MarkdownEditor">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import { createEditSession } from '../composables/useEditMode'
import { createDraftStore } from '../composables/useDrafts'
import { createPendingImages } from '../composables/usePendingImages'
import type { EditorStorage } from '../types'

// CodeMirror 及其语言包体积可观，且只在进入编辑模式后才需要，因此按需加载。
const CodeMirrorEditor = defineAsyncComponent(() => import('./CodeMirrorEditor.vue'))

const props = withDefaults(defineProps<{
  storage: EditorStorage
  active: boolean
  filePath: string
  fallbackContent?: string
  title?: string
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
  title: '',
  isLoggedIn: false,
  expectNew: false,
  standalone: false,
})

const emit = defineEmits<{
  exit: []
  saved: []
  'content-change': [value: string]
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
  isEditing, filePath, content, bodyContent, frontmatter,
  isDirty, isSaving, saveError, loadError, frontmatterError, isNewFile, newFileConflict,
  initEditor, updateBody, updateFrontmatter, saveDraft, commit,
} = session

/*
 * 编辑态直接编辑正文，属性块由属性面板维护，因此这里只暴露正文给编辑器。
 */
const images = createPendingImages({
  uploadImage: (file: File) => props.storage.uploadImage(file),
})

const showCommitDialog = ref(false)
const fmCollapsed = ref(false)
const isPreparingCommit = ref(false)
const initialSelection = ref(0)
/*
 * 编辑器在内容取回之后再挂载：否则它会先以空文档创建，
 * 光标停在位置 0，内容载入后正好落在第一个标题行内，把该行标记显示出来。
 */
const contentLoaded = ref(false)

const articleTitle = computed(() => (frontmatter.value?.title as string) || props.title || '')

function saveEditorDraft(withNotice = true): void {
  if (images.hasReferences(content.value)) {
    if (withNotice) {
      notify('当前内容包含尚未提交的图片，暂时不能保存为本机草稿。请提交文章，或移除图片后再保存。')
    }
    return
  }
  saveDraft()
}

async function startEditing(): Promise<void> {
  contentLoaded.value = false
  await initEditor(props.filePath, props.fallbackContent, { expectNew: props.expectNew })
  // 打开编辑态时停在文首，与阅读文章时从开头看起的习惯一致
  initialSelection.value = 0
  await nextTick()
  contentLoaded.value = true
}

async function handleFrontmatterUpdate(nextFrontmatter: Record<string, any>): Promise<void> {
  updateFrontmatter(nextFrontmatter)
}

async function openCommitDialog(): Promise<void> {
  showCommitDialog.value = true
}

async function handleExitEdit(): Promise<void> {
  if (isDirty.value) {
    if (!confirmAction('有未保存的修改，确定退出吗？')) return
    saveEditorDraft(false)
  }
  images.release()
  isEditing.value = false
  emit('exit')
}

async function handleCommit({ message }: { message: string }): Promise<void> {
  if (isPreparingCommit.value) return
  isPreparingCommit.value = true
  try {
    // 图片的本机地址只出现在正文，提交前替换为远程地址。
    const uploadedBody = await images.uploadAll(bodyContent.value)
    if (uploadedBody !== bodyContent.value) updateBody(uploadedBody)

    const ok = await commit(message)
    if (!ok) {
      notify(saveError.value || '提交失败')
      return
    }

    images.release()
    showCommitDialog.value = false
    emit('saved')
  } catch (error) {
    notify(error instanceof Error ? error.message : '图片上传失败')
  } finally {
    isPreparingCommit.value = false
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
      if (isEditing.value && isDirty.value) saveEditorDraft(false)
      images.release()
      showCommitDialog.value = false
      isEditing.value = false
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

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
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
})
</script>

<template>
  <div v-if="isEditing" class="editor-controls">
    <EditorToolbar
      :file-path="filePath"
      :title="articleTitle"
      :is-dirty="isDirty"
      :is-saving="isSaving || isPreparingCommit"
      :is-logged-in="isLoggedIn"
      :is-new-file="isNewFile"
      :can-commit="!newFileConflict"
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
    <div v-if="frontmatterError" class="editor-error">
      {{ frontmatterError }}{{ labels?.frontmatterErrorSuffix || '，请修改文章属性后再提交。' }}
    </div>

    <FrontmatterPanel
      v-if="isLoggedIn && !frontmatterError"
      :frontmatter="frontmatter"
      :labels="labels?.frontmatter"
      :placeholders="labels?.placeholders"
      @update:frontmatter="handleFrontmatterUpdate"
      v-model:collapsed="fmCollapsed"
    />

    <div class="mde-editor-body">
      <CodeMirrorEditor
        v-if="contentLoaded"
        :model-value="bodyContent"
        :initial-selection="initialSelection"
        :stage-image="images.stage"
        :on-image-error="notify"
        :on-save="() => saveEditorDraft()"
        :placeholder-text="labels?.placeholder || '开始写作…'"
        @update:model-value="updateBody"
      />
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
