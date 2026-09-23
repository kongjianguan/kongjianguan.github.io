import type { DraftRecord } from '../types'

interface DraftStorageOptions {
  keyPrefix?: string
  storage?: Storage
}

function defaultStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage
}

export function createDraftStore(options: DraftStorageOptions = {}) {
  const keyPrefix = options.keyPrefix ?? 'markdown-editor:draft:'
  const storage = options.storage ?? defaultStorage()

  function getKey(filePath: string): string {
    return `${keyPrefix}${filePath}`
  }

  function loadDraft(filePath: string): DraftRecord | null {
    if (!storage) return null
    const key = getKey(filePath)
    try {
      const raw = storage.getItem(key)
      if (!raw) return null
      const draft = JSON.parse(raw)
      if (
        typeof draft?.content !== 'string' ||
        typeof draft?.frontmatter !== 'object' ||
        draft.frontmatter === null ||
        Array.isArray(draft.frontmatter) ||
        typeof draft?.savedAt !== 'string' ||
        (draft.remoteSha !== null && typeof draft.remoteSha !== 'string')
      ) {
        storage.removeItem(key)
        return null
      }
      return draft as DraftRecord
    } catch {
      try {
        storage.removeItem(key)
      } catch {
        /* storage may be unavailable */
      }
      return null
    }
  }

  function saveDraft(
    filePath: string,
    content: string,
    frontmatter: Record<string, unknown>,
    remoteSha: string | null,
  ): void {
    if (!storage) return
    const draft: DraftRecord = {
      content,
      frontmatter,
      savedAt: new Date().toISOString(),
      remoteSha,
    }
    try {
      storage.setItem(getKey(filePath), JSON.stringify(draft))
    } catch {
      /* a private browsing session or a full storage quota must not break editing */
    }
  }

  function deleteDraft(filePath: string): void {
    if (!storage) return
    try {
      storage.removeItem(getKey(filePath))
    } catch {
      /* storage may be unavailable */
    }
  }

  function hasDraft(filePath: string): boolean {
    if (!storage) return false
    try {
      return storage.getItem(getKey(filePath)) !== null
    } catch {
      return false
    }
  }

  return { loadDraft, saveDraft, deleteDraft, hasDraft }
}
