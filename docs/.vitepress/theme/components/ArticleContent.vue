<script setup lang="ts" name="ArticleContent">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useData, useRoute } from 'vitepress'
import MarkdownIt from 'markdown-it'
import { useGitHubAuth } from '../composables/useGitHubAuth'
import { useEditMode } from '../composables/useEditMode'
import { useEditorEntry } from '../composables/useEditorEntry'
import EditorToolbar from './EditorToolbar.vue'
import FrontmatterPanel from './FrontmatterPanel.vue'
import CommitDialog from './CommitDialog.vue'
import LoginButton from './LoginButton.vue'

const CodeMirrorEditor = defineAsyncComponent(() => import('./CodeMirrorEditor.vue'))
const markdown = MarkdownIt({ html: true, breaks: true, linkify: true })

interface ParsedSourceBlock {
  from: number
  to: number
  tokenType: string
  tag: string
  renderedCount: number
}

interface EditableBlock extends ParsedSourceBlock {
  id: string
  hosts: HTMLElement[]
  suffix: string
  dirty: boolean
}

const { page } = useData()
const route = useRoute()
const { isLoggedIn } = useGitHubAuth()
const { editRequested, readModeRequest, clearEditRequest } = useEditorEntry()
const {
  isEditing, filePath, content, frontmatter,
  isDirty, isSaving, saveError, loadError, frontmatterError, isNewFile, newFileConflict,
  initEditor, updateContent, updateFrontmatter, saveDraft, commit,
} = useEditMode()

const showCommitDialog = ref(false)
const fmCollapsed = ref(false)
const activeValue = ref('')
const activeSelection = ref(0)
const activeBlock = shallowRef<EditableBlock | null>(null)
const editorMount = shallowRef<HTMLElement | null>(null)
const standaloneMode = ref(false)

let articleRoot: HTMLElement | null = null
let editableBlocks: EditableBlock[] = []
let blockLookup = new Map<string, EditableBlock>()
let emptyBodyPlaceholder: HTMLElement | null = null
let blockSequence = 0
let setupGeneration = 0

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

function splitMarkdownBody(value: string): { body: string; bodyOffset: number } {
  const match = value.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)
  const bodyOffset = match?.[0].length || 0
  return { body: value.slice(bodyOffset), bodyOffset }
}

function getLineOffsets(value: string): number[] {
  const offsets = [0]
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '\n') offsets.push(index + 1)
  }
  return offsets
}

function parseSourceBlocks(value: string): ParsedSourceBlock[] {
  const { body, bodyOffset } = splitMarkdownBody(value)
  const offsets = getLineOffsets(body)
  const seen = new Set<string>()
  const blocks: ParsedSourceBlock[] = []

  for (const token of markdown.parse(body, {})) {
    if (token.level !== 0 || !token.map || (token.nesting !== 0 && token.nesting !== 1)) continue

    const [startLine, endLine] = token.map
    const key = `${startLine}:${endLine}`
    if (seen.has(key)) continue
    seen.add(key)

    const from = bodyOffset + (offsets[startLine] ?? body.length)
    const to = bodyOffset + (offsets[endLine] ?? body.length)
    if (to <= from) continue

    let renderedCount = 1
    if (token.type === 'html_block' && typeof document !== 'undefined') {
      const template = document.createElement('template')
      template.innerHTML = markdown.render(value.slice(from, to))
      renderedCount = Math.max(1, template.content.children.length)
    }

    blocks.push({
      from,
      to,
      tokenType: token.type,
      tag: token.tag || '',
      renderedCount,
    })
  }

  if (blocks.length === 0 && body.trim().length === 0) {
    blocks.push({
      from: bodyOffset,
      to: value.length,
      tokenType: 'empty_body',
      tag: 'p',
      renderedCount: 1,
    })
  }

  return blocks
}

function getVisibleArticleRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const docs = Array.from(document.querySelectorAll<HTMLElement>('.vp-doc'))
  const doc = docs.find(element => element.offsetParent !== null) || docs[0]
  if (!doc) return null

  return doc.querySelector<HTMLElement>(':scope > div[data-pagefind-body]') ||
    doc.querySelector<HTMLElement>(':scope > div')
}

