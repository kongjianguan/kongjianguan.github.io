<script setup lang="ts" name="ArticleContent">
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter, useData } from 'vitepress'
import { useGitHubAuth } from '../composables/useGitHubAuth'
import { useEditMode } from '../composables/useEditMode'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import LoginButton from './LoginButton.vue'
import { defineAsyncComponent } from 'vue'

const CodeMirrorEditor = defineAsyncComponent(() => import('./CodeMirrorEditor.vue'))

const route = useRoute()
const router = useRouter()
const { page } = useData()
const { isLoggedIn } = useGitHubAuth()
const {
  isEditing, filePath, content, frontmatter, remoteSha,
  isDirty, isSaving, saveError, isNewFile,
  initEditor, updateContent, updateFrontmatter, saveDraft, commit
} = useEditMode()

const showCommitDialog = ref(false)
const fmCollapsed = ref(false)

const editParam = computed(() => {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('edit') === 'true'
})

const articleTitle = computed(() => {
  return (frontmatter.value?.title || page.value?.title || '') as string
})

function getFilePathFromPage(): string {
  const fp = (page.value as any).filePath
  if (fp) return `docs/${fp}`
  const rel = page.value.relativePath
  return rel ? `docs/${rel}` : ''
}

watch(editParam, async (editing) => {
  if (editing) {
    const path = getFilePathFromPage() || 'docs/index.md'
    await initEditor(path, '')
  } else {
    isEditing.value = false
  }
}, { immediate: true })

watch(isEditing, (editing) => {
  document.querySelectorAll('.vp-doc').forEach(el => {
    el.classList.toggle('edit-mode-hidden', editing)
  })
})

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('code')) {
    const { handleCallback } = useGitHubAuth()
    await handleCallback()
  }
  if (isEditing.value) {
    await nextTick()
    document.querySelectorAll('.vp-doc').forEach(el => el.classList.add('edit-mode-hidden'))
  }
})

function handleExitEdit() {
  if (isDirty.value) {
    if (!confirm('有未保存的修改，确定退出吗？')) return
  }
  const url = new URL(window.location.href)
  url.searchParams.delete('edit')
  router.go(url.pathname + url.search)
}

async function handleCommit({ message }: { message: string }) {
  const ok = await commit(message)
  if (!ok) {
    alert(saveError.value || '提交失败')
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (isDirty.value) {
      e.preventDefault()
      e.returnValue = ''
    }
  })
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
      @save-draft="saveDraft"
      @commit="showCommitDialog = true"
      @exit-edit="handleExitEdit"
      @toggle-preview="() => {}"
    />

    <div v-if="!isLoggedIn" class="login-banner">
      <LoginButton />
      <span>登录后可编辑和提交文章</span>
    </div>

    <FrontmatterPanel
      v-if="isLoggedIn"
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

@media (max-width: 767px) {
  .editor-container {
    padding: 0 12px 32px;
  }
}
</style>
