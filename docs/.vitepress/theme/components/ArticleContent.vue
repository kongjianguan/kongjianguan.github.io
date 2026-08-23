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
import { useGitHubAPI } from '../composables/useGitHubAPI'
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

type ImageSourceKind = 'markdown' | 'html'

interface ImageSource {
  from: number
  to: number
  raw: string
  url: string
  alt: string
  kind: ImageSourceKind
}

interface EditableBlock extends ParsedSourceBlock {
  id: string
  hosts: HTMLElement[]
  suffix: string
  dirty: boolean
}

interface DraggedImage {
  block: EditableBlock
  host: HTMLElement
  entry: ImageSource
  image: HTMLImageElement
  index: number
}

interface ImageDropTarget {
  block: EditableBlock
  host: HTMLElement
  mode: 'insert' | 'append'
}

interface PendingImage {
  file: File
  localUrl: string
  remoteUrl?: string
}

interface HostSourceRange {
  from: number
  to: number
}

const { page } = useData()
const route = useRoute()
const { isLoggedIn } = useGitHubAuth()
const { uploadImage } = useGitHubAPI()
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
const isPreparingCommit = ref(false)

let articleRoot: HTMLElement | null = null
let editableBlocks: EditableBlock[] = []
let blockLookup = new Map<string, EditableBlock>()
let emptyBodyPlaceholder: HTMLElement | null = null
let blockSequence = 0
let setupGeneration = 0
let draggedImage: DraggedImage | null = null
let imageDropTarget: ImageDropTarget | null = null
let dropIndicator: HTMLDivElement | null = null
let dropIndicatorHost: HTMLElement | null = null
let dropPreviewHost: HTMLElement | null = null
let dropPreviewImage: HTMLImageElement | null = null
let suppressArticleClickUntil = 0
const pendingImages = new Map<string, PendingImage>()

const articleTitle = computed(() => {
  return (frontmatter.value?.title || page.value?.title || '') as string
})

async function stageImage(file: File): Promise<string | null> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image too large (max 5MB)')
  }
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    throw new Error('当前浏览器不支持本地图片暂存')
  }

  const localUrl = URL.createObjectURL(file)
  pendingImages.set(localUrl, { file, localUrl })
  return localUrl
}

function releasePendingImages(): void {
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    pendingImages.forEach(({ localUrl }) => URL.revokeObjectURL(localUrl))
  }
  pendingImages.clear()
}

function hasPendingImageReferences(): boolean {
  return Array.from(pendingImages.values()).some(({ localUrl }) => content.value.includes(localUrl))
}

function saveEditorDraft(notify = true): void {
  if (hasPendingImageReferences()) {
    if (notify) {
      alert('当前内容包含尚未提交的图片，暂时不能保存为本机草稿。请提交文章，或移除图片后再保存。')
    }
    return
  }
  saveDraft()
}

async function uploadPendingImages(): Promise<void> {
  let nextContent = content.value

  for (const pending of pendingImages.values()) {
    if (!nextContent.includes(pending.localUrl)) continue

    if (!pending.remoteUrl) {
      const remoteUrl = await uploadImage(pending.file)
      if (!remoteUrl) throw new Error('图片上传失败')
      pending.remoteUrl = remoteUrl
    }

    nextContent = nextContent.split(pending.localUrl).join(pending.remoteUrl)
    updateContent(nextContent)
  }
}

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
    element.classList.remove('inline-edit-block', 'inline-image-row', 'inline-image-snap-target')
    const images = element.matches('img')
      ? [element as HTMLImageElement]
      : Array.from(element.querySelectorAll<HTMLImageElement>('img'))
    images.forEach((image) => {
      image.removeAttribute('draggable')
      image.removeAttribute('data-inline-image')
      image.classList.remove('inline-image-dragging', 'inline-image-drop-preview')
    })
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

  for (const block of editableBlocks) {
    const images = getRenderedImages(block.hosts)
    if (!images.length) continue

    const imageSources = getImageSources(block)
    images.forEach((image, index) => {
      if (!imageSources[index]) return
      image.setAttribute('draggable', 'true')
      image.dataset.inlineImage = 'true'
    })
    block.hosts
      .filter(host => host.querySelector('img') && !host.textContent?.trim())
      .forEach(host => host.classList.add('inline-image-row'))
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

function normalizeImageReference(value: string): string {
  if (typeof window === 'undefined') return value
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return value
  }
  return value
}

