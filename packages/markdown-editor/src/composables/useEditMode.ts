import { computed, ref, toRaw } from 'vue'
import { assembleMarkdown, parseFrontmatter } from '../frontmatter'
import { createDraftStore } from './useDrafts'
import type { EditorStorage } from '../types'

export interface EditSessionOptions {
  storage: EditorStorage
  draftStore?: ReturnType<typeof createDraftStore>
  confirmAction?: (message: string) => boolean
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback
}

export function createEditSession(options: EditSessionOptions) {
  const { readFile, createFile, updateFile } = options.storage
  const draftStore = options.draftStore ?? createDraftStore()
  const confirmAction = options.confirmAction ?? ((message: string) => confirm(message))
  const { loadDraft, saveDraft: persistDraft, deleteDraft } = draftStore

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
  const canonicalOriginalContent = computed(() => {
    const original = parseFrontmatter(originalContent.value)
    return original.error ? null : assembleMarkdown(original.frontmatter, original.body)
  })
  const bodyContent = ref('')
  const draftImages = ref<Record<string, File>>({})
  let loadGeneration = 0
  let draftWriteQueue = Promise.resolve()

  function queueDraftWrite(write: () => Promise<void>): Promise<void> {
    const result = draftWriteQueue.then(write, write)
    draftWriteQueue = result.then(() => undefined, () => undefined)
    return result
  }

  function finishEditing(): void {
    loadGeneration++
    isEditing.value = false
    isSaving.value = false
  }

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
    initOptions: { expectNew?: boolean } = {},
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

    await draftWriteQueue
    if (generation !== loadGeneration) return
    const draft = await loadDraft(path)
    if (generation !== loadGeneration) return
    draftImages.value = draft?.images ?? {}

    let remote: { content: string; sha: string } | null
    try {
      remote = await readFile(path)
    } catch (error) {
      if (generation !== loadGeneration) return

      if (draft) {
        applyContent(draft.content, fallbackContent, draft.remoteSha, Boolean(initOptions.expectNew && !draft.remoteSha))
        loadError.value = getErrorMessage(error, '无法读取远程文章，已恢复本机草稿')
        return
      }

      const localContent = options.storage.readLocalFile?.(path, fallbackContent) ?? null
      const notice = options.storage.localFileNotice

      if (localContent !== null && notice) {
        applyContent(localContent, localContent, null, false)
        loadError.value = notice
        return
      }

      applyContent(fallbackContent, fallbackContent, null, false)
      loadError.value = getErrorMessage(error, '无法读取文章，未进入新文件模式')
      return
    }

    if (generation !== loadGeneration) return

    const isNew = remote === null

    if (isNew && !initOptions.expectNew) {
      applyContent(fallbackContent, fallbackContent, null, false)
      loadError.value = '远程文章不存在，未进入新文件模式'
      return
    }

    if (initOptions.expectNew && remote) {
      applyContent(fallbackContent, '', null, true)
      newFileConflict.value = true
      loadError.value = '目标文章路径已经存在，请返回并修改标题后再创建'
      return
    }

    const remoteContent = remote ? remote.content : fallbackContent
    const remoteOriginal = isNew ? '' : remoteContent
    const currentSha = remote?.sha || null

    if (draft) {
      const sameBase = draft.remoteSha === currentSha
      const shouldRestore = sameBase || confirmAction(
        '远程文章已经更新，恢复草稿可能覆盖远程最新内容，是否继续？',
      )

      if (shouldRestore) {
        applyContent(draft.content, remoteOriginal, currentSha, isNew)
        return
      }

      await queueDraftWrite(() => deleteDraft(path))
      if (generation !== loadGeneration) return
      draftImages.value = {}
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
    const newContent = assembleEditedContent(nextFrontmatter, bodyContent.value)
    frontmatter.value = { ...nextFrontmatter }
    content.value = newContent
    frontmatterError.value = null
    isDirty.value = newContent !== originalContent.value
  }

  function assembleEditedContent(metadata: Record<string, any>, body: string): string {
    const assembled = assembleMarkdown(metadata, body)
    if (assembled === canonicalOriginalContent.value) {
      return originalContent.value
    }
    return assembled
  }

  /*
   * 正文编辑器直接改写正文部分。属性块由属性面板维护，因此这里保持
   * frontmatter 不变，只重新拼装完整内容，避免覆盖用户尚未提交的属性修改。
   */
  function updateBody(nextBody: string): void {
    if (frontmatterError.value) {
      throw new Error('请先修复文章属性 YAML')
    }
    bodyContent.value = nextBody
    content.value = assembleEditedContent(frontmatter.value, nextBody)
    isDirty.value = content.value !== originalContent.value
  }

  async function saveDraft(
    snapshot = content.value,
    images: Record<string, File> = draftImages.value,
    path = filePath.value,
    metadata = parseFrontmatter(snapshot).frontmatter,
    sha = remoteSha.value,
  ): Promise<void> {
    if (!path) return
    const imageSnapshot = structuredClone(toRaw(images))
    const draft = {
      content: snapshot,
      frontmatter: structuredClone(toRaw(metadata)),
      sha,
      images: imageSnapshot,
    }
    const unchanged = path === filePath.value && snapshot === originalContent.value
    await queueDraftWrite(() => unchanged
      ? deleteDraft(path)
      : persistDraft(path, draft.content, draft.frontmatter, draft.sha, draft.images))
    if (filePath.value === path && content.value === snapshot) draftImages.value = images
  }

  async function failCommit(message: string): Promise<false> {
    saveError.value = message
    return false
  }

  async function recoverRemoteWrite(submittedContent: string, submittedPath: string, generation: number): Promise<boolean> {
    try {
      const remote = await readFile(submittedPath)
      if (generation !== loadGeneration) return false
      if (!remote || remote.content !== submittedContent) return false

      remoteSha.value = remote.sha
      isNewFile.value = false
      originalContent.value = submittedContent
      isDirty.value = content.value !== submittedContent
      if (!isDirty.value) await queueDraftWrite(() => deleteDraft(submittedPath))
      return true
    } catch {
      return false
    }
  }

  async function commit(message: string, submittedSnapshot = content.value): Promise<boolean> {
    if (frontmatterError.value) {
      return await failCommit(frontmatterError.value)
    }
    if (!filePath.value) {
      saveError.value = '缺少文章路径'
      return false
    }
    if (newFileConflict.value) {
      return await failCommit('目标文章路径已经存在，请返回并修改标题后再创建')
    }
    if (submittedSnapshot === originalContent.value) {
      return await failCommit('内容未修改')
    }

    isSaving.value = true
    saveError.value = null
    const submittedContent = submittedSnapshot
    const submittedPath = filePath.value
    const submittedSha = remoteSha.value
    const submittedAsNew = isNewFile.value
    const submittedGeneration = loadGeneration
    try {
      if (submittedAsNew) {
        const result = await createFile(submittedPath, submittedContent, message)
        if (submittedGeneration !== loadGeneration) return false
        if (!result) {
          return await failCommit('提交失败，请检查路径、权限或网络后重试')
        }
        if (submittedGeneration !== loadGeneration) return true
        remoteSha.value = result.sha
        isNewFile.value = false
      } else {
        if (!remoteSha.value) {
          return await failCommit('缺少远程文件版本信息，请重新加载文章')
        }
        const result = await updateFile(submittedPath, submittedContent, submittedSha!, message)
        if (submittedGeneration !== loadGeneration) return false
        if (!result) {
          return await failCommit('提交失败，远程文章可能已经更新，请重新加载后合并')
        }
        if (submittedGeneration !== loadGeneration) return true
        remoteSha.value = result.sha
      }

      if (submittedGeneration !== loadGeneration) return true
      originalContent.value = submittedContent
      isDirty.value = content.value !== submittedContent
      if (!isDirty.value) await queueDraftWrite(() => deleteDraft(submittedPath))
      return true
    } catch (error) {
      if (submittedGeneration !== loadGeneration) return false
      if (await recoverRemoteWrite(submittedContent, submittedPath, submittedGeneration)) return true
      if (submittedGeneration !== loadGeneration) return false

      saveError.value = getErrorMessage(error, '提交失败')
      return false
    } finally {
      if (submittedGeneration === loadGeneration) isSaving.value = false
    }
  }

  return {
    isEditing,
    filePath,
    content,
    bodyContent,
    draftImages,
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
    updateBody,
    updateContent,
    updateFrontmatter,
    saveDraft,
    commit,
    getGeneration: () => loadGeneration,
    finishEditing,
  }
}
