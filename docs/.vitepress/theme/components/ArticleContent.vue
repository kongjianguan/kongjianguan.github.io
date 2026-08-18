<script setup lang="ts" name="ArticleContent">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'
import { useGitHubAuth } from '../composables/useGitHubAuth'
import { useEditMode } from '../composables/useEditMode'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import LoginButton from './LoginButton.vue'
import { defineAsyncComponent } from 'vue'

const CodeMirrorEditor = defineAsyncComponent(() => import('./CodeMirrorEditor.vue'))

const { page } = useData()
const route = useRoute()
const { isLoggedIn } = useGitHubAuth()
const {
  isEditing, filePath, content, frontmatter,
  isDirty, isSaving, saveError, loadError, frontmatterError, isNewFile, newFileConflict,
  initEditor, updateContent, updateFrontmatter, saveDraft, commit
} = useEditMode()

const showCommitDialog = ref(false)
const fmCollapsed = ref(false)

function readEditParam(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('edit') === 'true'
}

const articleTitle = computed(() => {
  return (frontmatter.value?.title || page.value?.title || '') as string
})

function getPendingNewArticle(): { path: string; template: string; created?: boolean } | null {
  if (typeof window === 'undefined') return null
  if (new URLSearchParams(window.location.search).get('new') !== 'true') return null

  try {
    const raw = sessionStorage.getItem('pending_new_article')
    if (!raw) return null
    const payload = JSON.parse(raw)
    if (typeof payload.path !== 'string' || typeof payload.template !== 'string') return null
    return {
      path: payload.path,
      template: payload.template,
      created: payload.created === true,
    }
  } catch {
    return null
  }
}

function getFilePathFromPage(): string {
  const pending = getPendingNewArticle()
  if (pending) return pending.path

  const fp = (page.value as any).filePath
  if (fp) return `docs/${fp}`
  const rel = page.value.relativePath
  return rel ? `docs/${rel}` : ''
}

async function startEditing(): Promise<void> {
  const pending = getPendingNewArticle()
  const path = getFilePathFromPage() || 'docs/index.md'
  await initEditor(path, pending?.template || '', {
    expectNew: Boolean(pending && !pending.created),
  })
}

const pageIdentity = computed(() => {
  const data = page.value as any
  return `${route.path}|${data?.filePath || data?.relativePath || ''}`
})

async function syncEditorWithLocation(): Promise<void> {
  const editing = readEditParam()
  if (!editing) {
    if (isEditing.value && isDirty.value) saveDraft()
    showCommitDialog.value = false
    isEditing.value = false
    return
  }

  await nextTick()
  const nextPath = getFilePathFromPage() || 'docs/index.md'
  if (isEditing.value && filePath.value === nextPath) return
  if (isEditing.value && isDirty.value) saveDraft()
  await startEditing()
}

watch(pageIdentity, () => { void syncEditorWithLocation() }, { immediate: true })

watch(isEditing, (editing) => {
  if (typeof document === 'undefined') return
  document.querySelectorAll('.vp-doc').forEach(el => {
    el.classList.toggle('edit-mode-hidden', editing)
  })
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isDirty.value) {
    saveDraft()
    e.preventDefault()
    e.returnValue = ''
  }
}

function handlePopState() {
  void syncEditorWithLocation()
}

onMounted(async () => {
  void syncEditorWithLocation()
  if (isEditing.value) {
    await nextTick()
    document.querySelectorAll('.vp-doc').forEach(el => el.classList.add('edit-mode-hidden'))
  }
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

function handleExitEdit() {
  if (isDirty.value) {
    if (!confirm('有未保存的修改，确定退出吗？')) return
    saveDraft()
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('edit')
  url.searchParams.delete('new')
  sessionStorage.removeItem('pending_new_article')
  window.location.assign(url.pathname + url.search + url.hash)
}

async function handleCommit({ message }: { message: string }) {
  const wasNewFile = isNewFile.value
  const committedPath = filePath.value
  const ok = await commit(message)
  if (!ok) {
    alert(saveError.value || '提交失败')
    return
  }

  if (wasNewFile && typeof window !== 'undefined') {
    const pending = getPendingNewArticle()
    if (pending?.path === committedPath) {
      sessionStorage.setItem('pending_new_article', JSON.stringify({
        ...pending,
        created: true,
      }))
    }
  }
  showCommitDialog.value = false
}

</script>

<template>
  <div v-if="isEditing" class="editor-container">
    <EditorToolbar
      :file-path="filePath"
      :title="articleTitle"
      :is-dirty="isDirty"
      :is-saving="isSaving"
      :is-logged-in="isLoggedIn"
      :is-new-file="isNewFile"
      :can-commit="!newFileConflict"
      @save-draft="saveDraft"
      @commit="showCommitDialog = true"
      @exit-edit="handleExitEdit"
    />

    <div v-if="!isLoggedIn" class="login-banner">
      <LoginButton />
      <span>登录后可提交文章，草稿可先保存在本机</span>
    </div>

    <div v-if="loadError" class="editor-error">{{ loadError }}</div>
    <div v-if="frontmatterError" class="editor-error">
      {{ frontmatterError }}，请直接编辑文章头部后再提交。
    </div>

    <FrontmatterPanel
      v-if="isLoggedIn && !frontmatterError"
      :frontmatter="frontmatter"
      @update:frontmatter="updateFrontmatter"
      v-model:collapsed="fmCollapsed"
    />

    <CodeMirrorEditor
      :model-value="content"
      @update:model-value="updateContent"
    />

    <CommitDialog
      v-model:visible="showCommitDialog"
      :is-new-file="isNewFile"
      :is-saving="isSaving"
      @confirm="handleCommit"
    />
  </div>
</template>

<style>
.edit-mode-hidden {
  display: none !important;
}

.editor-container {
  max-width: 744px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

.login-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.editor-error {
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 767px) {
  .editor-container {
    padding: 0 12px 32px;
  }
}
</style>
