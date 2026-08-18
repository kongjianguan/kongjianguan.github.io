import { ref } from 'vue'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { useGitHubAPI } from './useGitHubAPI'
import { useDrafts } from './useDrafts'

const LOCAL_EDIT = import.meta.env.DEV && import.meta.env.VITE_LOCALEDIT === '1'

const localMdSources: Record<string, string> = LOCAL_EDIT
  ? import.meta.glob('/**/*.md', { query: '?raw', import: 'default', eager: true })
  : {}

function getLocalContent(path: string): string {
  const normalized = path.startsWith('docs/') ? path.slice(5) : path
  const key = `/${normalized}`
  return localMdSources[key] || localMdSources[path] || ''
}

interface ParsedFrontmatter {
  frontmatter: Record<string, any>
  body: string
  error?: string
}

function parseFrontmatter(md: string): ParsedFrontmatter {
  const normalized = md.replace(/\r\n?/g, '\n')
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/)
  if (!match) return { frontmatter: {}, body: md }

  try {
    const parsed = parseYaml(match[1])
    if (parsed === null || parsed === undefined) {
      return { frontmatter: {}, body: match[2] || '' }
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('文章属性必须是 YAML 对象')
    }
    return {
      frontmatter: parsed as Record<string, any>,
      body: match[2] || '',
    }
  } catch (error: any) {
    const detail = error?.message ? `：${error.message}` : ''
    return {
      frontmatter: {},
      body: match[2] || '',
      error: `文章属性 YAML 无法解析${detail}`,
    }
  }
}

function buildFrontmatter(frontmatter: Record<string, any>): string {
  const yaml = stringifyYaml(frontmatter, { lineWidth: 0 }).trimEnd()
  return `---\n${yaml}\n---`
}

function assembleMarkdown(frontmatter: Record<string, any>, body: string): string {
  return `${buildFrontmatter(frontmatter)}\n${body}`
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function useEditMode() {
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
  const loadError = ref<string | null>(null)
  const frontmatterError = ref<string | null>(null)
  const isNewFile = ref(false)
  const newFileConflict = ref(false)
  const originalContent = ref('')
  const bodyContent = ref('')
  let loadGeneration = 0

  function applyContent(
    nextContent: string,
    original: string,
    sha: string | null,
    newFile: boolean,
  ): void {
    const parsed = parseFrontmatter(nextContent)
    content.value = nextContent
    frontmatter.value = { ...parsed.frontmatter }
    bodyContent.value = parsed.body
    frontmatterError.value = parsed.error || null
    originalContent.value = original
    remoteSha.value = sha
    isNewFile.value = newFile
    isDirty.value = nextContent !== original
  }

  async function initEditor(
    path: string,
    fallbackContent: string,
    options: { expectNew?: boolean } = {},
  ): Promise<void> {
    const generation = ++loadGeneration
    filePath.value = path
    isEditing.value = true
    isDirty.value = false
    isSaving.value = false
    saveError.value = null
    loadError.value = null
    frontmatterError.value = null
    newFileConflict.value = false

    let remote: { content: string; sha: string } | null
    try {
      remote = await readFile(path)
    } catch (error) {
      if (generation !== loadGeneration) return

      if (LOCAL_EDIT) {
        const localContent = getLocalContent(path) || fallbackContent
        applyContent(localContent, localContent, null, false)
        loadError.value = '本地编辑模式未连接 GitHub，提交前需要有效的 GitHub 登录状态'
        return
      }

      applyContent(fallbackContent, fallbackContent, null, false)
      loadError.value = getErrorMessage(error, '无法读取文章，未进入新文件模式')
      return
    }

    if (generation !== loadGeneration) return

    const isNew = remote === null

    if (isNew && !options.expectNew) {
      applyContent(fallbackContent, fallbackContent, null, false)
      loadError.value = '远程文章不存在，未进入新文件模式'
      return
    }

    if (options.expectNew && remote) {
      applyContent(fallbackContent, '', null, true)
      newFileConflict.value = true
      loadError.value = '目标文章路径已经存在，请返回并修改标题后再创建'
      return
    }

    const remoteContent = remote ? remote.content : fallbackContent
    const remoteOriginal = isNew ? '' : remoteContent
    const currentSha = remote?.sha || null

    const draft = loadDraft(path)
    if (draft) {
      const sameBase = draft.remoteSha === currentSha
      const shouldRestore = sameBase || confirm(
        '远程文章已经更新，恢复草稿可能覆盖远程最新内容，是否继续？',
      )

      if (shouldRestore) {
        applyContent(draft.content, remoteOriginal, currentSha, isNew)
        return
      }

      deleteDraft(path)
    }

    applyContent(remoteContent, remoteOriginal, currentSha, isNew)
  }

  function updateContent(newContent: string): void {
    const parsed = parseFrontmatter(newContent)
    content.value = newContent
    frontmatter.value = { ...parsed.frontmatter }
    bodyContent.value = parsed.body
    frontmatterError.value = parsed.error || null
    isDirty.value = newContent !== originalContent.value
  }

  function updateFrontmatter(nextFrontmatter: Record<string, any>): void {
    const newContent = assembleMarkdown(nextFrontmatter, bodyContent.value)
    frontmatter.value = { ...nextFrontmatter }
    content.value = newContent
    frontmatterError.value = null
    isDirty.value = newContent !== originalContent.value
  }

  function saveDraft(): void {
    if (filePath.value) {
      persistDraft(filePath.value, content.value, frontmatter.value, remoteSha.value)
    }
  }

  function failCommit(message: string): false {
    saveError.value = message
    saveDraft()
    return false
  }

  async function recoverRemoteWrite(): Promise<boolean> {
    try {
      const remote = await readFile(filePath.value)
      if (!remote || remote.content !== content.value) return false

      remoteSha.value = remote.sha
      isNewFile.value = false
      originalContent.value = content.value
      isDirty.value = false
      deleteDraft(filePath.value)
      return true
    } catch {
      return false
    }
  }

  async function commit(message: string): Promise<boolean> {
    if (frontmatterError.value) {
      return failCommit(frontmatterError.value)
    }
    if (!filePath.value) {
      saveError.value = '缺少文章路径'
      return false
    }
    if (newFileConflict.value) {
      return failCommit('目标文章路径已经存在，请返回并修改标题后再创建')
    }
    if (!isDirty.value) {
      return failCommit('内容未修改')
    }

    isSaving.value = true
    saveError.value = null
    try {
      if (isNewFile.value) {
        const result = await createFile(filePath.value, content.value, message)
        if (!result) {
          return failCommit('提交失败，请检查路径、权限或网络后重试')
        }
        remoteSha.value = result.sha
        isNewFile.value = false
      } else {
        if (!remoteSha.value) {
          return failCommit('缺少远程文件版本信息，请重新加载文章')
        }
        const result = await updateFile(filePath.value, content.value, remoteSha.value, message)
        if (!result) {
          return failCommit('提交失败，远程文章可能已经更新，请重新加载后合并')
        }
        remoteSha.value = result.sha
      }

      originalContent.value = content.value
      isDirty.value = false
      deleteDraft(filePath.value)
      return true
    } catch (error: any) {
      if (await recoverRemoteWrite()) return true

      saveError.value = getErrorMessage(error, '提交失败')
      saveDraft()
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    isEditing,
    filePath,
    content,
    frontmatter,
    remoteSha,
    isDirty,
    isSaving,
    saveError,
    loadError,
    frontmatterError,
    isNewFile,
    newFileConflict,
    initEditor,
    updateContent,
    updateFrontmatter,
    saveDraft,
    commit,
  }
}
