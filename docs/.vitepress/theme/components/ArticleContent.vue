<script setup lang="ts" name="ArticleContent">
import { ref, watch, onMounted, computed } from 'vue'
import { useRoute, useRouter, useData } from 'vitepress'
import { useGitHubAuth } from '../composables/useGitHubAuth'
import { useEditMode } from '../composables/useEditMode'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import LoginButton from './LoginButton.vue'
import { defineAsyncComponent } from 'vue'

const MilkdownEditor = defineAsyncComponent(() => import('./MilkdownEditor.vue'))

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
  return page.value.relativePath || ''
}

watch(editParam, async (editing) => {
  if (editing) {
    const path = getFilePathFromPage() || 'index.md'
    await initEditor(path, '')
    const vpDoc = document.querySelector('.vp-doc')
    if (vpDoc) vpDoc.classList.add('edit-mode-hidden')
  } else {
    isEditing.value = false
    const vpDoc = document.querySelector('.vp-doc')
    if (vpDoc) vpDoc.classList.remove('edit-mode-hidden')
  }
}, { immediate: true })

onMounted(async () => {
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.has('code')) {
    const { handleCallback } = useGitHubAuth()
    await handleCallback()
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
      :is-logged-in="isLoggedIn.value"
      :is-new-file="isNewFile"
      @save-draft="saveDraft"
      @commit="showCommitDialog = true"
      @exit-edit="handleExitEdit"
      @toggle-preview="() => {}"
    />

    <div v-if="!isLoggedIn.value" class="login-banner">
      <LoginButton />
      <span>登录后可编辑和提交文章</span>
    </div>

    <FrontmatterPanel
      v-if="isLoggedIn.value"
      :frontmatter="frontmatter"
      @update:frontmatter="updateFrontmatter"
      v-model:collapsed="fmCollapsed"
    />

    <MilkdownEditor
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
  max-width: 688px;
  margin: 0 auto;
  padding: 0 24px 48px;
}

.login-banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  color: var(--vp-c-text-2);
}

@media (max-width: 767px) {
  .editor-container {
    padding: 0 12px 32px;
  }
}
</style>