async function waitForArticleRoot(generation: number): Promise<HTMLElement | null> {
  for (let attempt = 0; attempt < 12; attempt++) {
    if (generation !== setupGeneration) return null
    const root = getVisibleArticleRoot()
    if (root) return root
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
  return null
}

function matchesRenderedBlock(block: ParsedSourceBlock, element: HTMLElement): boolean {
  const tag = element.tagName.toLowerCase()
  if (block.tokenType === 'fence' || block.tokenType === 'code_block') {
    return tag === 'pre' || element.matches('div[class*="language-"]')
  }
  if (block.tokenType === 'table_open') return tag === 'table' || element.classList.contains('table-wrapper')
  if (block.tokenType.startsWith('container_')) return tag === 'div'
  return !block.tag || tag === block.tag
}

function clearBlockMarkers() {
  if (!articleRoot) return
  articleRoot.querySelectorAll<HTMLElement>('[data-inline-edit-block]').forEach((element) => {
    element.removeAttribute('data-inline-edit-block')
    element.classList.remove('inline-edit-block')
  })
}

function removeEmptyBodyPlaceholder() {
  emptyBodyPlaceholder?.remove()
  emptyBodyPlaceholder = null
}

function syncEmptyBodyPlaceholder(sourceBlocks: ParsedSourceBlock[]) {
  const isEmptyBody = sourceBlocks.some(block => block.tokenType === 'empty_body')
  if (!isEmptyBody || !articleRoot) {
    removeEmptyBodyPlaceholder()
    return
  }

  if (emptyBodyPlaceholder && articleRoot.contains(emptyBodyPlaceholder)) return

  const existingParagraph = Array.from(articleRoot.children)
    .find((element): element is HTMLElement => {
      return element instanceof HTMLElement && element.tagName === 'P'
    })

  if (existingParagraph) {
    emptyBodyPlaceholder = existingParagraph
    if (!existingParagraph.innerHTML.trim()) existingParagraph.innerHTML = '<br>'
    existingParagraph.classList.add('inline-empty-body')
    return
  }

  const placeholder = document.createElement('p')
  placeholder.className = 'inline-empty-body'
  placeholder.innerHTML = '<br>'
  articleRoot.append(placeholder)
  emptyBodyPlaceholder = placeholder
}

function alignRenderedBlocks(
  sourceBlocks: ParsedSourceBlock[],
  renderedElements: HTMLElement[],
): Array<{ source: ParsedSourceBlock; hosts: HTMLElement[] }> {
  const candidates = [...renderedElements]
  const expectedElements = sourceBlocks.reduce((total, block) => total + block.renderedCount, 0)

  if (
    candidates.length === expectedElements + 1 &&
    candidates[0]?.tagName === 'H1' &&
    sourceBlocks[0]?.tag !== 'h1'
  ) {
    candidates.shift()
  }

  if (candidates.length === expectedElements) {
    let cursor = 0
    return sourceBlocks.map((source) => {
      const hosts = candidates.slice(cursor, cursor + source.renderedCount)
      cursor += source.renderedCount
      return { source, hosts }
    })
  }

  const aligned: Array<{ source: ParsedSourceBlock; hosts: HTMLElement[] }> = []
  let cursor = 0
  for (const source of sourceBlocks) {
    const matchIndex = candidates.findIndex((element, index) => {
      return index >= cursor && matchesRenderedBlock(source, element)
    })
    if (matchIndex < 0) continue
    const hosts = candidates.slice(matchIndex, matchIndex + source.renderedCount)
    if (hosts.length !== source.renderedCount) continue
    aligned.push({ source, hosts })
    cursor = matchIndex + source.renderedCount
  }
  return aligned
}

function rebuildBlockBindings() {
  if (!articleRoot) return

  clearBlockMarkers()
  editableBlocks = []
  blockLookup = new Map()

  const sourceBlocks = parseSourceBlocks(content.value)
  syncEmptyBodyPlaceholder(sourceBlocks)
  const renderedElements = Array.from(articleRoot.children)
    .filter((element): element is HTMLElement => {
      return element instanceof HTMLElement && !element.classList.contains('inline-block-editor-mount')
    })
  const aligned = alignRenderedBlocks(sourceBlocks, renderedElements)

  for (const { source, hosts } of aligned) {
    const id = `inline-block-${++blockSequence}`
    const block: EditableBlock = {
      ...source,
      id,
      hosts,
      suffix: '',
      dirty: false,
    }
    hosts.forEach((host) => {
      host.dataset.inlineEditBlock = id
      host.classList.add('inline-edit-block')
    })
    editableBlocks.push(block)
    blockLookup.set(id, block)
  }

  if (aligned.length !== sourceBlocks.length) {
    console.warn(`Inline editor mapped ${aligned.length}/${sourceBlocks.length} Markdown blocks`)
  }
}

function getEditableSource(block: EditableBlock): { value: string; suffix: string } {
  const raw = content.value.slice(block.from, block.to)
  if (raw.endsWith('\r\n')) return { value: raw.slice(0, -2), suffix: '\r\n' }
  if (raw.endsWith('\n')) return { value: raw.slice(0, -1), suffix: '\n' }
  return { value: raw, suffix: '' }
}

function getInitialSelection(value: string, host: HTMLElement, clientY?: number): number {
  if (clientY === undefined || !value) return 0
  const rect = host.getBoundingClientRect()
  if (!rect.height) return 0

  const lineOffsets = getLineOffsets(value)
  const ratio = Math.max(0, Math.min(0.999, (clientY - rect.top) / rect.height))
  const lineIndex = Math.min(lineOffsets.length - 1, Math.floor(ratio * lineOffsets.length))
  return lineOffsets[lineIndex] || 0
}

function activateBlock(block: EditableBlock, clientY?: number, selection?: 'start' | 'end') {
  if (!articleRoot || activeBlock.value?.id === block.id) return

  const { value, suffix } = getEditableSource(block)
  const mount = document.createElement('div')
  const firstHost = block.hosts[0]
  const lastHost = block.hosts[block.hosts.length - 1]
  const firstStyle = window.getComputedStyle(firstHost)
  const lastStyle = window.getComputedStyle(lastHost)
  mount.className = 'inline-block-editor-mount'
  mount.dataset.blockTag = firstHost.tagName.toLowerCase()
  mount.style.marginTop = firstStyle.marginTop
  mount.style.marginBottom = lastStyle.marginBottom

  firstHost.before(mount)
  block.hosts.forEach(host => { host.hidden = true })
  block.suffix = suffix
  block.dirty = false

  activeValue.value = value
  activeSelection.value = selection === 'end'
      ? value.length
    : selection === 'start'
      ? 0
      : getInitialSelection(value, firstHost, clientY)
  activeBlock.value = block
  editorMount.value = mount
}

function renderChangedBlock(block: EditableBlock): HTMLElement[] {
  const source = content.value.slice(block.from, block.to)
  const template = document.createElement('template')
  template.innerHTML = markdown.render(source)
  const elements = Array.from(template.content.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)

  if (elements.length) return elements
  const placeholder = document.createElement('p')
  placeholder.innerHTML = '<br>'
  return [placeholder]
}

async function deactivateBlock(render = true): Promise<void> {
  const block = activeBlock.value
  const mount = editorMount.value
  if (!block) return

  activeBlock.value = null
  editorMount.value = null
  await nextTick()
  mount?.remove()

  if (block.dirty && render) {
    const rendered = renderChangedBlock(block)
    const [firstHost, ...remainingHosts] = block.hosts
    firstHost.replaceWith(...rendered)
    remainingHosts.forEach(host => host.remove())
  } else {
    block.hosts.forEach(host => { host.hidden = false })
  }

  rebuildBlockBindings()
}

function handleBlockInput(value: string) {
  const block = activeBlock.value
  if (!block) return

  const replacement = `${value}${block.suffix}`
  const nextContent = `${content.value.slice(0, block.from)}${replacement}${content.value.slice(block.to)}`
  block.to = block.from + replacement.length
  block.dirty = true
  activeValue.value = value
  updateContent(nextContent)
}

async function handleBlockNavigation(direction: 'previous' | 'next') {
  const block = activeBlock.value
  if (!block) return
  const currentIndex = editableBlocks.findIndex(item => item.id === block.id)
  const nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1
  await deactivateBlock()

  const nextBlock = editableBlocks[nextIndex]
  if (nextBlock) activateBlock(nextBlock, undefined, direction === 'previous' ? 'end' : 'start')
}

async function handleArticleClick(event: MouseEvent) {
  if (!articleRoot || !(event.target instanceof Element)) return
  const host = event.target.closest<HTMLElement>('[data-inline-edit-block]')
  if (!host || !articleRoot.contains(host)) return

  event.preventDefault()
  event.stopPropagation()

  if (activeBlock.value) await deactivateBlock()
  const currentId = host.dataset.inlineEditBlock
  const block = currentId ? blockLookup.get(currentId) : null
  if (block) activateBlock(block, event.clientY)
}

function handleDocumentMouseDown(event: MouseEvent) {
  if (!activeBlock.value || !(event.target instanceof Element)) return
  if (editorMount.value?.contains(event.target)) return
  if (articleRoot?.contains(event.target.closest('[data-inline-edit-block]'))) return
  void deactivateBlock()
}

async function setupInlineEditing() {
  if (typeof document === 'undefined' || standaloneMode.value) return
  const generation = ++setupGeneration
  const root = await waitForArticleRoot(generation)
  if (!root || generation !== setupGeneration || !isEditing.value) return

  if (articleRoot && articleRoot !== root) {
    articleRoot.removeEventListener('click', handleArticleClick)
    clearBlockMarkers()
    removeEmptyBodyPlaceholder()
  }

  document.querySelectorAll('.vp-doc').forEach(element => element.classList.remove('edit-mode-hidden'))
  articleRoot = root
  articleRoot.classList.add('article-inline-editing')
  articleRoot.removeEventListener('click', handleArticleClick)
  articleRoot.addEventListener('click', handleArticleClick)
  rebuildBlockBindings()
}

async function cleanupInlineEditing(renderActive = true) {
  setupGeneration++
  await deactivateBlock(renderActive)
  if (articleRoot) {
    articleRoot.removeEventListener('click', handleArticleClick)
    articleRoot.classList.remove('article-inline-editing')
    clearBlockMarkers()
  }
  removeEmptyBodyPlaceholder()
  articleRoot = null
  editableBlocks = []
  blockLookup = new Map()
}

async function startEditing(): Promise<void> {
  const pending = getPendingNewArticle()
  const path = getFilePathFromPage() || 'docs/index.md'
  await initEditor(path, pending?.template || '', {
    expectNew: Boolean(pending && !pending.created),
  })
  standaloneMode.value = Boolean(pending)
  await nextTick()
  if (!standaloneMode.value) await setupInlineEditing()
}

const pageIdentity = computed(() => {
  const data = page.value as any
  return `${route.path}|${data?.filePath || data?.relativePath || ''}`
})

async function syncEditorWithLocation(): Promise<void> {
  const editing = editRequested.value || Boolean(getPendingNewArticle())
  if (!editing) {
    if (isEditing.value && isDirty.value) saveDraft()
    showCommitDialog.value = false
    await cleanupInlineEditing()
    standaloneMode.value = false
    isEditing.value = false
    return
  }

  await nextTick()
  const nextPath = getFilePathFromPage() || 'docs/index.md'
  if (isEditing.value && filePath.value === nextPath && articleRoot) return
  if (isEditing.value && isDirty.value) saveDraft()
  await cleanupInlineEditing()
  await startEditing()
}

watch(pageIdentity, (_next, previous) => {
  if (previous !== undefined) clearEditRequest()
  void syncEditorWithLocation()
}, { immediate: true })
watch(editRequested, () => { void syncEditorWithLocation() })
watch(readModeRequest, () => { void handleExitEdit() })

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (isDirty.value) {
    saveDraft()
    event.preventDefault()
    event.returnValue = ''
  }
}

