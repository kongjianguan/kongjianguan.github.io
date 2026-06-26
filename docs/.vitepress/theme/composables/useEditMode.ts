// docs/.vitepress/theme/composables/useEditMode.ts
import { ref, type Ref } from 'vue'
import { useGitHubAuth } from './useGitHubAuth'
import { useGitHubAPI } from './useGitHubAPI'
import { useDrafts } from './useDrafts'

const LOCAL_EDIT = import.meta.env.VITE_LOCALEDIT === '1'

const localMdSources: Record<string, string> = LOCAL_EDIT
  ? import.meta.glob('/**/*.md', { query: '?raw', import: 'default', eager: true })
  : {}

function getLocalContent(path: string): string {
  const normalized = path.startsWith('docs/') ? path.slice(5) : path
  const key = `/${normalized}`
  return localMdSources[key] || localMdSources[path] || ''
}

interface Frontmatter {
  title: string
  date: string
  categories: string[]
  tags: string[]
  permalink: string
  description: string
  [key: string]: any
}

function parseFrontmatter(md: string): { frontmatter: Record<string, any>; body: string } {
  const match = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: md }

  const lines = match[1].split('\n')
  const fm: Record<string, any> = {}
  let currentKey = ''

  for (const line of lines) {
    const keyMatch = line.match(/^(\w[\w-]*):\s*(.*)/)
    if (keyMatch) {
      currentKey = keyMatch[1]
      const value = keyMatch[2].trim()
      if (value.startsWith('[') && value.endsWith(']')) {
        fm[currentKey] = value.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
      } else if (value === '') {
        fm[currentKey] = ''
      } else {
        fm[currentKey] = value
      }
    } else if (currentKey && line.startsWith('  - ')) {
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = []
      fm[currentKey].push(line.slice(4).trim())
    }
  }

  return { frontmatter: fm, body: match[2] || '' }
}

function buildFrontmatter(fm: Record<string, any>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      value.forEach(v => lines.push(`  - ${v}`))
    } else if (value !== undefined && value !== '') {
      lines.push(`${key}: ${value}`)
    } else if (value === '') {
      lines.push(`${key}:`)
    }
  }
  return `---\n${lines.join('\n')}\n---`
}

function assembleMarkdown(fm: Record<string, any>, body: string): string {
  const header = buildFrontmatter(fm)
  return `${header}\n${body}`
}

export function useEditMode() {
  const { isLoggedIn } = useGitHubAuth()
  const { readFile, createFile, updateFile } = useGitHubAPI()
  const { loadDraft, saveDraft: persistDraft, deleteDraft } = useDrafts()

  const isEditing = ref(false)
  const filePath = ref('')
  const content = ref('')
  const frontmatter = ref<Record<string, any>>({})
  const remoteSha = ref<string | null>(null)
  const isDirty = ref(false)
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)
  const isNewFile = ref(false)
  const originalContent = ref('')
  const bodyContent = ref('')

  async function initEditor(path: string, fallbackContent: string): Promise<void> {
    filePath.value = path
    isEditing.value = true

    const draft = loadDraft(path)
    if (draft) {
      const shouldRestore = confirm('检测到未保存的草稿，是否恢复？')
      if (shouldRestore) {
        content.value = draft.content
        frontmatter.value = draft.frontmatter
        remoteSha.value = draft.remoteSha
        isNewFile.value = !draft.remoteSha
        originalContent.value = draft.content
        bodyContent.value = parseFrontmatter(draft.content).body
        return
      } else {
        deleteDraft(path)
      }
    }

    try {
      const result = await readFile(path)
      if (result) {
        content.value = result.content
        remoteSha.value = result.sha
        isNewFile.value = false
        const parsed = parseFrontmatter(result.content)
        frontmatter.value = { ...parsed.frontmatter }
        bodyContent.value = parsed.body
        originalContent.value = result.content
      } else {
        isNewFile.value = true
        remoteSha.value = null
        const fallbackParsed = parseFrontmatter(fallbackContent)
        frontmatter.value = { ...fallbackParsed.frontmatter }
        bodyContent.value = fallbackParsed.body || ''
        content.value = fallbackContent
        originalContent.value = ''
      }
    } catch {
      let localContent = fallbackContent || ''

      if (LOCAL_EDIT) {
        const raw = getLocalContent(path)
        if (raw) localContent = raw
      }

      isNewFile.value = true
      remoteSha.value = null
      const localParsed = parseFrontmatter(localContent)
      frontmatter.value = { ...localParsed.frontmatter }
      bodyContent.value = localParsed.body || ''
      content.value = localContent
      originalContent.value = ''
    }
  }

  function updateContent(newContent: string): void {
    content.value = newContent
    isDirty.value = newContent !== originalContent.value
    const parsed = parseFrontmatter(newContent)
    frontmatter.value = { ...parsed.frontmatter }
    bodyContent.value = parsed.body
  }

  function updateFrontmatter(fm: Record<string, any>): void {
    frontmatter.value = { ...fm }
    const newContent = assembleMarkdown(fm, bodyContent.value)
    content.value = newContent
    isDirty.value = newContent !== originalContent.value
  }

  function saveDraft(): void {
    persistDraft(filePath.value, content.value, frontmatter.value, remoteSha.value)
  }

  async function commit(message: string): Promise<boolean> {
    if (!isNewFile.value && !isDirty.value) {
      saveError.value = '内容未修改'
      return false
    }
    isSaving.value = true
    saveError.value = null
    try {
      if (isNewFile.value) {
        const ok = await createFile(filePath.value, content.value, message)
        if (!ok) {
          saveError.value = '提交失败，请检查网络后重试'
          return false
        }
        const result = await readFile(filePath.value)
        if (result) remoteSha.value = result.sha
        isNewFile.value = false
      } else {
        if (!remoteSha.value) {
          saveError.value = '缺少远程文件信息，请刷新后重试'
          return false
        }
        const result = await updateFile(filePath.value, content.value, remoteSha.value, message)
        if (!result) {
          saveError.value = '提交失败（可能存在冲突），请刷新后重试'
          return false
        }
        remoteSha.value = result.sha
      }
      originalContent.value = content.value
      isDirty.value = false
      deleteDraft(filePath.value)
      return true
    } catch (e: any) {
      saveError.value = e.message || '提交失败'
      persistDraft(filePath.value, content.value, frontmatter.value, remoteSha.value)
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    isEditing, filePath, content, frontmatter, remoteSha,
    isDirty, isSaving, saveError, isNewFile,
    initEditor, updateContent, updateFrontmatter, saveDraft, commit
  }
}
