<script setup lang="ts" name="ArticleContent">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import { MarkdownEditor } from '@kongjianguan/markdown-editor'
import { useGitHubAuth } from '../composables/useGitHubAuth'
import { useEditorEntry } from '../composables/useEditorEntry'
import { createGitHubStorage } from '../composables/useGitHubStorage'
import LoginButton from './LoginButton.vue'

interface PendingNewArticle {
  path: string
  template: string
  created?: boolean
}

const NEW_ARTICLE_KEY = 'pending_new_article'

const { page } = useData()
const route = useRoute()
const { isLoggedIn } = useGitHubAuth()
const { editRequested, readModeRequest, clearEditRequest } = useEditorEntry()

const storage = createGitHubStorage()
const editorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null)
const pendingPath = ref('')
const pendingTemplate = ref('')
const pendingCreated = ref(false)
const mounted = ref(false)

const standalone = computed(() => pendingPath.value !== '')
// 新建文章通过 ?new=true 触发整页跳转，此时没有编辑请求，需要凭待建文章记录直接进入编辑。
const isEditing = computed(() => editRequested.value || standalone.value)

function readPendingNewArticle(): PendingNewArticle | null {
  if (typeof window === 'undefined') return null
  if (new URLSearchParams(window.location.search).get('new') !== 'true') return null

  try {
    const raw = sessionStorage.getItem(NEW_ARTICLE_KEY)
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
  const filePath = (page.value as any).filePath
  if (filePath) return `docs/${filePath}`
  const relative = page.value.relativePath
  return relative ? `docs/${relative}` : ''
}

const pageIdentity = computed(() => {
  const data = page.value as any
  return `${route.path}|${data?.filePath || data?.relativePath || ''}`
})

function syncPendingArticle(): void {
  const pending = readPendingNewArticle()
  pendingPath.value = pending?.path || ''
  pendingTemplate.value = pending?.template || ''
  pendingCreated.value = pending?.created === true
}

const editorFilePath = computed(() => pendingPath.value || getFilePathFromPage() || 'docs/index.md')

function handleExit(): void {
  clearEditRequest()
  syncPendingArticle()

  if (!pendingPath.value || typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete('new')
  sessionStorage.removeItem(NEW_ARTICLE_KEY)
  window.location.assign(url.pathname + url.search + url.hash)
}

function handleSaved(): void {
  if (!pendingPath.value || typeof window === 'undefined') return

  const pending = readPendingNewArticle()
  if (pending?.path !== pendingPath.value) return

  sessionStorage.setItem(NEW_ARTICLE_KEY, JSON.stringify({ ...pending, created: true }))
  pendingCreated.value = true
}

watch(pageIdentity, (_next, previous) => {
  if (previous !== undefined) clearEditRequest()
  syncPendingArticle()
}, { immediate: true })

watch(readModeRequest, () => {
  editorRef.value?.requestExit()
})

onMounted(async () => {
  await nextTick()
  mounted.value = true
  syncPendingArticle()
})
</script>

<template>
  <MarkdownEditor
    v-if="mounted && isEditing"
    ref="editorRef"
    :storage="storage"
    :active="isEditing"
    :file-path="editorFilePath"
    :title="(page.title as string) || ''"
    :is-logged-in="isLoggedIn"
    :expect-new="standalone && !pendingCreated"
    :standalone="standalone"
    :fallback-content="pendingTemplate"
    draft-key-prefix="draft:"
    @exit="handleExit"
    @saved="handleSaved"
  >
    <template #login>
      <LoginButton />
    </template>
  </MarkdownEditor>
</template>