function handlePopState() {
  void syncEditorWithLocation()
}

onMounted(() => {
  document.addEventListener('mousedown', handleDocumentMouseDown, true)
  window.addEventListener('popstate', handlePopState)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleDocumentMouseDown, true)
  window.removeEventListener('popstate', handlePopState)
  window.removeEventListener('beforeunload', handleBeforeUnload)
  void cleanupInlineEditing(false)
})

async function handleFrontmatterUpdate(nextFrontmatter: Record<string, any>) {
  await deactivateBlock()
  updateFrontmatter(nextFrontmatter)
  rebuildBlockBindings()
}

async function openCommitDialog() {
  await deactivateBlock()
  showCommitDialog.value = true
}

async function handleExitEdit() {
  if (isDirty.value) {
    if (!confirm('有未保存的修改，确定退出吗？')) return
    saveDraft()
  }
  const pending = getPendingNewArticle()
  clearEditRequest()
  await cleanupInlineEditing()
  standaloneMode.value = false
  isEditing.value = false
  if (!pending) return

  const url = new URL(window.location.href)
  url.searchParams.delete('new')
  sessionStorage.removeItem('pending_new_article')
  window.location.assign(url.pathname + url.search + url.hash)
}

async function handleCommit({ message }: { message: string }) {
  await deactivateBlock()
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
  <div v-if="isEditing" class="editor-controls">
    <EditorToolbar
      :file-path="filePath"
      :title="articleTitle"
      :is-dirty="isDirty"
      :is-saving="isSaving"
      :is-logged-in="isLoggedIn"
      :is-new-file="isNewFile"
      :can-commit="!newFileConflict"
      @save-draft="saveDraft"
      @commit="openCommitDialog"
      @exit-edit="handleExitEdit"
    />

    <div v-if="!isLoggedIn" class="login-banner">
      <LoginButton />
      <span>登录后可提交文章，草稿可先保存在本机</span>
    </div>

    <div v-if="loadError" class="editor-error">{{ loadError }}</div>
    <div v-if="frontmatterError" class="editor-error">
      {{ frontmatterError }}，请修改文章属性后再提交。
    </div>

    <FrontmatterPanel
      v-if="isLoggedIn && !frontmatterError"
      :frontmatter="frontmatter"
      @update:frontmatter="handleFrontmatterUpdate"
      v-model:collapsed="fmCollapsed"
    />

    <div v-if="standaloneMode" class="standalone-editor">
      <CodeMirrorEditor
        :model-value="content"
        :initial-selection="content.length"
        @update:model-value="updateContent"
      />
    </div>

    <CommitDialog
      v-model:visible="showCommitDialog"
      :is-new-file="isNewFile"
      :is-saving="isSaving"
      @confirm="handleCommit"
    />
  </div>

  <Teleport v-if="editorMount && activeBlock" :to="editorMount">
    <CodeMirrorEditor
      :key="activeBlock.id"
      :model-value="activeValue"
      :initial-selection="activeSelection"
      @update:model-value="handleBlockInput"
      @navigate="handleBlockNavigation"
      @escape="deactivateBlock"
    />
  </Teleport>
</template>

<style>
.editor-controls {
  max-width: 744px;
  margin: 0 auto 12px;
  padding: 0 24px;
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

.standalone-editor {
  margin-top: 12px;
}

.vp-doc .article-inline-editing .inline-edit-block {
  cursor: text;
  border-radius: 4px;
  transition: background-color 0.15s, box-shadow 0.15s;
}

.vp-doc .article-inline-editing .inline-edit-block:hover {
  background: var(--vp-c-bg-soft);
  box-shadow: 0 0 0 5px var(--vp-c-bg-soft);
}

.inline-block-editor-mount {
  width: 100%;
  position: relative;
  z-index: 2;
}

.inline-block-editor-mount[data-block-tag='h1'] .cm-content {
  font-size: 28px;
  font-weight: 600;
}

.inline-block-editor-mount[data-block-tag='h2'] .cm-content {
  font-size: 24px;
  font-weight: 600;
}

.inline-block-editor-mount[data-block-tag='h3'] .cm-content {
  font-size: 20px;
  font-weight: 600;
}

@media (max-width: 767px) {
  .editor-controls {
    padding: 0 12px;
  }
}
</style>
