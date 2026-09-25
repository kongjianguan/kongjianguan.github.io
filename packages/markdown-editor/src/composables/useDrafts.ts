import { del, get, set } from 'idb-keyval'
import type { DraftRecord } from '../types'

interface DraftStorageOptions {
  keyPrefix?: string
}

export function createDraftStore(options: DraftStorageOptions = {}) {
  const keyPrefix = options.keyPrefix ?? 'markdown-editor:draft:'

  function getKey(filePath: string): string {
    return `${keyPrefix}${filePath}`
  }

  async function loadDraft(filePath: string): Promise<DraftRecord | null> {
    const draft = await get<DraftRecord>(getKey(filePath))
    if (!draft) return null
    if (
      typeof draft.content !== 'string' ||
      typeof draft.frontmatter !== 'object' ||
      draft.frontmatter === null ||
      Array.isArray(draft.frontmatter) ||
      typeof draft.savedAt !== 'string' ||
      (draft.remoteSha !== null && typeof draft.remoteSha !== 'string') ||
      typeof draft.images !== 'object' || draft.images === null || Array.isArray(draft.images)
    ) {
      throw new Error(`本机草稿格式无效：${filePath}`)
    }
    return draft
  }

  async function saveDraft(
    filePath: string,
    content: string,
    frontmatter: Record<string, unknown>,
    remoteSha: string | null,
    images: Record<string, File> = {},
  ): Promise<void> {
    const draft: DraftRecord = {
      content,
      frontmatter,
      savedAt: new Date().toISOString(),
      remoteSha,
      images,
    }
    await set(getKey(filePath), draft)
  }

  async function deleteDraft(filePath: string): Promise<void> {
    await del(getKey(filePath))
  }

  async function hasDraft(filePath: string): Promise<boolean> {
    return (await get(getKey(filePath))) !== undefined
  }

  return { loadDraft, saveDraft, deleteDraft, hasDraft }
}