function parseImageSources(source: string, offset: number): ImageSource[] {
  const entries: ImageSource[] = []
  const markdownPattern = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g
  const htmlPattern = /<img\b[^>]*\bsrc\s*=\s*(['"])(.*?)\1[^>]*>/gi

  for (const match of source.matchAll(markdownPattern)) {
    const raw = match[0]
    const from = offset + (match.index || 0)
    entries.push({
      from,
      to: from + raw.length,
      raw,
      url: normalizeImageReference(match[2] || match[3] || ''),
      alt: match[1] || '图片',
      kind: 'markdown',
    })
  }

  for (const match of source.matchAll(htmlPattern)) {
    const raw = match[0]
    const from = offset + (match.index || 0)
    const alt = raw.match(/\balt\s*=\s*(['"])(.*?)\1/i)?.[2] || '图片'
    entries.push({
      from,
      to: from + raw.length,
      raw,
      url: normalizeImageReference(match[2]),
      alt,
      kind: 'html',
    })
  }

  return entries.sort((left, right) => left.from - right.from)
}

function getHtmlHostRanges(source: string): HostSourceRange[] {
  const ranges: HostSourceRange[] = []
  const stack: Array<{ tag: string; from: number }> = []
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const tagPattern = /<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>/g

  for (const match of source.matchAll(tagPattern)) {
    const raw = match[0]
    const from = match.index || 0
    const to = from + raw.length
    if (raw.startsWith('<!--') || raw.startsWith('<!')) {
      continue
    }

    const tag = raw.match(/^<\/?\s*([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase()
    if (!tag) continue

    if (/^<\//.test(raw)) {
      const open = stack[stack.length - 1]
      if (!open || open.tag !== tag) continue
      stack.pop()
      if (!stack.length) ranges.push({ from: open.from, to })
      continue
    }

    if (stack.length) continue
    if (voidTags.has(tag) || /\/\s*>$/.test(raw)) {
      ranges.push({ from, to })
    } else {
      stack.push({ tag, from })
    }
  }

  return ranges
}

function getImageSources(block: EditableBlock): ImageSource[] {
  return parseImageSources(content.value.slice(block.from, block.to), block.from)
}

function getHostSourceRange(block: EditableBlock, host: HTMLElement): HostSourceRange {
  const source = content.value.slice(block.from, block.to)
  if (block.tokenType !== 'html_block') return { from: 0, to: source.length }

  const hostIndex = block.hosts.indexOf(host)
  return getHtmlHostRanges(source)[hostIndex] || { from: 0, to: source.length }
}

function getRenderedImages(hosts: HTMLElement[]): HTMLImageElement[] {
  return hosts.flatMap(host => {
    if (host.tagName.toLowerCase() === 'img') return [host as HTMLImageElement]
    return Array.from(host.querySelectorAll<HTMLImageElement>('img'))
  })
}

function isImageOnlySource(source: string, entries: ImageSource[]): boolean {
  let remaining = source
  for (const entry of entries) {
    const index = remaining.indexOf(entry.raw)
    if (index >= 0) {
      remaining = `${remaining.slice(0, index)}${remaining.slice(index + entry.raw.length)}`
    }
  }

  return remaining
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/\s+/g, '')
    .length === 0
}

function removeImageFromSource(block: EditableBlock, entry: ImageSource): string {
  const source = content.value.slice(block.from, block.to)
  const entries = getImageSources(block)
  const from = entry.from - block.from
  const next = `${source.slice(0, from)}${source.slice(from + entry.raw.length)}`
  if (entries.length === 1 && isImageOnlySource(source, entries)) return ''
  return next
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character)
}

function getImageMarkup(entry: ImageSource, targetSource: string): string {
  const isHtmlTarget = /^\s*</.test(targetSource)
  if (isHtmlTarget) {
    if (entry.kind === 'html') return entry.raw
    return `<img src="${escapeHtml(entry.url)}" alt="${escapeHtml(entry.alt)}" />`
  }

  return entry.raw
}

function appendImageToSource(source: string, imageMarkup: string): string {
  const trailing = source.match(/\s*$/)?.[0] || ''
  const body = source.slice(0, source.length - trailing.length)
  const closing = body.match(/(<\/(?:div|p|figure|section)>)\s*$/i)

  if (closing && closing.index !== undefined) {
    const beforeClosing = body.slice(0, closing.index).trimEnd()
    return `${beforeClosing}\n  ${imageMarkup}\n${closing[1]}${trailing}`
  }

  return `${body}${body.trim() ? ' ' : ''}${imageMarkup}${trailing}`
}

function applyTextEdits(
  source: string,
  edits: Array<{ from: number; to: number; text: string }>,
): string {
  return [...edits]
    .sort((left, right) => right.from - left.from)
    .reduce((value, edit) => {
      return `${value.slice(0, edit.from)}${edit.text}${value.slice(edit.to)}`
    }, source)
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

function renderSource(source: string, withPlaceholder = true): HTMLElement[] {
  const template = document.createElement('template')
  template.innerHTML = markdown.render(source)
  const elements = Array.from(template.content.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)

  if (elements.length) return elements
  if (!withPlaceholder) return []
  const placeholder = document.createElement('p')
  placeholder.innerHTML = '<br>'
  return [placeholder]
}

function renderChangedBlock(block: EditableBlock): HTMLElement[] {
  return renderSource(content.value.slice(block.from, block.to))
}

function replaceBlockHosts(block: EditableBlock, source: string): HTMLElement[] {
  const rendered = renderSource(source, false)
  const [firstHost, ...remainingHosts] = block.hosts

  if (firstHost) {
    if (rendered.length) firstHost.replaceWith(...rendered)
    else firstHost.remove()
  }
  remainingHosts.forEach(host => host.remove())
  return rendered
}

function clearImageDropVisuals(): void {
  dropIndicator?.remove()
  dropIndicator = null
  dropIndicatorHost = null
  dropPreviewImage?.remove()
  dropPreviewImage = null
  dropPreviewHost?.classList.remove('inline-image-snap-target')
  dropPreviewHost = null
}

function clearImageDropFeedback(): void {
  clearImageDropVisuals()
  imageDropTarget = null
}

function getEditableBlockFromTarget(target: EventTarget | null): { block: EditableBlock; host: HTMLElement } | null {
  if (!(target instanceof Element) || !articleRoot) return null
  const host = target.closest<HTMLElement>('[data-inline-edit-block]')
  if (!host || !articleRoot.contains(host)) return null
  const id = host.dataset.inlineEditBlock
  const block = id ? blockLookup.get(id) : null
  return block ? { block, host } : null
}

function showImageDropIndicator(host: HTMLElement): void {
  if (!articleRoot) return
  if (dropIndicator && dropIndicatorHost === host) {
    const rootRect = articleRoot.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    dropIndicator.style.top = `${Math.max(0, hostRect.top - rootRect.top - 3)}px`
    dropIndicator.style.left = `${Math.max(0, hostRect.left - rootRect.left)}px`
    dropIndicator.style.width = `${hostRect.width}px`
    return
  }

  clearImageDropVisuals()

  if (!dropIndicator) {
    dropIndicator = document.createElement('div')
    dropIndicator.className = 'inline-image-drop-indicator'
    articleRoot.append(dropIndicator)
  }
  dropIndicatorHost = host

  const rootRect = articleRoot.getBoundingClientRect()
  const hostRect = host.getBoundingClientRect()
  dropIndicator.style.top = `${Math.max(0, hostRect.top - rootRect.top - 3)}px`
  dropIndicator.style.left = `${Math.max(0, hostRect.left - rootRect.left)}px`
  dropIndicator.style.width = `${hostRect.width}px`
}

function showImageDropPreview(host: HTMLElement): void {
  if (!draggedImage) return
  if (dropPreviewHost === host && dropPreviewImage && host.contains(dropPreviewImage)) return
  clearImageDropVisuals()
  host.classList.add('inline-image-snap-target')
  const preview = draggedImage.image.cloneNode(true) as HTMLImageElement
  preview.removeAttribute('draggable')
  preview.classList.add('inline-image-drop-preview')
  preview.setAttribute('aria-hidden', 'true')
  host.append(preview)
  dropPreviewHost = host
  dropPreviewImage = preview
}

function handleImageDragStart(event: DragEvent): void {
  if (!articleRoot || activeBlock.value) {
    event.preventDefault()
    return
  }

  const image = event.target instanceof HTMLImageElement ? event.target : null
  if (!image || image.classList.contains('inline-image-drop-preview')) return

  const result = getEditableBlockFromTarget(image)
  if (!result) return
  const images = getRenderedImages(result.block.hosts)
  const index = images.indexOf(image)
  const entry = getImageSources(result.block)[index]
  if (!entry) return

  draggedImage = { block: result.block, host: result.host, entry, image, index }
  suppressArticleClickUntil = Date.now() + 800
  image.classList.add('inline-image-dragging')
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', 'inline-image')
  }
}

function handleImageDragOver(event: DragEvent): void {
  if (!draggedImage) return
  const result = getEditableBlockFromTarget(event.target)
  if (!result || (result.block === draggedImage.block && result.host === draggedImage.host)) {
    clearImageDropFeedback()
    return
  }

  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'

  const hasImages = getRenderedImages([result.host]).length > 0
  imageDropTarget = {
    block: result.block,
    host: result.host,
    mode: hasImages ? 'append' : 'insert',
  }

  if (hasImages) showImageDropPreview(result.host)
  else showImageDropIndicator(result.host)
}

function handleImageDragLeave(event: DragEvent): void {
  if (!draggedImage) return
  const related = event.relatedTarget
  if (related instanceof Node && articleRoot?.contains(related)) return
  clearImageDropFeedback()
}

function handleImageDragEnd(): void {
  draggedImage?.image.classList.remove('inline-image-dragging')
  draggedImage = null
  suppressArticleClickUntil = Date.now() + 300
  clearImageDropFeedback()
}

async function moveImage(drag: DraggedImage, target: ImageDropTarget): Promise<void> {
  if (!articleRoot || (drag.block === target.block && drag.host === target.host)) return
  if (drag.block === target.block && drag.block.tokenType !== 'html_block') return

  const source = content.value.slice(drag.block.from, drag.block.to)
  const sourceAfter = removeImageFromSource(drag.block, drag.entry)
  const targetRange = getHostSourceRange(target.block, target.host)
  const targetSource = content.value.slice(
    target.block.from + targetRange.from,
    target.block.from + targetRange.to,
  )
  const imageMarkup = getImageMarkup(drag.entry, targetSource)
  const targetAfter = target.mode === 'append'
    ? appendImageToSource(targetSource, imageMarkup)
    : ''
  const targetEdit = target.mode === 'append'
    ? {
        from: target.block.from + targetRange.from,
        to: target.block.from + targetRange.to,
        text: targetAfter,
      }
    : {
        from: target.block.from + targetRange.from,
        to: target.block.from + targetRange.from,
        text: `${imageMarkup}\n`,
      }

  if (drag.block === target.block) {
    const nextBlockSource = applyTextEdits(source, [
      {
        from: drag.entry.from - drag.block.from,
        to: drag.entry.to - drag.block.from,
        text: '',
      },
      {
        from: targetEdit.from - target.block.from,
        to: targetEdit.to - target.block.from,
        text: targetEdit.text,
      },
    ])
    const nextContent = `${content.value.slice(0, drag.block.from)}${nextBlockSource}${content.value.slice(drag.block.to)}`
    updateContent(nextContent)
    replaceBlockHosts(drag.block, nextBlockSource)
    rebuildBlockBindings()
    return
  }

  const sourceEdit = {
    from: drag.block.from,
    to: drag.block.to,
    text: sourceAfter,
  }

  const nextContent = applyTextEdits(content.value, [sourceEdit, targetEdit])
  updateContent(nextContent)
  replaceBlockHosts(drag.block, sourceAfter)
  if (target.mode === 'append') {
    replaceBlockHosts(target.block, targetAfter)
  } else {
    const inserted = renderSource(`${imageMarkup}\n`, false)
    if (inserted.length) target.host.before(...inserted)
  }

  rebuildBlockBindings()
}

async function handleImageDrop(event: DragEvent): Promise<void> {
  if (!draggedImage || !imageDropTarget) return
  event.preventDefault()

  const drag = draggedImage
  const target = imageDropTarget
  handleImageDragEnd()
  await moveImage(drag, target)
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

function handleImageError(message: string): void {
  alert(message)
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
  if (Date.now() < suppressArticleClickUntil) return
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
    articleRoot.removeEventListener('dragstart', handleImageDragStart)
    articleRoot.removeEventListener('dragover', handleImageDragOver)
    articleRoot.removeEventListener('dragleave', handleImageDragLeave)
    articleRoot.removeEventListener('drop', handleImageDrop)
    articleRoot.removeEventListener('dragend', handleImageDragEnd)
    clearImageDropFeedback()
    clearBlockMarkers()
    removeEmptyBodyPlaceholder()
  }

  document.querySelectorAll('.vp-doc').forEach(element => element.classList.remove('edit-mode-hidden'))
  articleRoot = root
  articleRoot.classList.add('article-inline-editing')
  articleRoot.removeEventListener('click', handleArticleClick)
  articleRoot.addEventListener('click', handleArticleClick)
  articleRoot.addEventListener('dragstart', handleImageDragStart)
  articleRoot.addEventListener('dragover', handleImageDragOver)
  articleRoot.addEventListener('dragleave', handleImageDragLeave)
  articleRoot.addEventListener('drop', handleImageDrop)
  articleRoot.addEventListener('dragend', handleImageDragEnd)
  rebuildBlockBindings()
}

async function cleanupInlineEditing(renderActive = true) {
  setupGeneration++
  await deactivateBlock(renderActive)
  if (articleRoot) {
    articleRoot.removeEventListener('click', handleArticleClick)
    articleRoot.removeEventListener('dragstart', handleImageDragStart)
    articleRoot.removeEventListener('dragover', handleImageDragOver)
    articleRoot.removeEventListener('dragleave', handleImageDragLeave)
    articleRoot.removeEventListener('drop', handleImageDrop)
    articleRoot.removeEventListener('dragend', handleImageDragEnd)
    clearImageDropFeedback()
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
    if (isEditing.value && isDirty.value) saveEditorDraft(false)
    releasePendingImages()
    showCommitDialog.value = false
    await cleanupInlineEditing()
    standaloneMode.value = false
    isEditing.value = false
    return
  }

  await nextTick()
  const nextPath = getFilePathFromPage() || 'docs/index.md'
  if (isEditing.value && filePath.value === nextPath && articleRoot) return
  if (isEditing.value && isDirty.value) saveEditorDraft(false)
  releasePendingImages()
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
    saveEditorDraft(false)
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
  releasePendingImages()
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
    saveEditorDraft(false)
  }
  const pending = getPendingNewArticle()
  clearEditRequest()
  releasePendingImages()
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
  if (isPreparingCommit.value) return
  isPreparingCommit.value = true
  try {
    await deactivateBlock()
    await uploadPendingImages()

    const wasNewFile = isNewFile.value
    const committedPath = filePath.value
    const ok = await commit(message)
    if (!ok) {
      alert(saveError.value || '提交失败')
      return
    }

    releasePendingImages()
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
  } catch (error) {
    alert(error instanceof Error ? error.message : '图片上传失败')
  } finally {
    isPreparingCommit.value = false
  }
}
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
      @save-draft="saveEditorDraft"
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
        :stage-image="stageImage"
        @update:model-value="updateContent"
        @image-error="handleImageError"
      />
    </div>

    <CommitDialog
      v-model:visible="showCommitDialog"
      :is-new-file="isNewFile"
      :is-saving="isSaving || isPreparingCommit"
      @confirm="handleCommit"
    />
  </div>

  <Teleport v-if="editorMount && activeBlock" :to="editorMount">
    <CodeMirrorEditor
      :key="activeBlock.id"
      :model-value="activeValue"
      :initial-selection="activeSelection"
      :stage-image="stageImage"
      @update:model-value="handleBlockInput"
      @image-error="handleImageError"
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

.vp-doc .article-inline-editing {
  position: relative;
}

.vp-doc .article-inline-editing .inline-image-row,
.vp-doc .article-inline-editing .inline-image-snap-target {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 16px;
}

.vp-doc .article-inline-editing .inline-image-row > img,
.vp-doc .article-inline-editing .inline-image-snap-target > img {
  margin: 0;
}

.vp-doc .article-inline-editing img[data-inline-image] {
  cursor: grab;
}

.vp-doc .article-inline-editing img.inline-image-dragging {
  opacity: 0.35;
  cursor: grabbing;
}

.vp-doc .article-inline-editing img.inline-image-drop-preview {
  opacity: 0.45;
  outline: 1px dashed var(--vp-c-brand-1);
  outline-offset: 3px;
  pointer-events: none;
}

.inline-image-drop-indicator {
  position: absolute;
  height: 2px;
  border-radius: 2px;
  background: var(--vp-c-brand-1);
  box-shadow: 0 0 0 1px var(--vp-c-brand-soft);
  pointer-events: none;
  z-index: 5;
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
